import type { InArrivo } from "../tipi"
import { pulisci } from "./email-regole"

/*
 * Regole pure della chat del sito (provate in __tests__/sito-regole.unit.spec.ts). I messaggi dei visitatori aspettano in
 * una casella su un progetto Supabase dedicato; Ishtar Lab la legge con una chiave segreta usata solo da lui. Si accetta
 * solo l'indirizzo del progetto (mai un server qualsiasi a cui mandare la chiave) e in Ishtar Lab entrano solo gli
 * identificativi generati dalla casella. Nome, email e pagina li scrive il visitatore: sono dati, non prove.
 */

export type CodiceSito = "indirizzo" | "credenziali" | "lettore" | "richiesta" | "servizio" | "rete" | "versione"

/** Errore della chat del sito con un messaggio fisso da mostrare così com'è. */
export class ErroreSito extends Error {
  constructor(public codice: CodiceSito, messaggio: string) {
    super(messaggio)
    this.name = "ErroreSito"
  }
}

/** Riga restituita da chat_preleva. */
export type RigaCasella = {
  id: string
  visitatore: string
  testo: string
  pagina?: string | null
  nome?: string | null
  email?: string | null
  creato_il: string
}

export const MESSAGGIO_INDIRIZZO = "Enter the project URL, for example https://abcdefghijklmnopqrst.supabase.co"
const PROGETTO = /^([a-z]{20})\.supabase\.co$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z0-9-]{2,}$/i
const MASSIMO_NOME = 100
const MASSIMO_EMAIL = 254
const MASSIMO_TESTO = 4000
const MASSIMO_PAGINA = 500

/** Modalità delle prove: la casella locale (Supabase della CLI o finta) su 127.0.0.1, mai in produzione. */
export const proveLocaliSito = () => process.env.SITO_PROVE_LOCALI === "1" && process.env.NODE_ENV !== "production"

/** Indirizzo della casella: solo il progetto Supabase (https://<rif>.supabase.co) o, nelle prove, 127.0.0.1. */
export function controllaCasella(indirizzo: string): { base: string; rif: string } {
  let url: URL
  try {
    url = new URL(String(indirizzo ?? "").trim())
  } catch {
    throw new ErroreSito("indirizzo", MESSAGGIO_INDIRIZZO)
  }
  const pulito = !url.username && !url.password && !url.search && !url.hash && (url.pathname === "/" || url.pathname === "")
  if (pulito && url.protocol === "https:" && !url.port) {
    const rif = PROGETTO.exec(url.hostname)?.[1]
    if (rif) return { base: `https://${url.hostname}`, rif }
  }
  if (pulito && proveLocaliSito() && url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port) {
    return { base: `http://127.0.0.1:${url.port}`, rif: "locale" }
  }
  throw new ErroreSito("indirizzo", MESSAGGIO_INDIRIZZO)
}

const taglia = (testo: string, massimo: number) => {
  const caratteri = [...testo]
  return caratteri.length > massimo ? caratteri.slice(0, massimo).join("") : testo
}

/** Pagina da cui il visitatore ha scritto: solo origine e percorso (la query può contenere dati personali). */
function paginaPulita(pagina: string | null | undefined): string | null {
  try {
    const url = new URL(String(pagina ?? ""))
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    return taglia(`${url.origin}${url.pathname}`, MASSIMO_PAGINA)
  } catch {
    return null
  }
}

/** Dalla riga della casella al messaggio della casella dei clienti; null se la riga non ha gli identificativi della casella. */
export function rigaInArrivo(riga: RigaCasella, rif: string): InArrivo | null {
  if (!UUID.test(riga?.id ?? "") || !UUID.test(riga?.visitatore ?? "")) return null
  const nome = riga.nome?.trim() ? taglia(riga.nome.trim(), MASSIMO_NOME) : null
  const email = riga.email?.trim().toLowerCase() ?? ""
  const quando = new Date(riga.creato_il)
  return pulisci({
    canale: "sito" as const,
    account: rif,
    id_contatto: riga.visitatore.toLowerCase(),
    nome,
    recapito: email.length <= MASSIMO_EMAIL && EMAIL.test(email) ? email : null,
    id_messaggio: riga.id.toLowerCase(),
    testo: taglia(String(riga.testo ?? ""), MASSIMO_TESTO),
    quando: Number.isNaN(quando.getTime()) ? new Date() : quando,
    dettagli: { pagina: paginaPulita(riga.pagina), dichiarato: true },
  })
}

/** Esito di una chiamata alla casella dallo stato HTTP e dal corpo (PostgREST mette il testo dell'errore SQL in message). */
export function classificaRisposta(stato: number, corpo?: unknown): CodiceSito | "ok" {
  if (stato >= 200 && stato < 300) return "ok"
  const testo = corpo && typeof corpo === "object" ? String((corpo as { message?: unknown }).message ?? "") : String(corpo ?? "")
  if (/\breader_busy\b/.test(testo)) return "lettore"
  if (stato === 401 || stato === 403) return "credenziali"
  if (stato >= 400 && stato < 500) return "richiesta"
  if (stato >= 500) return "servizio"
  return "rete"
}

/** Intestazioni della chiave del negozio: sempre `apikey`; una chiave JWT (quella vecchia di Supabase) anche come Bearer. */
export function intestazioniChiave(chiave: string): Record<string, string> {
  const pulita = String(chiave ?? "").trim()
  return /^[\w-]+\.[\w-]+\.[\w-]+$/.test(pulita) ? { apikey: pulita, authorization: `Bearer ${pulita}` } : { apikey: pulita }
}
