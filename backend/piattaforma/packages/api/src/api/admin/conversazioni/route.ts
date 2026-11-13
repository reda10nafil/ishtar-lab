import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONVERSAZIONI_MODULE } from "../../../modules/conversazioni"
import type ConversazioniModuleService from "../../../modules/conversazioni/service"
import { filtriElenco, rigaConversazione, simile } from "./lib/elenco"

const APERTE = ["aperta", "in_attesa"]

/** Elenco della casella: aperte (anche quelle in attesa del cliente) o chiuse, dall'ultimo messaggio, con i conteggi. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const f = filtriElenco(req.query as Record<string, unknown>)
  const s = req.scope.resolve<ConversazioniModuleService>(CONVERSAZIONI_MODULE)
  const filtri: Record<string, unknown> = { stato: f.stato === "chiuse" ? "chiusa" : APERTE }
  if (f.canale) filtri.canale = f.canale
  if (f.q) {
    const testo = simile(f.q)
    filtri.$or = [{ ultimo_estratto: testo }, { oggetto: testo }, { identita: { nome: testo } }, { identita: { recapito: testo } }]
  }
  const [[righe, totale], [, aperte], [, chiuse], [, nonLette]] = await Promise.all([
    s.listAndCountConversaziones(filtri, { relations: ["identita"], order: { ultimo_messaggio_il: "DESC" }, take: f.limit, skip: f.offset }),
    s.listAndCountConversaziones({ stato: APERTE } as never, { take: 1 }),
    s.listAndCountConversaziones({ stato: "chiusa" }, { take: 1 }),
    s.listAndCountConversaziones({ stato: APERTE, non_letti: { $gt: 0 } } as never, { take: 1 }),
  ])
  res.json({ conversazioni: righe.map(rigaConversazione), conteggi: { aperte, chiuse, non_lette: nonLette }, totale })
}
