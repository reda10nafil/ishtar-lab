import { Readable } from "node:stream"
import MailComposer from "nodemailer/lib/mail-composer"
import type SMTPConnection from "nodemailer/lib/smtp-connection"
import { NON_CONFERMATO, type EsitoUscita } from "../service"
import { apriSmtp, classificaErrore, daCorreggere, MESSAGGI_ERRORE, type CredenzialiEmail } from "./email-connessioni"
import { destinazione, ErroreRete, type Risolvi } from "./email-rete"

/*
 * Invio di una risposta del team per email (SMTP), a fasi: composizione, collegamento e accesso, busta (MAIL FROM, RCPT
 * TO, DATA), contenuto. Prima del contenuto nulla può essere arrivato: ogni errore è «fallito». Dopo l'inizio del
 * contenuto un rifiuto con un codice del server resta «fallito», mentre una caduta della connessione, un timeout o un
 * errore di rete lasciano il dubbio: «incerto», e con lo stesso id la risposta non si rimanda mai.
 */

export type RispostaEmail = { a: string; oggetto: string; testo: string; messageId: string; inReplyTo?: string | null; references: string[] }
/** `daSegnalare`: errore della configurazione da mostrare sul connettore (password, certificato, server non ammesso). */
export type EsitoInvioEmail = { esito: EsitoUscita; daSegnalare?: string }

const fallito = (errore: string): EsitoUscita => ({ stato: "fallito", errore })

export async function inviaEmail(
  cred: CredenzialiEmail,
  risposta: RispostaEmail,
  { primaDellInvio, risolvi }: { primaDellInvio: () => Promise<void>; risolvi?: Risolvi }
): Promise<EsitoInvioEmail> {
  const grezzo = await componi(cred, risposta)
  let connessione: SMTPConnection
  try {
    connessione = await apriSmtp(cred, await destinazione(cred.smtp_host, cred.smtp_porta, "smtp", risolvi))
  } catch (errore) {
    return erroreDiAccesso(errore)
  }
  // Gli errori arrivano anche al callback dell'invio: questo ascoltatore evita solo che un secondo «error» fermi l'API.
  connessione.on("error", () => {})
  const contenuto = new Contenuto(grezzo, primaDellInvio)
  try {
    await spedisci(connessione, { from: cred.indirizzo, to: [risposta.a] }, contenuto)
    connessione.quit()
    return { esito: { stato: "inviato", id_esterno: risposta.messageId } }
  } catch (errore) {
    connessione.close()
    if (contenuto.errorePrima) throw contenuto.errorePrima
    if ((errore as { responseCode?: number }).responseCode) return { esito: fallito(`The mail server refused the email: ${rispostaServer(errore)}`) }
    if (contenuto.partito) return { esito: { stato: "incerto", errore: NON_CONFERMATO } }
    return { esito: fallito(MESSAGGI_ERRORE.rete) }
  }
}

function componi(cred: CredenzialiEmail, r: RispostaEmail): Promise<Buffer> {
  return new MailComposer({
    from: cred.nome ? { name: cred.nome, address: cred.indirizzo } : cred.indirizzo,
    to: r.a,
    subject: r.oggetto,
    text: r.testo,
    messageId: r.messageId,
    inReplyTo: r.inReplyTo ?? undefined,
    references: r.references.length ? r.references : undefined,
    date: new Date(),
  }).compile().build()
}

function spedisci(connessione: SMTPConnection, busta: SMTPConnection.Envelope, contenuto: Readable): Promise<void> {
  return new Promise((ok, ko) => connessione.send(busta, contenuto, (errore) => (errore ? ko(errore) : ok())))
}

/**
 * Contenuto dell'email. Il client lo legge solo dopo che il server ha accettato DATA (con un rifiuto della busta lo
 * distrugge senza leggerlo): alla prima lettura si segna il tentativo, poi passano i dati. `partito`: da qui l'email
 * forse è arrivata.
 */
class Contenuto extends Readable {
  partito = false
  errorePrima: unknown = null
  private iniziato = false

  constructor(private readonly dati: Buffer, private readonly prima: () => Promise<void>) {
    super()
  }

  _read() {
    if (this.iniziato) return
    this.iniziato = true
    this.prima().then(
      () => {
        if (this.destroyed) return
        this.partito = true
        this.push(this.dati)
        this.push(null)
      },
      (errore) => {
        this.errorePrima = errore
        this.destroy(errore instanceof Error ? errore : new Error("The attempt could not be recorded"))
      }
    )
  }
}

/** Risposta del server su una riga, senza caratteri di controllo e al massimo 200 caratteri. */
function rispostaServer(errore: unknown): string {
  const e = errore as { response?: unknown; responseCode?: number }
  const testo = typeof e.response === "string" && e.response.trim() ? e.response : String(e.responseCode ?? "")
  return testo.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 200)
}

function erroreDiAccesso(errore: unknown): EsitoInvioEmail {
  if (errore instanceof ErroreRete) return errore.transitoria ? { esito: fallito(errore.message) } : { esito: fallito(errore.message), daSegnalare: errore.message }
  const tipo = classificaErrore(errore)
  const messaggio = MESSAGGI_ERRORE[tipo]
  return daCorreggere(tipo) ? { esito: fallito(messaggio), daSegnalare: messaggio } : { esito: fallito(messaggio) }
}
