import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import { indirizzoPubblico } from "../../connectors/rete-pubblica"

/*
 * Dove collegarsi per la casella email del negozio. Host e porte li scrive chi configura il connettore: si accettano solo
 * server pubblici (niente Postgres, Redis o altri servizi interni), sempre con TLS (password mai in chiaro), e ci si
 * collega all'indirizzo verificato con il nome per il certificato (nessuna seconda risoluzione DNS fra controllo e
 * connessione). Solo con EMAIL_PROVE_LOCALI=1, fuori dalla produzione, si ammette questo computer senza TLS, per le prove
 * con i server finti.
 */

export type ModoTls = "implicito" | "starttls" | "nessuno"
export type Destinazione = { indirizzo: string; servername: string; porta: number; tls: ModoTls }
export type Risolvi = (host: string) => Promise<{ address: string; family?: number }[]>

/** Errore di configurazione della rete, con un messaggio fisso da mostrare così com'è. */
export class ErroreRete extends Error {}

export const proveLocali = () => process.env.EMAIL_PROVE_LOCALI === "1" && process.env.NODE_ENV !== "production"
const LOCALI = new Set(["127.0.0.1", "localhost", "::1"])
const NOME_SERVER = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/

export async function destinazione(
  host: string,
  porta: number,
  tipo: "imap" | "smtp",
  risolvi: Risolvi = (nome) => lookup(nome, { all: true, verbatim: true })
): Promise<Destinazione> {
  const nome = host.trim().toLowerCase().replace(/^\[|\]$/g, "")
  if (!NOME_SERVER.test(nome) && !isIP(nome)) throw new ErroreRete("Enter only the server name, for example imap.gmail.com")
  if (proveLocali() && LOCALI.has(nome)) return { indirizzo: nome === "localhost" ? "127.0.0.1" : nome, servername: nome, porta, tls: "nessuno" }
  if (tipo === "imap" && porta !== 993) throw new ErroreRete("Use port 993 (SSL) for IMAP")
  if (tipo === "smtp" && porta !== 465 && porta !== 587) throw new ErroreRete("Use port 465 (SSL) or 587 (STARTTLS) for SMTP")
  let indirizzi: { address: string }[]
  try {
    indirizzi = isIP(nome) ? [{ address: nome }] : await risolvi(nome)
  } catch {
    throw new ErroreRete("The mail server can't be reached")
  }
  if (!indirizzi.length || indirizzi.some((a) => !indirizzoPubblico(a.address))) throw new ErroreRete("This server is not reachable on the public internet")
  return { indirizzo: indirizzi[0].address, servername: nome, porta, tls: tipo === "smtp" && porta === 587 ? "starttls" : "implicito" }
}
