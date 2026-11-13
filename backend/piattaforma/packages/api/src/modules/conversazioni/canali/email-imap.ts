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
/** `illeggibile`: il server non ha dato il contenuto (si registra la busta con un segnaposto, o si salta se manca). */
export type EmailLetta = { uid: number; grezzo: Buffer | null; internaldate: Date; dimensione: number; busta?: Busta; illeggibile?: boolean }
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
 * una. Un'email che il server non dà (rifiuto o assenza, anche ritentata da sola) diventa «illeggibile», con la busta se
 * la testata si legge: si registra come segnaposto e non ferma la lettura delle altre.
 */
async function scarica(client: ImapFlow, uids: number[], byteGiro: number): Promise<EmailLetta[]> {
  if (!uids.length) return []
  const dati = await raccogli(client, uids, { size: true, internalDate: true }, (m) => ({ dimensione: Number(m.size) || 0, internaldate: dataValida(m.internalDate) }))
  const scelti: number[] = []
  let byte = 0
  for (const uid of uids) {
    const dimensione = dati.get(uid)?.dimensione ?? 0
    const peso = dimensione > LIMITE_EMAIL ? 0 : dimensione
    if (scelti.length && byte + peso > byteGiro) break
    byte += peso
    scelti.push(uid)
  }
  const grande = (uid: number) => (dati.get(uid)?.dimensione ?? 0) > LIMITE_EMAIL
  const contenuti = await raccogli(client, scelti.filter((uid) => dati.has(uid) && !grande(uid)), { source: true }, (m) => m.source)
  const testate = await raccogli(client, scelti.filter((uid) => !contenuti.has(uid)), { headers: true }, (m) => m.headers)
  const lette: EmailLetta[] = []
  for (const uid of scelti) {
    const internaldate = dati.get(uid)?.internaldate ?? new Date()
    const dimensione = dati.get(uid)?.dimensione ?? 0
    const grezzo = contenuti.get(uid)
    if (grezzo) {
      lette.push({ uid, grezzo, internaldate, dimensione })
      continue
    }
    const testata = testate.get(uid)
    const busta = testata ? await bustaDaTestata(testata) : undefined
    lette.push({ uid, grezzo: null, internaldate, dimensione, ...(busta ? { busta } : {}), ...(grande(uid) && busta ? {} : { illeggibile: true }) })
  }
  return lette
}

/** Rifiuto del server (NO o BAD), diverso da una connessione caduta: le email si riprovano una per una. */
const rifiuto = (errore: unknown) => ["NO", "BAD"].includes((errore as { responseStatus?: string } | null)?.responseStatus ?? "")

/**
 * Una UID FETCH per più email (il generatore va consumato tutto prima del comando successivo). Le email che mancano, perché
 * il server ha rifiutato il gruppo o le ha saltate, si riprovano una per una: un'email guasta non toglie le altre.
 */
async function raccogli<V>(client: ImapFlow, uids: number[], richiesta: FetchQueryObject, valore: (m: FetchMessageObject) => V | undefined): Promise<Map<number, V>> {
  const fuori = new Map<number, V>()
  const leggi = async (gruppo: number[]) => {
    try {
      for await (const m of client.fetch(gruppo.join(","), { uid: true, ...richiesta }, { uid: true })) {
        const v = valore(m)
        if (v !== undefined) fuori.set(m.uid, v)
      }
    } catch (errore) {
      if (!rifiuto(errore)) throw errore
    }
  }
  if (!uids.length) return fuori
  await leggi(uids)
  if (uids.length > 1) for (const uid of uids) if (!fuori.has(uid)) await leggi([uid])
  return fuori
}

function dataValida(valore: Date | string | undefined): Date {
  const data = valore instanceof Date ? valore : valore ? new Date(valore) : null
  return data && !Number.isNaN(data.getTime()) ? data : new Date()
}

/** `fidato`: dominio del server della casella per la verifica DMARC (serverFidato). */
export type Registrazione = {
  account: string
  fidato?: string | null
  registra: (e: InArrivo) => Promise<unknown>
  rimbalzo: (message_id: string, motivo: string, extra: { destinatari: string[]; quando: Date }) => Promise<unknown>
  salva: (cursore: CursoreEmail) => Promise<unknown>
}
/** `illeggibili`: email che il server non ha dato e senza un mittente da registrare (saltate). */
export type EsitoRegistrazione = { registrati: number; rimbalzi: number; scartati: number; illeggibili: number }

/**
 * Registra le email lette, in ordine: messaggi dei clienti nella casella, rimbalzi sulle nostre risposte, automatiche e
 * nostre saltate. Il cursore si salva dopo ogni email; un errore ferma il giro e l'email si rilegge al giro dopo.
 */
export async function elaboraEmail({ uidvalidity, messaggi, cursoreFinale }: Lettura, d: Registrazione): Promise<EsitoRegistrazione> {
  const esito = { registrati: 0, rimbalzi: 0, scartati: 0, illeggibili: 0 }
  let salvato = -1
  for (const m of messaggi) {
    const meta = { account: d.account, uid: m.uid, uidvalidity, internaldate: m.internaldate, busta: m.busta, fidato: d.fidato ?? null, illeggibile: m.illeggibile }
    const tradotta = await traduciEmail(m.grezzo, meta)
    if (tradotta.tipo === "messaggio") {
      await registraConRiserva(d.registra, tradotta.inArrivo)
      esito.registrati += 1
    } else if (tradotta.tipo === "rimbalzo" && tradotta.message_id_originale) {
      await d.rimbalzo(tradotta.message_id_originale, tradotta.motivo, { destinatari: tradotta.destinatari, quando: m.internaldate })
      esito.rimbalzi += 1
    } else if (m.illeggibile) {
      esito.illeggibili += 1
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
