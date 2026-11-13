import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { depositoEsistente, leggiOfferte, type Offerta } from "../api/admin/catalogo/comune/offerte"
import { destinazioneScorte } from "../api/admin/ishtar/catalogo/salvataggio"
import { daSpostare, ishtarPulito, sogliaDaScrivere } from "../api/admin/ishtar/catalogo/vista"
import { aggiornaProdottoCatalogoWorkflow, esegui, type InputScorte } from "../workflows/catalogo/salvataggio-prodotto"

const PAGINA = 1000
const ATTESA_LUCCHETTO = 30
const AUTORE = "pulisci-metadati-ishtar"

type Lucchetti = { execute: <T>(chiavi: string[], lavoro: () => Promise<T>, opzioni?: { timeout?: number }) => Promise<T> }
type Magazzino = {
  retrieveInventoryItem: (id: string) => Promise<{ id: string; metadata?: Record<string, unknown> | null }>
  updateInventoryItems: (dati: { id: string; metadata: Record<string, unknown> }) => Promise<unknown>
}

/**
 * Toglie dalla scheda Ishtar nei metadati dei prodotti i dati che hanno già una fonte nel database: costo d'acquisto,
 * prezzo, scorte, nome, descrizione, foto e SKU. Copiati lì erano leggibili da chi legge i metadati, anche dal negozio
 * online. «In arrivo» e «Riordino» passano prima al magazzino: le unità in arrivo nel livello della voce (con un
 * movimento ricordato, così una nuova esecuzione non le aggiunge due volte), la soglia propria nella voce, se la voce
 * non ne ha già una impostata dal Magazzino. Ogni prodotto si aggiorna con il lucchetto del pannello e in un solo
 * workflow (scorte e scheda insieme); si può rieseguire senza effetti.
 * Con la parola `controlla` conta i prodotti senza modificarli (un'opzione `--controlla` non arriverebbe allo script:
 * la CLI di Medusa la tratterebbe come sua).
 *
 *   npx medusa exec ./src/scripts/pulisci-metadati-ishtar.ts controlla
 *   npx medusa exec ./src/scripts/pulisci-metadati-ishtar.ts
 */
export default async function pulisciMetadatiIshtar({ container, args }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const lucchetti = container.resolve(Modules.LOCKING) as unknown as Lucchetti
  const magazzino = container.resolve(Modules.INVENTORY) as unknown as Magazzino
  const soloControllo = (args ?? []).includes("controlla")

  const daPulire: string[] = []
  let daSpostareNelMagazzino = 0
  for (let salto = 0; ; salto += PAGINA) {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "metadata"],
      pagination: { skip: salto, take: PAGINA, order: { id: "ASC" } },
    })
    for (const p of data as Array<{ id: string; metadata?: Record<string, unknown> | null }>) {
      if (!ishtarPulito(p.metadata)) continue
      daPulire.push(p.id)
      const sposta = daSpostare(p.metadata?.ishtar_v1 as Record<string, unknown>)
      if (sposta.in_arrivo || sposta.riordino !== null) daSpostareNelMagazzino += 1
    }
    if (data.length < PAGINA) break
  }

  logger.info(`${soloControllo ? "Solo controllo. " : ""}Prodotti Ishtar con dati duplicati o da spostare nei metadati: ${daPulire.length}` +
    ` (con «In arrivo» o «Riordino» da spostare nel magazzino: ${daSpostareNelMagazzino})`)
  if (soloControllo || !daPulire.length) return

  const { data: negozi } = await query.graph({ entity: "store", fields: ["id", "metadata"], pagination: { take: 1 } })
  const aziendaId = ((negozi[0] as { metadata?: Record<string, any> } | undefined)?.metadata?.ishtar_catalog?.seller_id ?? null) as string | null

  let ripuliti = 0
  const saltati: string[] = []
  for (const id of daPulire) {
    await lucchetti.execute([`ishtar-prodotto:${id}`], async () => {
      // Rilettura subito prima di scrivere, con il lucchetto dei salvataggi del pannello.
      const { data } = await query.graph({ entity: "product", fields: ["id", "metadata", "variants.id"], filters: { id } })
      const prodotto = data[0] as { metadata?: Record<string, unknown> | null; variants?: { id: string }[] } | undefined
      const pulita = ishtarPulito(prodotto?.metadata)
      if (!prodotto || !pulita) return
      const sposta = daSpostare(prodotto.metadata?.ishtar_v1 as Record<string, unknown>)
      let scorte: InputScorte | null = null
      if (sposta.in_arrivo || sposta.riordino !== null) {
        const variante = prodotto.variants?.[0]
        const [offerta]: (Offerta | undefined)[] = aziendaId && variante ? await leggiOfferte(container, { variant_id: variante.id, seller_id: aziendaId }) : []
        if (!offerta?.voci_magazzino[0]) {
          // Senza offerta o voce di magazzino i valori non avrebbero dove andare: la scheda resta com'è.
          saltati.push(`${id}: offerta di Ishtar Lab o voce di magazzino non trovata`)
          return
        }
        if (sposta.riordino !== null) {
          const voce = await magazzino.retrieveInventoryItem(offerta.voci_magazzino[0])
          const esito = sogliaDaScrivere(voce.metadata?.soglia_sicurezza, sposta.riordino)
          if (esito.scrivi) await magazzino.updateInventoryItems({ id: voce.id, metadata: { ...(voce.metadata ?? {}), soglia_sicurezza: sposta.riordino } })
          if (esito.avviso) logger.warn(`${id}: riordino ${sposta.riordino} nella scheda, ${esito.avviso}`)
        }
        if (sposta.in_arrivo) {
          let destinazione: ReturnType<typeof destinazioneScorte>
          try {
            destinazione = destinazioneScorte(offerta)
          } catch (errore) {
            saltati.push(`${id}: ${(errore as Error).message}`)
            return
          }
          const dove = destinazione.deposito ? null : await depositoEsistente(container, offerta.azienda.id)
          scorte = {
            voce: destinazione.voce,
            deposito: destinazione.deposito ?? dove?.deposito ?? null,
            azienda: offerta.azienda.id,
            nome_deposito: dove?.nome_deposito ?? "",
            movimenti: [{ id: `migrazione-in-arrivo-${id}`, differenza: 0, in_arrivo: sposta.in_arrivo, motivo: "rettifica" }],
            chi: AUTORE,
            quando: new Date().toISOString(),
          }
        }
      }
      // Si scrive solo la scheda Ishtar: Medusa unisce i metadati al primo livello, le altre chiavi restano.
      const salva = async () => {
        // Primo deposito dell'azienda: si rilegge qui, sotto il lucchetto, perché intanto una creazione può averlo fatto.
        if (scorte && !scorte.deposito) {
          const dove = await depositoEsistente(container, scorte.azienda)
          scorte = { ...scorte, deposito: dove.deposito, nome_deposito: dove.nome_deposito }
        }
        const esito = await esegui(aggiornaProdottoCatalogoWorkflow, container, {
          id, prodotto: { metadata: { ishtar_v1: pulita } }, scorte, offerta: null, updated_by: AUTORE,
        })
        if (esito.esito === "fatto") ripuliti += 1
        else saltati.push(`${id}: ${String((esito.errore as Error)?.message ?? esito.errore)} (${esito.esito === "a-meta" ? "annullamento non completato" : "annullato"})`)
      }
      // Primo deposito dell'azienda: stesso lucchetto della creazione dei prodotti.
      await (scorte && !scorte.deposito
        ? lucchetti.execute([`deposito:${scorte.azienda}`], salva, { timeout: ATTESA_LUCCHETTO })
        : salva())
    }, { timeout: ATTESA_LUCCHETTO })
  }
  logger.info(`Metadati ripuliti: ${ripuliti}`)
  if (saltati.length) logger.warn(`Prodotti lasciati com'erano (${saltati.length}): ${saltati.join("; ")}`)
}
