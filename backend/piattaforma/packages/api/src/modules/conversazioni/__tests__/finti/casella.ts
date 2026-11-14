import { randomUUID } from "node:crypto"
import http from "node:http"
import type { AddressInfo } from "node:net"

/*
 * Casella finta della chat del sito per le prove (solo node:http): le funzioni del negozio della casella su Supabase
 * (chat_versione, chat_preleva, chat_conferma, chat_rispondi, chat_verifica) su POST /rest/v1/rpc/<nome>, con gli errori
 * nel formato di PostgREST ({ code, message }, stato HTTP dal codice PTxyz). I messaggi dei visitatori si aggiungono a
 * mano; guasti a comando: stato fisso, lentezza, caduta dopo la scrittura della risposta, conferma persa, funzioni assenti
 * (404 PGRST202, come un progetto senza l'SQL della chat). Le stesse
 * richieste si confrontano con la Supabase locale in strumenti-prova/contratto-casella.mjs.
 */

export type MessaggioFinto = {
  id: string
  visitatore: string
  direzione: "entrata" | "uscita"
  id_client: string
  testo: string
  pagina: string | null
  firma: string | null
  creato_il: string
  importato_il: string | null
}
export type GuastiCasella = { stato?: number; lento?: number; cadeDopoScrittura?: boolean; confermaPersa?: boolean; assenti?: string[] }
export type CasellaFinta = {
  base: string
  porta: number
  negozio: { versione: number; nome: string; lettore: string | null; battito: string | null }
  visitatori: Map<string, { nome: string | null; email: string | null }>
  messaggi: MessaggioFinto[]
  guasti: GuastiCasella
  /** Nomi delle funzioni chiamate, in ordine (mai la chiave). */
  chiamate: string[]
  aggiungiDalVisitatore: (dati: { visitatore?: string; id_client?: string; testo: string; pagina?: string | null; nome?: string | null; email?: string | null }) => MessaggioFinto
  chiudi: () => Promise<void>
}

const ID_CLIENT = /^[A-Za-z0-9_-]{8,80}$/
// Campi espliciti, non «parameter properties»: Node legge questo file anche togliendo solo i tipi (strumenti-prova).
class ErroreRpc extends Error {
  stato: number
  codice: string
  constructor(stato: number, codice: string, messaggio: string) {
    super(messaggio)
    this.stato = stato
    this.codice = codice
  }
}

export async function avviaCasellaFinta({ chiave, porta = 0 }: { chiave: string; porta?: number }): Promise<CasellaFinta> {
  const prese = new Set<import("node:net").Socket>()
  let orologio = Date.now()
  // Orari sempre crescenti, come clock_timestamp(): due messaggi nello stesso millisecondo restano in ordine.
  const ora = () => new Date((orologio = Math.max(orologio + 1, Date.now()))).toISOString()

  const finta: CasellaFinta = {
    base: "",
    porta: 0,
    negozio: { versione: 1, nome: "Shop", lettore: null, battito: null },
    visitatori: new Map(),
    messaggi: [],
    guasti: {},
    chiamate: [],
    aggiungiDalVisitatore({ visitatore = randomUUID(), id_client = `v-${randomUUID().slice(0, 12)}`, testo, pagina = null, nome = null, email = null }) {
      const prima = finta.visitatori.get(visitatore)
      finta.visitatori.set(visitatore, { nome: nome ?? prima?.nome ?? null, email: email?.toLowerCase() ?? prima?.email ?? null })
      const esistente = finta.messaggi.find((m) => m.visitatore === visitatore && m.id_client === id_client && m.direzione === "entrata")
      if (esistente) return esistente
      const m: MessaggioFinto = { id: randomUUID(), visitatore, direzione: "entrata", id_client, testo, pagina, firma: null, creato_il: ora(), importato_il: null }
      finta.messaggi.push(m)
      return m
    },
    chiudi: () => new Promise((ok) => { for (const p of prese) p.destroy(); server.close(() => ok()) }),
  }

  const funzioni: Record<string, (p: Record<string, any>, res: http.ServerResponse) => unknown> = {
    chat_versione: () => ({ versione: finta.negozio.versione, nome: finta.negozio.nome }),
    chat_preleva: ({ p_lettore, p_limite }) => {
      if (typeof p_lettore !== "string" || p_lettore.length < 1 || p_lettore.length > 100) throw new ErroreRpc(400, "PT400", "invalid_reader")
      const { lettore, battito } = finta.negozio
      if (lettore && lettore !== p_lettore && battito && Date.parse(battito) > Date.now() - 10 * 60_000) throw new ErroreRpc(409, "PT409", "reader_busy")
      finta.negozio.lettore = p_lettore
      finta.negozio.battito = new Date().toISOString()
      const limite = Math.min(Math.max(Number(p_limite) || 50, 1), 200)
      return finta.messaggi
        .filter((m) => m.direzione === "entrata" && !m.importato_il)
        .sort((a, b) => a.creato_il.localeCompare(b.creato_il) || a.id.localeCompare(b.id))
        .slice(0, limite)
        .map((m) => ({ id: m.id, visitatore: m.visitatore, testo: m.testo, pagina: m.pagina, nome: finta.visitatori.get(m.visitatore)?.nome ?? null, email: finta.visitatori.get(m.visitatore)?.email ?? null, creato_il: m.creato_il }))
    },
    chat_conferma: ({ p_lettore, p_ids }, res) => {
      if (finta.negozio.lettore !== p_lettore) throw new ErroreRpc(409, "PT409", "reader_busy")
      const ids = new Set(Array.isArray(p_ids) ? p_ids : [])
      let conferme = 0
      for (const m of finta.messaggi) {
        if (ids.has(m.id) && m.direzione === "entrata" && !m.importato_il) { m.importato_il = ora(); conferme += 1 }
      }
      if (finta.guasti.confermaPersa) { res.destroy(); return undefined }
      return conferme
    },
    chat_rispondi: ({ p_visitatore, p_id_client, p_testo, p_firma }, res) => {
      if (typeof p_id_client !== "string" || !ID_CLIENT.test(p_id_client)) throw new ErroreRpc(400, "PT400", "invalid_id")
      if (typeof p_testo !== "string" || !p_testo.trim() || [...p_testo].length > 4000) throw new ErroreRpc(400, "PT400", "invalid_text")
      if (!finta.visitatori.has(p_visitatore)) throw new ErroreRpc(404, "PT404", "unknown_visitor")
      let m = finta.messaggi.find((x) => x.id_client === p_id_client && x.direzione === "uscita")
      if (m && m.visitatore !== p_visitatore) throw new ErroreRpc(409, "PT409", "id_conflict")
      if (!m) {
        m = { id: randomUUID(), visitatore: p_visitatore, direzione: "uscita", id_client: p_id_client, testo: p_testo, pagina: null, firma: typeof p_firma === "string" && p_firma.trim() ? p_firma.trim().slice(0, 100) : null, creato_il: ora(), importato_il: null }
        finta.messaggi.push(m)
      }
      if (finta.guasti.cadeDopoScrittura) { res.destroy(); return undefined }
      return { id: m.id, creato_il: m.creato_il }
    },
    chat_verifica: ({ p_id_client }) => {
      const m = finta.messaggi.find((x) => x.id_client === p_id_client && x.direzione === "uscita")
      return m ? { id: m.id, creato_il: m.creato_il } : null
    },
  }

  const leggiCorpo = (req: http.IncomingMessage) => new Promise<string>((ok) => {
    let dati = ""
    req.on("data", (c) => { dati += c })
    req.on("end", () => ok(dati))
  })
  const json = (res: http.ServerResponse, stato: number, valore: unknown) => {
    if (res.destroyed) return
    res.writeHead(stato, { "content-type": "application/json; charset=utf-8" })
    res.end(JSON.stringify(valore))
  }

  const server = http.createServer(async (req, res) => {
    const percorso = new URL(req.url ?? "/", "http://x").pathname
    const corpo = await leggiCorpo(req)
    if (percorso.startsWith("/_prova/")) {
      const dati = corpo ? JSON.parse(corpo) : {}
      if (percorso === "/_prova/visitatore") return json(res, 200, finta.aggiungiDalVisitatore(dati))
      if (percorso === "/_prova/guasti") { finta.guasti = dati; return json(res, 200, { ok: true }) }
      if (percorso === "/_prova/stato") return json(res, 200, { negozio: finta.negozio, messaggi: finta.messaggi, chiamate: finta.chiamate })
      return json(res, 404, { message: "unknown test route" })
    }
    const nome = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(percorso)?.[1]
    if (req.method !== "POST" || !nome || !funzioni[nome]) return json(res, 404, { code: "PGRST202", message: "Could not find the function" })
    finta.chiamate.push(nome)
    if (req.headers.apikey !== chiave) return json(res, 401, { message: "Invalid API key" })
    if (finta.guasti.lento) await new Promise((ok) => setTimeout(ok, finta.guasti.lento))
    if (finta.guasti.stato) return json(res, finta.guasti.stato, { code: "XX000", message: "fake failure" })
    if (finta.guasti.assenti?.includes(nome)) {
      return json(res, 404, { code: "PGRST202", details: null, hint: null, message: `Could not find the function public.${nome} in the schema cache` })
    }
    try {
      const esito = funzioni[nome](corpo ? JSON.parse(corpo) : {}, res)
      if (!res.destroyed) json(res, 200, esito)
    } catch (errore) {
      if (errore instanceof ErroreRpc) return json(res, errore.stato, { code: errore.codice, details: null, hint: null, message: errore.message })
      return json(res, 500, { code: "XX000", message: "fake error" })
    }
  })
  server.on("connection", (presa) => { prese.add(presa); presa.on("close", () => prese.delete(presa)) })
  await new Promise<void>((ok) => server.listen(porta, "127.0.0.1", () => ok()))
  finta.porta = (server.address() as AddressInfo).port
  finta.base = `http://127.0.0.1:${finta.porta}`
  return finta
}
