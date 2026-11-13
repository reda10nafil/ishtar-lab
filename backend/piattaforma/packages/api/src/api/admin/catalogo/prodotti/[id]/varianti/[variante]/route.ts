import { randomUUID } from "node:crypto"
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { deleteProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import { aggiornaVarianteWorkflow, esegui } from "../../../../../../../workflows/catalogo/salvataggio-prodotto"
import { invalido, rifiutato, valida } from "../../../../../../utili"
import { chi, inFila } from "../../../../../carte-regalo/comune"
import { ConflittoHttp, erroreScorte, rispondiConflitto } from "../../../../../magazzino/lib/scrittura"
import { creaOfferte, depositoAzienda, leggiOfferte, prezziAggiornati, rimuoviOfferte } from "../../../../comune/offerte"
import { assente, puo, vedeMargini } from "../../../../comune/permessi"
import { codiciNuovaOfferta, conflittoInScrittura, messaggioVariante, pianoVariante, SchemaVariante } from "../../../../comune/variante"

async function leggiVariante(req: AuthenticatedMedusaRequest) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "variant",
    fields: ["id", "sku", "ean", "title"],
    filters: { id: req.params.variante, product_id: req.params.id },
  })
  const variante = data[0] as { id: string; sku: string | null; ean: string | null; title: string } | undefined
  if (!variante) throw assente("Variant")
  return variante
}

/**
 * Finestra varianti della console. Si scrive solo ciò che è cambiato nella finestra, e solo se il valore attuale è
 * ancora quello con cui la finestra si è aperta (altrimenti 412 con il valore attuale). Variante, prezzi e scorte vanno
 * in un solo workflow, con il lucchetto del prodotto (lo stesso del pannello) e quello di ogni voce di magazzino; la
 * quantità è un conteggio, firmato nello storico del Magazzino. La prima offerta di una variante che non ne ha nasce
 * dopo, sotto lo stesso lucchetto, con SKU ed EAN appena salvati.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const dati = valida(SchemaVariante, req.body)
  const autore = req.auth_context.actor_id
  const voci = [...(dati.offerte ?? []), ...(dati.nuova_offerta ? [dati.nuova_offerta] : [])]
  if (voci.some((o) => o.prezzo_cessione !== undefined) && !vedeMargini(req)) throw rifiutato("Supply prices need the margins permission")
  if (voci.some((o) => o.quantita !== undefined) && !puo(req, "inventory_items", "edit")) throw rifiutato("You do not have permission to change stock")

  try {
    const variante = await inFila(req, `ishtar-prodotto:${req.params.id}`, async () => {
      const variante = await leggiVariante(req)
      const attuali = await leggiOfferte(req.scope, { variant_id: variante.id })
      const piano = pianoVariante(dati, variante, attuali, randomUUID)
      if (piano.conflitti.length) throw new ConflittoHttp(messaggioVariante(piano.conflitti), piano.conflitti)
      // Offerta senza livello di un'azienda senza deposito: il primo deposito nasce qui, sotto il suo lucchetto.
      for (const s of piano.scorte) if (!s.deposito) s.deposito = await depositoAzienda(req.scope, s.azienda)
      const firma = piano.scorte.length ? await chi(req) : ""
      const quando = new Date().toISOString()
      const input = {
        variante: Object.keys(piano.campi).length ? { id: variante.id, campi: piano.campi } : null,
        scorte: piano.scorte.map((s) => ({ voce: s.voce, deposito: s.deposito!, azienda: s.azienda, nome_deposito: "", movimenti: [], conteggio: s.conteggio, chi: firma, quando })),
        offerte: piano.offerte.map((o) => {
          const offerta = attuali.find((a) => a.id === o.id)!
          return { id: o.id, ...(o.prezzo !== undefined ? { prices: prezziAggiornati(offerta, o.prezzo) } : {}), ...(o.metadata ? { metadata: o.metadata } : {}) }
        }),
        updated_by: autore,
      }
      if (input.variante || input.scorte.length || input.offerte.length) {
        const esito = await esegui(aggiornaVarianteWorkflow, req.scope, input)
        if (esito.esito !== "fatto") {
          const errore = erroreScorte(esito.errore, esito.esito === "a-meta")
          // Scorte cambiate fra la lettura e il lucchetto della voce: stesso messaggio della finestra, con l'azienda.
          if (errore instanceof ConflittoHttp) {
            const conflitto = conflittoInScrittura(errore.conflitti[0] as { attuale?: unknown; articolo_id?: string }, piano, attuali)
            throw new ConflittoHttp(messaggioVariante([conflitto]), [conflitto])
          }
          throw errore
        }
      }

      if (dati.nuova_offerta) {
        const { azienda_id, ...resto } = dati.nuova_offerta
        if (attuali.some((o) => o.azienda.id === azienda_id)) throw invalido("This company already has an offer on the variant")
        await creaOfferte(req.scope, azienda_id, autore, [{ variante_id: variante.id, ...codiciNuovaOfferta(piano.campi, variante), ...resto }])
      }
      return variante
    }, 30)
    res.json({ variante: { id: variante.id } })
  } catch (errore) {
    if (errore instanceof ConflittoHttp) return rispondiConflitto(res, errore)
    throw errore
  }
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const variante = await leggiVariante(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: sorelle } = await query.graph({ entity: "variant", fields: ["id"], filters: { product_id: req.params.id } })
  if (sorelle.length <= 1) throw invalido("A product needs at least one variant")
  await rimuoviOfferte(req.scope, await leggiOfferte(req.scope, { variant_id: variante.id }))
  await deleteProductVariantsWorkflow(req.scope).run({ input: { ids: [variante.id] } })
  res.json({ id: variante.id, eliminata: true })
}
