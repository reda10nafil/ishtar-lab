import { ImapFlow, type ImapFlowOptions } from "imapflow"
import SMTPConnection from "nodemailer/lib/smtp-connection"
import type { EsitoProva } from "../../connectors/prova"
import { destinazione, ErroreRete, proveLocali, type Destinazione, type Risolvi } from "./email-rete"
import { dominio } from "./email-regole"

/*
 * Connessioni alla casella email del negozio (IMAP per leggere, SMTP per rispondere) e prova del connettore. I registri
 * di imapflow e nodemailer sono spenti (scriverebbero utente, server e traffico) e i certificati sempre verificati.
 * Gli errori diventano testi fissi: le risposte dei server possono ripetere qualunque cosa.
 */

export type CredenzialiEmail = {
  indirizzo: string
  nome: string | null
  utente: string
  password: string
  imap_host: string
  imap_porta: number
  smtp_host: string
  smtp_porta: number
}

export function credenzialiEmail(valori: Record<string, string | undefined>): CredenzialiEmail {
  const indirizzo = (valori.indirizzo ?? "").trim().toLowerCase()
  const porta = (testo: string | undefined, predefinita: number) => (testo?.trim() ? Number(testo.trim()) : predefinita)
  return {
    indirizzo,
    nome: valori.nome?.trim() || null,
    utente: valori.utente?.trim() || indirizzo,
    password: valori.password ?? "",
    imap_host: (valori.imap_host ?? "").trim(),
    imap_porta: porta(valori.imap_porta, 993),
    smtp_host: (valori.smtp_host ?? "").trim(),
    smtp_porta: porta(valori.smtp_porta, 465),
  }
}

const ATTESA_MS = 15_000
const tlsDi = (dest: Destinazione) => ({ rejectUnauthorized: true, servername: dest.servername, minVersion: "TLSv1.2" as const })

export function opzioniImap(cred: CredenzialiEmail, dest: Destinazione): ImapFlowOptions {
  return {
    host: dest.indirizzo,
    port: dest.porta,
    secure: dest.tls === "implicito",
    doSTARTTLS: dest.tls === "starttls" ? true : dest.tls === "nessuno" ? false : undefined,
    servername: dest.servername,
    auth: { user: cred.utente, pass: cred.password },
    tls: tlsDi(dest),
    logger: false,
    emitLogs: false,
    disableAutoIdle: true,
    disableCompression: true,
    connectionTimeout: ATTESA_MS,
    greetingTimeout: ATTESA_MS,
    socketTimeout: 60_000,
  } as ImapFlowOptions
}

export function opzioniSmtp(cred: CredenzialiEmail, dest: Destinazione): SMTPConnection.Options {
  return {
    host: dest.indirizzo,
    port: dest.porta,
    secure: dest.tls === "implicito",
    requireTLS: dest.tls === "starttls",
    ignoreTLS: dest.tls === "nessuno",
    servername: dest.servername,
    name: dominio(cred.indirizzo) || "localhost",
    tls: tlsDi(dest),
    connectionTimeout: ATTESA_MS,
    greetingTimeout: ATTESA_MS,
    socketTimeout: 60_000,
    logger: false,
    debug: false,
    transactionLog: false,
  } as SMTPConnection.Options
}

const CERTIFICATO = new Set([
  "DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN", "CERT_HAS_EXPIRED", "CERT_NOT_YET_VALID", "ERR_TLS_CERT_ALTNAME_INVALID",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "UNABLE_TO_GET_ISSUER_CERT", "CERT_UNTRUSTED", "CERT_REVOKED",
])

export type TipoErrore = "credenziali" | "certificato" | "rete"

export function classificaErrore(errore: unknown): TipoErrore {
  const e = errore as { authenticationFailed?: boolean; code?: string; serverResponseCode?: string; cause?: { code?: string } } | null
  if (e?.authenticationFailed || e?.code === "EAUTH" || e?.serverResponseCode === "AUTHENTICATIONFAILED") return "credenziali"
  if ((e?.code && CERTIFICATO.has(e.code)) || (e?.cause?.code && CERTIFICATO.has(e.cause.code))) return "certificato"
  return "rete"
}

export const MESSAGGI_ERRORE: Record<TipoErrore, string> = {
  credenziali: "The mailbox refused the username or password",
  certificato: "The server's security certificate is not valid",
  rete: "The mail server can't be reached",
}

/** Client IMAP con la gestione degli errori: imapflow emette «error» e senza ascoltatore il processo cadrebbe. */
export function nuovoImap(cred: CredenzialiEmail, dest: Destinazione): ImapFlow {
  const client = new ImapFlow(opzioniImap(cred, dest))
  client.on("error", () => {})
  return client
}

async function provaImap(cred: CredenzialiEmail, dest: Destinazione): Promise<void> {
  const client = nuovoImap(cred, dest)
  try {
    await client.connect()
    await client.mailboxOpen("INBOX", { readOnly: true })
  } finally {
    await client.logout().catch(() => client.close())
  }
}

/** Connessione SMTP aperta e autenticata (senza login solo con i server finti delle prove, che non lo chiedono). */
export function apriSmtp(cred: CredenzialiEmail, dest: Destinazione): Promise<SMTPConnection> {
  return new Promise((ok, ko) => {
    const connessione = new SMTPConnection(opzioniSmtp(cred, dest))
    let finito = false
    const fallisci = (errore: unknown) => {
      if (finito) return
      finito = true
      connessione.close()
      ko(errore)
    }
    connessione.once("error", fallisci)
    connessione.connect(() => {
      if (!(connessione as unknown as { allowsAuth: boolean }).allowsAuth) {
        if (proveLocali()) { finito = true; return ok(connessione) }
        return fallisci(Object.assign(new Error("Login not offered by the server"), { code: "EAUTH" }))
      }
      connessione.login({ user: cred.utente, pass: cred.password }, (errore) => {
        if (errore) return fallisci(errore)
        finito = true
        ok(connessione)
      })
    })
  })
}

async function provaSmtp(cred: CredenzialiEmail, dest: Destinazione): Promise<void> {
  const connessione = await apriSmtp(cred, dest)
  connessione.quit()
}

/** Prova del connettore «Shop mailbox»: login IMAP con la Posta in arrivo in sola lettura, login SMTP; nessun invio. */
export async function provaCasella(valori: Record<string, string | undefined>, risolvi?: Risolvi): Promise<EsitoProva> {
  const cred = credenzialiEmail(valori)
  try {
    await provaImap(cred, await destinazione(cred.imap_host, cred.imap_porta, "imap", risolvi))
    await provaSmtp(cred, await destinazione(cred.smtp_host, cred.smtp_porta, "smtp", risolvi))
    return { ok: true, account: cred.indirizzo }
  } catch (errore) {
    if (errore instanceof ErroreRete) return { ok: false, errore: errore.message }
    return { ok: false, errore: MESSAGGI_ERRORE[classificaErrore(errore)] }
  }
}
