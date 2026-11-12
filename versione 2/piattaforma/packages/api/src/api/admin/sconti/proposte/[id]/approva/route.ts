import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import crypto from "node:crypto"
import { interroga, invalido, valida } from "../../../../../utili"
import { chi, inFila, servizioCarte } from "../../../../carte-regalo/comune"
import { codiceOccupato, creaPromozione, eliminaPromozione, leggiPromozione } from "../../../promozioni"
import { perVista, prodottiDellAzienda, type Proposta } from "../../comune"

const Approvazione = z.object({
  codice: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9_-]{2,39}$/, "Codes need 3 to 40 characters: letters, numbers and hyphens")
    .or(z.literal(""))
    .nullable()
    .optional(),
  nota: z.string().trim().max(500, "That note is too long").nullable().optional(),
})

function codiceDa(titolo: string): string {
  const parola = titolo.normalize("NFD").replace(/[^A-Za-z0-9]+/g, "").toUpperCase().slice(0, 12)
  return `${parola || "DISCOUNT"}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`
}

/** Lo sconto nasce qui e solo qui: prima dell'approvazione non esiste alcuna promozione. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const dati = valida(Approvazione, req.body ?? {})
  const servizio = servizioCarte(req)
  const attore = await chi(req)

  const decisa = await inFila(req, `proposta-sconto:${req.params.id}`, async () => {
    const proposta = await servizio.retrieveProposta(req.params.id)
    if (proposta.stato !== "in_attesa") throw invalido("This proposal has already been decided")
    if (new Date(proposta.fine).getTime() <= Date.now()) throw invalido("This proposal's dates have passed: the company needs to propose new ones")

    const prodotti = await prodottiDellAzienda(req.scope, proposta.azienda_id, proposta.prodotti as string[] | null)
    if (!prodotti.length) throw invalido("The products in this proposal are gone: the discount would apply to nothing")

    const codice = dati.codice || codiceDa(proposta.titolo)
    if (await codiceOccupato(req.scope, codice)) throw invalido("A discount with this code already exists")

    const { data: aziende } = await interroga(req).graph({ entity: "seller", fields: ["name"], filters: { id: proposta.azienda_id } })
    const promozioneId = await creaPromozione(req.scope, {
      codice,
      tipo: proposta.tipo,
      valore: Number(proposta.valore),
      descrizione: proposta.titolo,
      inizio: proposta.inizio,
      fine: proposta.fine,
      attivo: true,
      prodotti,
      metadata: { proposta_id: proposta.id, azienda_id: proposta.azienda_id, azienda_nome: aziende[0]?.name ?? null },
    })
    try {
      return await servizio.updatePropostas({
        id: proposta.id,
        stato: "approvata",
        nota: dati.nota || null,
        deciso_da: attore,
        deciso_il: new Date(),
        promozione_id: promozioneId,
        codice,
      })
    } catch (errore) {
      await eliminaPromozione(req.scope, await leggiPromozione(req.scope, promozioneId))
      throw errore
    }
  })
  const [vista] = await perVista(req.scope, [decisa as unknown as Proposta])
  res.json({ proposta: vista })
}
