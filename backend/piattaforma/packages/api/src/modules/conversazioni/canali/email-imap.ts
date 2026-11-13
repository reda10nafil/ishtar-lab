import type { FetchMessageObject, FetchQueryObject, ImapFlow, MailboxObject } from "imapflow"
import type { InArrivo } from "../tipi"
import { nuovoImap, type CredenzialiEmail } from "./email-connessioni"
import { bustaDaTestata, ILLEGGIBILE, traduciEmail, type Busta } from "./email-regole"
import { destinazione, type Risolvi } from "./email-rete"

/*
 * Lettura della Posta in arrivo del negozio e registrazione delle email lette. Sempre in sola lettura: EXAMINE, UID SEARCH
 * e UID FETCH con PEEK, quindi nessuna email segnata come letta, spostata o cancellata. Il punto di lettura è UIDVALIDITY
 * più l'ultimo UID e si salva dopo ogni email: un guasto a metà riparte dalla prima non registrata. Il primo collegamento
 * non importa la posta già presente; se il server rinumera la casella (UIDVALIDITY nuova) si rileggono solo le email da
 * ieri, e la chiave unica dei messaggi (il Message-ID) evita i doppioni. Per giro al massimo 50 email e circa 25 MB; le
 * email oltre 10 MB non si scaricano (si registra la busta con un segnaposto).
 */

export type CursoreEmail = { uidvalidity: string; ultimo_uid: number }
export type EmailLetta = { uid: number; grezzo: Buffer | null; internaldate: Date; dimensione: number; busta?: Busta }
/**
 * `cursoreFinale`: dove portare il punto di lettura quando le email del giro sono registrate, se va oltre l'ultima (primo
 * collegamento, casella rinumerata letta tutta); null: resta sull'ultima registrata.
 */
export type Lettura = { uidvalidity: string; messaggi: EmailLetta[]; cursoreFinale: CursoreEmail | null }
export type OpzioniLettura = { massimo?: number; byteGiro?: number; risolvi?: Risolvi }

export const LIMITE_EMAIL = 10 * 1024 * 1024
const LIMITE_GIRO = 25 * 1024 * 1024
const DA_IERI = 24 * 3600 * 1000

/** Un giro di lettura: client nuovo, Posta in arrivo in sola lettura, le email dopo il cursore (le più vecchie prima). */
export async function leggiCasella(
  cred: CredenzialiEmail,
  cursore: CursoreEmail | null,
  { massimo = 50, byteGiro = LIMITE_GIRO, risolvi }: OpzioniLettura = {}
): Promise<Lettura> {
  const client = nuovoImap(cred, await destinazione(cred.imap_host, cred.imap_porta, "imap", risolvi))
  try {
    await client.connect()
    const casella = await client.mailboxOpen("INBOX", { readOnly: true })
    const uidvalidity = String(casella.uidValidity)
    const presente = await ultimoUid(client, casella)
    if (!cursore) return { uidvalidity, messaggi: [], cursoreFinale: { uidvalidity, ultimo_uid: presente } }
    const rinumerata = cursore.uidvalidity !== uidvalidity
    const dopo = rinumerata ? 0 : cursore.ultimo_uid
    // «n:*» comprende sempre l'ultimo messaggio, anche se ha un UID più basso: si tengono solo gli UID dopo il cursore.
    const trovati = await client.search(rinumerata ? { since: new Date(Date.now() - DA_IERI) } : { uid: `${dopo + 1}:*` }, { uid: true })
    if (!Array.isArray(trovati)) throw new Error("The mailbox refused the search")
    const nuovi = [...new Set(trovati)].filter((uid) => uid > dopo).sort((a, b) => a - b)
    const messaggi = await scarica(client, nuovi.slice(0, massimo), byteGiro)
    const lettaTutta = messaggi.length === nuovi.length
    return { uidvalidity, messaggi, cursoreFinale: rinumerata && lettaTutta ? { uidvalidity, ultimo_uid: presente } : null }
  } finally {
    await client.logout().catch(() => client.close())
  }
}

/** UID più alto già presente: UIDNEXT − 1, oppure (server che non dice UIDNEXT) l'UID dell'ultimo messaggio. */
async function ultimoUid(client: ImapFlow, casella: MailboxObject): Promise<number> {
  const prossimo = Number(casella.uidNext)
  if (Number.isSafeInteger(prossimo) && prossimo > 0) return prossimo - 1
  if (!casella.exists) return 0
  let ultimo = 0
  for await (const m of client.fetch("*", { uid: true }, { uid: true })) ultimo = Math.max(ultimo, m.uid)
  return ultimo
}

/**
 * Dimensione, data e contenuto (o solo la testata, oltre 10 MB) delle email scelte, entro i byte del giro e sempre almeno
 * una. Si ferma alla prima email che il server non restituisce: il cursore non salta mai un'email non letta.
 */
async function scarica(client: ImapFlow, uids: number[], byteGiro: number): Promise<EmailLetta[]> {
  if (!uids.length) return []
  const dati = new Map<number, { dimensione: number; internaldate: Date }>()
  for await (const m of client.fetch(uids.join(","), { uid: true, size: true, internalDate: true }, { uid: true })) {
    dati.set(m.uid, { dimensione: Number(m.size) || 0, internaldate: dataValida(m.internalDate) })
  }
  const scelti: number[] = []
  let byte = 0
  for (const uid of uids) {
    const d = dati.get(uid)
    if (!d) break
    const peso = d.dimensione > LIMITE_EMAIL ? 0 : d.dimensione
    if (scelti.length && byte + peso > byteGiro) break
    byte += peso
    scelti.push(uid)
  }
  const grande = (uid: number) => (dati.get(uid)?.dimensione ?? 0) > LIMITE_EMAIL
  const contenuti = await raccogli(client, scelti.filter((uid) => !grande(uid)), { source: true }, (m) => m.source)
  const testate = await raccogli(client, scelti.filter(grande), { headers: true }, (m) => m.headers)
  const lette: EmailLetta[] = []
  for (const uid of scelti) {
    const { dimensione, internaldate } = dati.get(uid)!
    if (grande(uid)) {
      const testata = testate.get(uid)
      if (!testata) break
      lette.push({ uid, grezzo: null, internaldate, dimensione, busta: await bustaDaTestata(testata) })
    } else {
      const grezzo = contenuti.get(uid)
      if (!grezzo) break
      lette.push({ uid, grezzo, internaldate, dimensione })
    }
  }
  return lette
}

/** Una UID FETCH per più email; il generatore va consumato tutto prima del comando successivo. */
async function raccogli(
  client: ImapFlow,
  uids: number[],
  richiesta: FetchQueryObject,
  valore: (m: FetchMessageObject) => Buffer | undefined
): Promise<Map<number, Buffer>> {
  const fuori = new Map<number, Buffer>()
  if (!uids.length) return fuori
  for await (const m of client.fetch(uids.join(","), { uid: true, ...richiesta }, { uid: true })) {
    const v = valore(m)
    if (v) fuori.set(m.uid, v)
  }
  return fuori
}

function dataValida(valore: Date | string | undefined): Date {
  const data = valore instanceof Date ? valore : valore ? new Date(valore) : null
  return data && !Number.isNaN(data.getTime()) ? data : new Date()
}

export type Registrazione = {
  account: string
  registra: (e: InArrivo) => Promise<unknown>
  rimbalzo: (message_id: string, motivo: string) => Promise<unknown>
  salva: (cursore: CursoreEmail) => Promise<unknown>
}
export type EsitoRegistrazione = { registrati: number; rimbalzi: number; scartati: number }

/**
 * Registra le email lette, in ordine: messaggi dei clienti nella casella, rimbalzi sulle nostre risposte, automatiche e
 * nostre saltate. Il cursore si salva dopo ogni email; un errore ferma il giro e l'email si rilegge al giro dopo.
 */
export async function elaboraEmail({ uidvalidity, messaggi, cursoreFinale }: Lettura, d: Registrazione): Promise<EsitoRegistrazione> {
  const esito = { registrati: 0, rimbalzi: 0, scartati: 0 }
  let salvato = -1
  for (const m of messaggi) {
    const tradotta = await traduciEmail(m.grezzo, { account: d.account, uid: m.uid, uidvalidity, internaldate: m.internaldate, busta: m.busta })
    if (tradotta.tipo === "messaggio") {
      await registraConRiserva(d.registra, tradotta.inArrivo)
      esito.registrati += 1
    } else if (tradotta.tipo === "rimbalzo" && tradotta.message_id_originale) {
      await d.rimbalzo(tradotta.message_id_originale, tradotta.motivo)
      esito.rimbalzi += 1
    } else {
      esito.scartati += 1
    }
    await d.salva({ uidvalidity, ultimo_uid: m.uid })
    salvato = m.uid
  }
  if (cursoreFinale && cursoreFinale.ultimo_uid > salvato) await d.salva(cursoreFinale)
  return esito
}

/**
 * Un secondo tentativo per i guasti passeggeri, poi il segnaposto senza contenuto: un'email che il database rifiuta per ciò
 * che contiene non ferma la lettura di tutte le altre. Se non entra neppure il segnaposto il guasto è del database: si
 * lancia il primo errore e il cursore resta fermo.
 */
async function registraConRiserva(registra: Registrazione["registra"], e: InArrivo): Promise<void> {
  try {
    await registra(e)
  } catch (primo) {
    try {
      await registra(e)
      return
    } catch {
      // si prova il segnaposto
    }
    try {
      await registra({ ...e, testo: ILLEGGIBILE, nome: null, oggetto: null, dettagli: null })
    } catch {
      throw primo
    }
  }
}
