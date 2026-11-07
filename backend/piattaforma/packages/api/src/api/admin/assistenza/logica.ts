import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { ASSISTENZA_MODULE } from "../../../modules/assistenza"
import type AssistenzaModuleService from "../../../modules/assistenza/service"
import type { Autore } from "../../../modules/assistenza/service"
import { aziendaDi, interroga, invalido, valida } from "../../utili"

/** Chi chiama: lo staff vede tutto, un'azienda solo le proprie richieste. */
export type Ambito = { staff: true; azienda: null } | { staff: false; azienda: string }

export const ambitoStaff = (): Ambito => ({ staff: true, azienda: null })
export const ambitoAzienda = (req: AuthenticatedMedusaRequest): Ambito => ({ staff: false, azienda: aziendaDi(req) })

const CATEGORIE = ["prodotti", "ordini", "spedizioni", "magazzino", "account", "altro"] as const
const STATI = ["aperta", "in_attesa", "chiusa"] as const
const NOME_STAFF = "Ishtar Lab team"
const MASSIMO_TESTO = 5000

const testo = (messaggio: string, massimo = MASSIMO_TESTO) =>
  z.string({ error: messaggio }).trim().min(1, messaggio).max(massimo, `Maximum ${massimo} characters`)

const NuovaRichiesta = z.object({
  oggetto: testo("Write a subject for your request", 160),
  categoria: z.enum(CATEGORIE, { error: "Choose a topic" }),
  testo: testo("Describe the problem"),
})
const NuovoMessaggio = z.object({ testo: testo("Write a message") })
const CambioStato = z.object({ stato: z.enum(STATI, { error: "Invalid status" }) })

const servizio = (req: AuthenticatedMedusaRequest) => req.scope.resolve<AssistenzaModuleService>(ASSISTENZA_MODULE)

const richiestaNonTrovata = () => new MedusaError(MedusaError.Types.NOT_FOUND, "Request not found")

async function autoreDi(req: AuthenticatedMedusaRequest): Promise<Autore> {
  const { actor_id: id, actor_type: tipo } = req.auth_context
  const { data } = await interroga(req).graph({ entity: tipo === "member" ? "member" : "user", fields: ["id", "email"], filters: { id } })
  return { id, nome: data[0]?.email ?? "Removed account" }
}

async function nomiAziende(req: AuthenticatedMedusaRequest, ids: (string | null)[]) {
  const presenti = [...new Set(ids.filter(Boolean))] as string[]
  if (!presenti.length) return new Map<string, string>()
  const { data } = await interroga(req).graph({ entity: "seller", fields: ["id", "name"], filters: { id: presenti } })
  return new Map<string, string>(data.map((a) => [a.id, a.name]))
}

/** Una richiesta fuori dall'ambito risponde come se non esistesse. */
async function richiestaVisibile(req: AuthenticatedMedusaRequest, ambito: Ambito) {
  const [richiesta] = await servizio(req).listRichiestas({ id: req.params.id }, { relations: ["messaggi"], take: 1 })
  if (!richiesta || (!ambito.staff && richiesta.azienda_id !== ambito.azienda)) throw richiestaNonTrovata()
  return richiesta
}

const numeroIntero = (valore: unknown, predefinito: number, massimo: number) => {
  const n = Number(valore)
  return valore !== undefined && Number.isInteger(n) && n >= 0 ? Math.min(n, massimo) : predefinito
}

export async function elencoRichieste(req: AuthenticatedMedusaRequest, res: MedusaResponse, ambito: Ambito) {
  const { stato, q } = req.query as { stato?: string; q?: string }
  const filtri: Record<string, unknown> = ambito.staff ? {} : { azienda_id: ambito.azienda }
  if (stato && (STATI as readonly string[]).includes(stato)) filtri.stato = stato
  if (q?.trim()) filtri.oggetto = { $ilike: `%${q.trim()}%` }

  const [righe, totale] = await servizio(req).listAndCountRichiestas(filtri, {
    order: { ultimo_messaggio_il: "DESC" },
    skip: numeroIntero(req.query.offset, 0, 100_000),
    take: numeroIntero(req.query.limit, 20, 100),
  })
  const aziende = ambito.staff ? await nomiAziende(req, righe.map((r) => r.azienda_id)) : new Map<string, string>()
  res.json({
    totale,
    richieste: righe.map((r) => ({
      id: r.id,
      oggetto: r.oggetto,
      categoria: r.categoria,
      stato: r.stato,
      azienda: r.azienda_id ? aziende.get(r.azienda_id) ?? null : null,
      aperta_il: r.created_at,
      ultimo_messaggio_il: r.ultimo_messaggio_il,
    })),
  })
}

export async function dettaglioRichiesta(req: AuthenticatedMedusaRequest, res: MedusaResponse, ambito: Ambito) {
  const richiesta = await richiestaVisibile(req, ambito)
  const aziende = ambito.staff ? await nomiAziende(req, [richiesta.azienda_id]) : new Map<string, string>()
  const messaggi = [...richiesta.messaggi].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
  res.json({
    richiesta: {
      id: richiesta.id,
      oggetto: richiesta.oggetto,
      categoria: richiesta.categoria,
      stato: richiesta.stato,
      azienda: richiesta.azienda_id ? aziende.get(richiesta.azienda_id) ?? null : null,
      aperta_da: richiesta.autore_nome,
      aperta_il: richiesta.created_at,
      messaggi: messaggi.map((m) => ({
        id: m.id,
        da_staff: m.da_staff,
        // Alle aziende non si mostra quale collaboratore ha risposto.
        autore: m.da_staff && !ambito.staff ? NOME_STAFF : m.autore_nome,
        testo: m.testo,
        quando: m.created_at,
      })),
    },
  })
}

export async function apriRichiesta(req: AuthenticatedMedusaRequest, res: MedusaResponse, ambito: Ambito) {
  const dati = valida(NuovaRichiesta, req.body)
  const autore = await autoreDi(req)
  const richiesta = await servizio(req).apri({ ...dati, azienda_id: ambito.azienda, autore, da_staff: ambito.staff })
  res.status(201).json({ richiesta: { id: richiesta.id, stato: richiesta.stato } })
}

export async function aggiungiMessaggio(req: AuthenticatedMedusaRequest, res: MedusaResponse, ambito: Ambito) {
  const { testo: contenuto } = valida(NuovoMessaggio, req.body)
  const richiesta = await richiestaVisibile(req, ambito)
  const autore = await autoreDi(req)
  const daRichiedente = !ambito.staff || (richiesta.azienda_id === null && richiesta.autore_id === autore.id)
  const aggiornata = await servizio(req).rispondi(richiesta.id, { testo: contenuto, autore, da_staff: ambito.staff, da_richiedente: daRichiedente })
  res.status(201).json({ richiesta: { id: aggiornata.id, stato: aggiornata.stato } })
}

export async function cambiaStato(req: AuthenticatedMedusaRequest, res: MedusaResponse, ambito: Ambito) {
  const { stato } = valida(CambioStato, req.body)
  const richiesta = await richiestaVisibile(req, ambito)
  // Un'azienda può solo chiudere o riaprire: «in attesa» nasce dalla risposta dello staff.
  if (!ambito.staff && stato === "in_attesa") throw invalido("Invalid status")
  const aggiornata = await servizio(req).updateRichiestas({ id: richiesta.id, stato })
  res.json({ richiesta: { id: aggiornata.id, stato: aggiornata.stato } })
}

export async function eliminaRichiesta(req: AuthenticatedMedusaRequest, res: MedusaResponse, ambito: Ambito) {
  const richiesta = await richiestaVisibile(req, ambito)
  await servizio(req).deleteRichiestas(richiesta.id)
  res.status(204).send()
}
