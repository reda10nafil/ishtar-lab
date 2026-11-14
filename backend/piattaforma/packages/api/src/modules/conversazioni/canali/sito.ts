import type { Valori } from "../../connectors/catalogo"
import type { EsitoProva } from "../../connectors/prova"
import { classificaRisposta, controllaCasella, ErroreSito, intestazioniChiave, MESSAGGIO_INDIRIZZO, type CodiceSito, type RigaCasella } from "./sito-regole"

/*
 * Client della casella della chat del sito (progetto Supabase dedicato): le funzioni del negozio su
 * POST /rest/v1/rpc/<nome> con la chiave segreta. Verificato in __tests__/sito.unit.spec.ts con la casella finta, che a
 * sua volta è confrontata con la Supabase locale (strumenti-prova/contratto-casella.mjs). La chiave va solo
 * all'indirizzo del progetto (controllaCasella), mai a un reindirizzamento; gli errori hanno testi fissi e non riportano
 * mai la chiave né il testo delle risposte.
 */

/** Versione del protocollo della casella che questo Ishtar Lab sa usare (chat_versione). */
export const VERSIONE_CASELLA = 1
const ATTESA_MS = 15_000

export const MESSAGGI_SITO: Record<CodiceSito, string> = {
  indirizzo: MESSAGGIO_INDIRIZZO,
  credenziali: "The chat project refused the secret key",
  lettore: "Another Ishtar Lab is reading this site chat: connect the chat project to one shop only",
  richiesta: "The site chat refused the request",
  servizio: "The site chat is not responding: try again shortly",
  rete: "The site chat can't be reached",
  versione: "Run the latest chat SQL on the project",
}

/** Rifiuti noti delle funzioni della casella (codici fissi scritti dall'SQL della chat, mai testo libero). */
const RIFIUTI: Record<string, string> = {
  unknown_visitor: "The visitor is no longer in the site chat",
  invalid_text: "The reply is empty or longer than 4000 characters",
}

export type OpzioniCasella = { chiama?: typeof fetch; attesaMs?: number }
export type RispostaScritta = { id: string; creato_il: string }

export function clientCasella({ url, chiave }: { url: string; chiave: string }, { chiama = fetch, attesaMs = ATTESA_MS }: OpzioniCasella = {}) {
  const { base, rif } = controllaCasella(url)
  const intestazioni = { "content-type": "application/json", accept: "application/json", ...intestazioniChiave(chiave) }

  async function rpc(nome: string, corpo: Record<string, unknown>): Promise<unknown> {
    let stato: number
    let testo: string
    try {
      const risposta = await chiama(`${base}/rest/v1/rpc/${nome}`, {
        method: "POST",
        headers: intestazioni,
        body: JSON.stringify(corpo),
        redirect: "error",
        signal: AbortSignal.timeout(attesaMs),
      })
      stato = risposta.status
      testo = await risposta.text()
    } catch {
      throw new ErroreSito("rete", MESSAGGI_SITO.rete)
    }
    let dati: unknown
    try {
      dati = testo ? JSON.parse(testo) : null
    } catch {
      dati = undefined
    }
    const esito = classificaRisposta(stato, dati)
    if (esito === "ok") {
      if (dati === undefined) throw new ErroreSito("servizio", MESSAGGI_SITO.servizio)
      return dati
    }
    const codice = dati && typeof dati === "object" ? (dati as { code?: unknown }).code : undefined
    const messaggio = dati && typeof dati === "object" ? String((dati as { message?: unknown }).message ?? "") : ""
    // Funzione assente: il progetto non ha (ancora) l'SQL della chat.
    if (stato === 404 && codice === "PGRST202") throw new ErroreSito("versione", MESSAGGI_SITO.versione)
    if (esito === "richiesta" && RIFIUTI[messaggio]) throw new ErroreSito("richiesta", RIFIUTI[messaggio])
    throw new ErroreSito(esito, MESSAGGI_SITO[esito])
  }

  const forma = (valido: boolean) => {
    if (!valido) throw new ErroreSito("servizio", MESSAGGI_SITO.servizio)
  }
  const scritta = (dati: unknown): RispostaScritta => {
    const r = dati as { id?: unknown; creato_il?: unknown } | null
    forma(typeof r?.id === "string" && typeof r?.creato_il === "string")
    return { id: r!.id as string, creato_il: r!.creato_il as string }
  }

  return {
    /** Riferimento del progetto (account del connettore e delle conversazioni); «locale» nelle prove. */
    rif,
    /** Versione del protocollo e nome del negozio scritti nella casella. */
    versione: async () => {
      const d = (await rpc("chat_versione", {})) as { versione?: unknown; nome?: unknown } | null
      return { versione: typeof d?.versione === "number" ? d.versione : null, nome: typeof d?.nome === "string" ? d.nome : null }
    },
    /** Messaggi dei visitatori da importare, i più vecchi prima; tiene il posto di lettore unico a `lettore`. */
    preleva: async (lettore: string, limite: number): Promise<RigaCasella[]> => {
      const d = await rpc("chat_preleva", { p_lettore: lettore, p_limite: limite })
      forma(Array.isArray(d))
      return d as RigaCasella[]
    },
    /** Segna come importati i messaggi registrati in Ishtar Lab; restituisce quanti erano ancora da importare. */
    conferma: async (lettore: string, ids: string[]): Promise<number> => {
      if (!ids.length) return 0
      const d = await rpc("chat_conferma", { p_lettore: lettore, p_ids: ids })
      forma(typeof d === "number")
      return d as number
    },
    /** Risposta del negozio al visitatore; lo stesso `id_client` la scrive una volta sola e restituisce la stessa. */
    rispondi: async (visitatore: string, id_client: string, testo: string, firma: string | null) =>
      scritta(await rpc("chat_rispondi", { p_visitatore: visitatore, p_id_client: id_client, p_testo: testo, p_firma: firma })),
    /** Risposta già scritta con questo `id_client`, oppure null. */
    verifica: async (id_client: string): Promise<RispostaScritta | null> => {
      const d = await rpc("chat_verifica", { p_id_client: id_client })
      return d === null ? null : scritta(d)
    },
  }
}

export type ClientCasella = ReturnType<typeof clientCasella>

/** Prova del connettore «Site chat»: la casella risponde con la chiave e parla la versione del protocollo di Ishtar Lab. */
export async function provaCasellaSito(valori: Valori, opzioni: OpzioniCasella = {}): Promise<EsitoProva> {
  try {
    const client = clientCasella({ url: valori.url, chiave: valori.chiave }, opzioni)
    const { versione } = await client.versione()
    if (versione !== VERSIONE_CASELLA) return { ok: false, errore: MESSAGGI_SITO.versione }
    return { ok: true, account: client.rif }
  } catch (errore) {
    return { ok: false, errore: errore instanceof ErroreSito ? errore.message : MESSAGGI_SITO.rete }
  }
}

/** Controlli del connettore prima della prova: indirizzo del progetto, chiave segreta (non quella pubblicabile), firma. */
export function validaSito(valori: Valori): string | null {
  try {
    controllaCasella(valori.url)
  } catch {
    return MESSAGGIO_INDIRIZZO
  }
  if (/^sb_publishable_/.test(valori.chiave?.trim() ?? "")) return "Use the secret key (sb_secret_…), not the publishable key"
  if ([...(valori.nome?.trim() ?? "")].length > 100) return "The name shown to visitors can be at most 100 characters"
  return null
}
