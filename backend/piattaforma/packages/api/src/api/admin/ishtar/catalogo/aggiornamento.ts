import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { aggiornaProdottoCatalogoWorkflow, esegui, type InputModifica } from "../../../../workflows/catalogo/salvataggio-prodotto"
import { invalido } from "../../../utili"
import { chi, inFila } from "../../carte-regalo/comune"
import { SalvataggioAMeta } from "../../catalogo/comune/creazione"
import { depositoEsistente, leggiOfferte, prezziAggiornati } from "../../catalogo/comune/offerte"
import { vedeMargini } from "../../catalogo/comune/permessi"
import { destinazioneScorte, messaggioConflitto, preparaModifica, type Conflitto } from "./salvataggio"
import type { Modifica } from "./schema"
import { vistaProdotto } from "./vista"

/** Attesa massima dei lucchetti: i salvataggi dello stesso prodotto passano uno alla volta. */
export const ATTESA_LUCCHETTO = 30

export const CAMPI_PRODOTTO = ["id", "title", "description", "status", "material", "categories.id", "categories.name", "metadata", "images.url", "variants.id", "variants.sku"]

const oggetto = (v: unknown): v is Record<string, any> => Boolean(v) && typeof v === "object" && !Array.isArray(v)

type Configurazione = { seller_id: string; categories: { id: string; name: string }[]; fields?: any[] }

/** Un campo è cambiato altrove: la modifica non è stata salvata (risposta 412 con i valori attuali). */
export class ConflittoModifica extends Error {
  constructor(public conflitti: Conflitto[], messaggio: string) {
    super(messaggio)
    this.name = "ConflittoModifica"
  }
}

/**
 * Scorte rifiutate (più depositi, sotto zero, nessuna voce di magazzino): 400 con il codice «scorte», così il pannello
 * toglie dalla coda solo le variazioni e salva comunque prezzo, stato e gli altri campi della stessa modifica.
 */
export class RifiutoScorte extends Error {
  constructor(messaggio: string) {
    super(messaggio)
    this.name = "RifiutoScorte"
  }
}

const nomiCategorie = (config: Configurazione) => (config.categories ?? []).map((c) => c.name)

async function leggiProdotto(req: AuthenticatedMedusaRequest, config: Configurazione, id: string) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields: CAMPI_PRODOTTO, filters: { id } })
  const prodotto = data[0] as any
  if (!prodotto || !oggetto(prodotto.metadata?.ishtar_v1)) throw invalido("Prodotto Ishtar non trovato")
  const variante = prodotto.variants?.[0]
  const offerte = variante ? await leggiOfferte(req.scope, { variant_id: variante.id, seller_id: config.seller_id }) : []
  if (offerte.length !== 1) throw invalido("Offerta prodotto non univoca")
  return { prodotto, variante, offerta: offerte[0] }
}

/** L'errore esce dal workflow serializzato (serializeError di Medusa): si riconosce dal nome. */
function tradotto(errore: any, config: Configurazione) {
  if (errore?.name === "ConflittoScorte") {
    const conflitti: Conflitto[] = [{ campo: errore.campo, attuale: errore.attuale, tuo: errore.tuo ?? null }]
    return new ConflittoModifica(conflitti, messaggioConflitto(conflitti, config.fields ?? []))
  }
  if (errore?.name === "ScorteNonValide") return new RifiutoScorte(String(errore.message))
  return errore
}

/**
 * Modifica dal pannello sotto il lucchetto del prodotto: si rilegge il prodotto, si scrive solo ciò che è cambiato e
 * solo se il valore attuale è quello da cui il pannello è partito; scorte come variazioni o conteggio, firmate con l'email
 * di chi salva. Restituisce la scheda aggiornata, con cui il pannello riallinea la propria copia.
 */
export async function aggiornaProdotto(req: AuthenticatedMedusaRequest, config: Configurazione, m: Modifica) {
  return inFila(req, `ishtar-prodotto:${m.id}`, async () => {
    const { prodotto, variante, offerta } = await leggiProdotto(req, config, m.id)
    if (variante.sku !== m.sku) throw invalido("Il codice SKU identifica il prodotto: crearne uno nuovo per un altro articolo")
    // Confronto con il costo sempre presente: la rotta di scrittura richiede già il permesso sui margini.
    const attuale = vistaProdotto(prodotto, offerta, true, nomiCategorie(config))
    const catalogo = nomiCategorie(config)
    const piano = preparaModifica(attuale, m.campi, config, offerta, m.id, {
      salvata: prodotto.metadata.ishtar_v1,
      categorieDaTenere: (prodotto.categories ?? []).filter((c: any) => c?.id && !catalogo.includes(c.name)).map((c: any) => c.id),
    })
    if (piano.conflitti.length) throw new ConflittoModifica(piano.conflitti, messaggioConflitto(piano.conflitti, config.fields ?? []))
    let destinazione: ReturnType<typeof destinazioneScorte> | null = null
    try {
      if (m.movimenti.length || m.conteggio) destinazione = destinazioneScorte(offerta)
    } catch (errore) {
      throw new RifiutoScorte((errore as Error).message)
    }
    const firma = destinazione ? await chi(req) : ""
    const salva = async () => {
      // Voce senza livello: deposito dell'azienda, letto qui dentro (con il lucchetto del deposito se va creato).
      const dove = destinazione && !destinazione.deposito ? await depositoEsistente(req.scope, config.seller_id) : null
      const input: InputModifica = {
        id: m.id,
        prodotto: piano.prodotto ?? null,
        scorte: destinazione
          ? { voce: destinazione.voce, deposito: destinazione.deposito ?? dove?.deposito ?? null, azienda: config.seller_id, nome_deposito: dove?.nome_deposito ?? "",
            movimenti: m.movimenti, conteggio: m.conteggio, chi: firma, quando: new Date().toISOString() }
          : null,
        offerta: piano.offerta
          ? { id: offerta.id, ...(piano.offerta.prezzo !== undefined ? { prices: prezziAggiornati(offerta, piano.offerta.prezzo) } : {}), ...(piano.offerta.metadata ? { metadata: piano.offerta.metadata } : {}) }
          : null,
        updated_by: req.auth_context.actor_id,
      }
      // Invio ripetuto di una modifica già salvata, o niente di cambiato: nessuna scrittura.
      if (!input.prodotto && !input.scorte && !input.offerta) return
      const esito = await esegui(aggiornaProdottoCatalogoWorkflow, req.scope, input)
      if (esito.esito === "annullato") throw tradotto(esito.errore, config)
      if (esito.esito === "a-meta") throw new SalvataggioAMeta(esito.transazione, esito.errore)
    }
    // Deposito da creare (azienda che ancora non ne ha uno): stesso lucchetto di creaProdotto e nuova lettura dentro.
    const senzaDeposito = Boolean(destinazione && !destinazione.deposito && !(await depositoEsistente(req.scope, config.seller_id)).deposito)
    await (senzaDeposito ? inFila(req, `deposito:${config.seller_id}`, salva, ATTESA_LUCCHETTO) : salva())
    const dopo = await leggiProdotto(req, config, m.id)
    return vistaProdotto(dopo.prodotto, dopo.offerta, vedeMargini(req), catalogo)
  }, ATTESA_LUCCHETTO)
}
