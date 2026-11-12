import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { aziendaDi, invalido, valida } from "../../../utili"
import { servizioCarte } from "../../../admin/carte-regalo/comune"
import { controllaProposta, NuovaProposta, perVista, prodottiDellAzienda, type Proposta } from "../../../admin/sconti/proposte/comune"

/** L'azienda arriva solo dal contesto verificato: niente in questa rotta legge dati di altre aziende. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const proposte = await servizioCarte(req).listPropostas({ azienda_id: aziendaDi(req) }, { order: { created_at: "DESC" } })
  res.json({ proposte: await perVista(req.scope, proposte as unknown as Proposta[]) })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const azienda = aziendaDi(req)
  const dati = valida(NuovaProposta, req.body)
  controllaProposta(dati)

  let prodotti: string[] | null = null
  if (dati.prodotti?.length) {
    const scelti = [...new Set(dati.prodotti)]
    prodotti = await prodottiDellAzienda(req.scope, azienda, scelti)
    if (prodotti.length !== scelti.length) throw invalido("You can only propose discounts on your own products")
  }

  const proposta = await servizioCarte(req).createPropostas({
    azienda_id: azienda,
    titolo: dati.titolo,
    tipo: dati.tipo,
    valore: dati.valore,
    inizio: new Date(dati.inizio),
    fine: new Date(dati.fine),
    motivo: dati.motivo,
    prodotti,
  })
  const [vista] = await perVista(req.scope, [proposta as unknown as Proposta])
  res.status(201).json({ proposta: vista })
}
