import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { valida } from "../../../utili"
import { leggiDemo, type CampagnaDemo } from "../../analisi/lib/demo"
import { DatiCampagna, servizioMarketing } from "../lib/campagne"
import { riprendiSospese } from "../lib/invio"
import { destinatariDi, elencoPubblici, leggiIscritti } from "../lib/pubblico"

const GIORNO = 86_400_000

const misureDi = (c?: CampagnaDemo) => (c && c.aperture !== undefined ? { aperture: c.aperture, clic: c.clic ?? null, incasso: c.incasso ?? null, ordini: c.ordini ?? null } : null)

/** Una campagna dimostrativa si legge come una vera, senza azioni: non è nel database. */
const dimostrativa = (c: CampagnaDemo, i: number) => {
  const stato = c.stato ?? "inviata"
  return {
    id: `demo-${i}`,
    nome: c.nome,
    canale: c.canale ?? "email",
    oggetto: c.oggetto ?? "",
    testo: "",
    pubblico: "tutti",
    pubblico_ora: c.destinatari ?? 0,
    stato,
    programmata_il: stato === "programmata" ? (c.quando ?? null) : null,
    avviata_il: null,
    conclusa_il: stato === "inviata" ? (c.quando ?? null) : null,
    destinatari: c.destinatari ?? 0,
    inviati: c.inviati ?? 0,
    falliti: 0,
    misure: misureDi(c),
    dimostrativa: true,
  }
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await riprendiSospese(req.scope)
  const servizio = servizioMarketing(req)
  const [vere, clienti, demo] = await Promise.all([servizio.listCampagnas({}, { order: { created_at: "DESC" } }), leggiIscritti(req.scope), leggiDemo(req.scope)])
  const demoPerNome = new Map((demo?.campagne ?? []).map((c) => [c.nome, c]))
  const nomi = new Set(vere.map((c) => c.nome))
  const campagne = [
    ...vere.map((c) => ({ ...c, pubblico_ora: destinatariDi(clienti, c.pubblico).length, misure: misureDi(demoPerNome.get(c.nome)), dimostrativa: false })),
    ...(demo?.campagne ?? []).filter((c) => !nomi.has(c.nome)).map(dimostrativa),
  ]
  const dal = Date.now() - 90 * GIORNO
  const recenti = campagne.filter((c) => c.conclusa_il && new Date(c.conclusa_il).getTime() >= dal)
  const prossima = campagne
    .filter((c) => c.stato === "programmata" && c.programmata_il)
    .map((c) => new Date(c.programmata_il as string | Date).toISOString())
    .sort()[0]
  const meseFa = Date.now() - 30 * GIORNO
  const conMisure = recenti.filter((c) => c.misure)
  res.json({
    campagne,
    riepilogo: {
      inviate: recenti.length,
      email_inviate: recenti.reduce((totale, c) => totale + c.inviati, 0),
      incasso: conMisure.length ? conMisure.reduce((totale, c) => totale + (c.misure?.incasso ?? 0), 0) : null,
      apertura: conMisure.length ? conMisure.reduce((totale, c) => totale + (c.misure?.aperture ?? 0), 0) / conMisure.length : null,
      iscritti: clienti.length,
      nuovi_iscritti: clienti.filter((c) => c.newsletter_data && new Date(c.newsletter_data).getTime() >= meseFa).length,
      prossima: prossima ?? null,
      programmate: campagne.filter((c) => c.stato === "programmata").length,
    },
    pubblici: elencoPubblici(clienti),
  })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const dati = valida(DatiCampagna, req.body)
  const campagna = await servizioMarketing(req).createCampagnas(dati)
  res.status(201).json({ campagna })
}
