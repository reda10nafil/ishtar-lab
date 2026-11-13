import { createHash } from "node:crypto"
import { isIP } from "node:net"
import PostalMime from "postal-mime"
import type { InArrivo } from "../tipi"

/*
 * Regole pure del canale email (provate in __tests__/email-regole.unit.spec.ts): dall'email grezza letta via IMAP al
 * messaggio della casella, filtri dei messaggi automatici e dei rimbalzi, verifica del mittente, intestazioni per
 * rispondere nello stesso filo. Tutto ciò che arriva dall'email è un dato: l'HTML non si mostra mai, diventa testo.
 */

export type Verifica = "verificato" | "non_verificato" | "sconosciuto"
export type Allegato = { nome: string; byte: number }

export type DettagliEmail = {
  message_id: string | null
  in_reply_to: string | null
  references: string[]
  oggetto: string | null
  /** Indirizzo di risposta chiesto dall'email, solo se diverso dal mittente: si mostra, non si usa. */
  reply_to: string | null
  verifica: Verifica
  allegati: Allegato[]
  /** Testo intero con le citazioni, solo se il testo mostrato le ha tolte. */
  testo_completo: string | null
}

export type Tradotta =
  | { tipo: "messaggio"; inArrivo: InArrivo & { dettagli: DettagliEmail } }
  | { tipo: "automatico"; motivo: string }
  | { tipo: "rimbalzo"; message_id_originale: string | null; motivo: string; destinatari: string[] }
  | { tipo: "nostro" }

/** Dati della busta IMAP (ENVELOPE): servono quando il contenuto è troppo grande o non si legge. */
export type Busta = { mittente?: string | null; nome?: string | null; oggetto?: string | null; message_id?: string | null }
/**
 * `fidato`: dominio del server della casella per la verifica DMARC (vedi `serverFidato`); `illeggibile`: il server non ha
 * dato il contenuto dell'email (si registra la busta con un segnaposto).
 */
export type MetaEmail = { account: string; uid: number; uidvalidity: string; internaldate: Date; busta?: Busta; fidato?: string | null; illeggibile?: boolean }
type Intestazione = { key: string; value: string }

export const ILLEGGIBILE = "[This email could not be read: open it in your mail app]"
export const TROPPO_GRANDE = "[This email is too large to show here: open it in your mail app]"
const VUOTA = "[Empty email]"
const MASSIMO_TESTO = 20_000
const MASSIMO_COMPLETO = 50_000
const MASSIMO_OGGETTO = 300
const MASSIMO_REFERENCES = 20
const MASSIMO_NOME = 200
/** Più lungo di così non è un indirizzo valido (RFC 5321) e non entrerebbe nell'indice delle identità. */
const MASSIMO_INDIRIZZO = 254
/** Message-ID più lunghi restano fuori dal filo: nelle intestazioni della risposta supererebbero i limiti delle righe. */
const MASSIMO_ID_FILO = 250
/** Oltre questi limiti il testo non si elabora (le regole restano lineari, ma un'email di 10 MB resta comunque lenta). */
const MASSIMO_ELABORATO = 200_000
const MASSIMO_HTML = 1_000_000
const MASSIMO_RAPPORTO = 200_000

/** Accorcia con «…» senza spezzare un carattere fuori dal piano di base (emoji): metà coppia non è testo valido. */
function taglia(testo: string, massimo: number): string {
  if (testo.length <= massimo) return testo
  const fine = /[\ud800-\udbff]/.test(testo[massimo - 2]) ? massimo - 2 : massimo - 1
  return `${testo.slice(0, fine)}…`
}
const minuscolo = (indirizzo: string | null | undefined) => (indirizzo ?? "").trim().toLowerCase()
export const dominio = (indirizzo: string) => minuscolo(indirizzo).split("@")[1] ?? ""
const valore = (righe: Intestazione[], chiave: string) => righe.find((r) => r.key === chiave)?.value

/** Message-ID sempre fra parentesi angolari e senza spazi. */
function idMessaggio(grezzo: string | null | undefined): string | null {
  const pulito = (grezzo ?? "").replace(/\s+/g, "")
  if (!pulito) return null
  return pulito.startsWith("<") ? pulito : `<${pulito.replace(/>$/, "")}>`
}

const elencoId = (grezzo: string | null | undefined) =>
  (grezzo?.match(/<[^<>\s]+>/g) ?? []).filter((id) => id.length <= MASSIMO_ID_FILO).slice(-MASSIMO_REFERENCES)
const nelFilo = (id: string | null) => (id && id.length <= MASSIMO_ID_FILO ? id : null)

const ENTITA: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", euro: "€", hellip: "…", ndash: "–", mdash: "—",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»", egrave: "è", eacute: "é", agrave: "à",
  aacute: "á", igrave: "ì", ograve: "ò", oacute: "ó", ugrave: "ù", Egrave: "È", Eacute: "É", Agrave: "À", deg: "°",
}

function decodifica(testo: string): string {
  return testo.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tutto, corpo: string) => {
    if (corpo[0] === "#") {
      const codice = corpo[1] === "x" || corpo[1] === "X" ? parseInt(corpo.slice(2), 16) : parseInt(corpo.slice(1), 10)
      const valido = Number.isFinite(codice) && codice > 0 && codice <= 0x10ffff && (codice < 0xd800 || codice > 0xdfff)
      return valido ? String.fromCodePoint(codice) : tutto
    }
    return ENTITA[corpo] ?? tutto
  })
}

const BLOCCHI_NASCOSTI = /^<(script|style|head|title)(?=[\s/>]|$)/

/** Commenti e blocchi script, style, head e title tolti con indexOf: nessuna espressione che torna indietro. */
function senzaBlocchi(html: string): string {
  const basso = html.toLowerCase()
  let fuori = ""
  let i = 0
  while (i < html.length) {
    const apre = html.indexOf("<", i)
    if (apre < 0) {
      fuori += html.slice(i)
      break
    }
    fuori += html.slice(i, apre)
    if (basso.startsWith("<!--", apre)) {
      const fine = basso.indexOf("-->", apre + 4)
      i = fine < 0 ? html.length : fine + 3
      continue
    }
    const blocco = BLOCCHI_NASCOSTI.exec(basso.slice(apre, apre + 8))?.[1]
    if (blocco) {
      const chiude = basso.indexOf(`</${blocco}`, apre)
      const fine = chiude < 0 ? -1 : basso.indexOf(">", chiude)
      i = fine < 0 ? html.length : fine + 1
      continue
    }
    fuori += "<"
    i = apre + 1
  }
  return fuori
}

/** Testo leggibile da un'email solo HTML: niente librerie, niente tag, script o stili; blocchi e <br> diventano a capo. */
export function testoDaHtml(html: string): string {
  const senzaTag = senzaBlocchi(html.slice(0, MASSIMO_HTML))
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^<>]*>/gi, "• ")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote|table|ul|ol|section|article|header|footer)\s*>/gi, "\n")
    .replace(/<[^<>]*>/g, "")
  return decodifica(senzaTag)
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim()
}

const INIZIO_CITAZIONE = [
  /^\s*Il giorno\b.*\bha scritto:?\s*$/i,
  /^\s*On\b.*\bwrote:?\s*$/i,
  /^\s*-{2,}\s*(Original Message|Messaggio originale|Messaggio inoltrato|Forwarded message)\s*-{2,}\s*$/i,
  /^\s*_{10,}\s*$/,
]
const INTESTAZIONE_CITATA = /^\s*(Da|From):\s.+$/i
const SEGUITO_INTESTAZIONE = /^\s*(Inviato|Sent|Data|Date|A|To|Oggetto|Subject):/i

/** Testo nuovo senza la parte citata (risposte di Gmail, Apple, Outlook, righe «>»). Un'email fatta solo di citazione resta intera. */
export function senzaCitazioni(testo: string): { nuovo: string; citato: boolean } {
  const righe = testo.split(/\r?\n/)
  // citatoDa[i]: dalla riga i in fondo solo righe vuote o citate («>»), calcolato una volta dal fondo (tempo lineare).
  const citatoDa = new Array<boolean>(righe.length + 1)
  citatoDa[righe.length] = true
  for (let i = righe.length - 1; i >= 0; i--) citatoDa[i] = citatoDa[i + 1] && (!righe[i].trim() || /^\s*>/.test(righe[i]))
  let taglio = righe.length
  for (let i = 0; i < righe.length && taglio === righe.length; i++) {
    const riga = righe[i]
    const conLaSeguente = `${riga} ${righe[i + 1] ?? ""}`
    if (INIZIO_CITAZIONE.some((r) => r.test(riga) || (/^\s*(Il giorno|On)\b/i.test(riga) && r.test(conLaSeguente)))) taglio = i
    else if (INTESTAZIONE_CITATA.test(riga) && righe.slice(i + 1, i + 5).some((r) => SEGUITO_INTESTAZIONE.test(r))) taglio = i
    else if (/^\s*>/.test(riga) && citatoDa[i]) taglio = i
  }
  const nuovo = righe.slice(0, taglio).join("\n").trimEnd()
  if (taglio === righe.length || !nuovo.trim()) return { nuovo: righe.join("\n").trimEnd(), citato: false }
  return { nuovo, citato: true }
}

const MITTENTE_DI_SISTEMA = /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|donotreply|bounces?([+-].*)?)$/i

/** Motivo per cui un'email è automatica (fuori sede, liste, newsletter, mittenti di sistema), oppure null. */
export function automatico(righe: Intestazione[], mittente: string): string | null {
  const auto = valore(righe, "auto-submitted")?.trim().toLowerCase()
  if (auto && auto !== "no") return "auto-submitted"
  if (valore(righe, "x-autoreply") !== undefined || valore(righe, "x-autorespond") !== undefined) return "auto-reply"
  if (/^(bulk|junk|list|auto_reply)$/i.test(valore(righe, "precedence")?.trim() ?? "")) return "precedence"
  if (valore(righe, "list-id") !== undefined || valore(righe, "list-unsubscribe") !== undefined) return "mailing list"
  if (MITTENTE_DI_SISTEMA.test(minuscolo(mittente).split("@")[0])) return "system sender"
  return null
}

const testoDi = (contenuto: ArrayBuffer | Uint8Array | string) =>
  typeof contenuto === "string" ? contenuto : new TextDecoder("utf-8", { fatal: false }).decode(contenuto)

/** Rapporto di un server (consegna, ritardo, ricevuta di lettura): mai un messaggio di un cliente. */
function rapporto(email: PostalMime.Email): boolean {
  return /multipart\/report/i.test(valore(email.headers as Intestazione[], "content-type") ?? "")
    || email.attachments.some((a) => /^message\/(delivery-status|disposition-notification)$/i.test(a.mimeType))
}

const INTESTAZIONI_ORIGINALE = /^(text\/rfc822-headers|message\/rfc822|message\/global|message\/global-headers)$/i

/**
 * Rimbalzo vero (RFC 3464): un rapporto delivery-status con almeno un destinatario «Action: failed». Avvisi di ritardo,
 * consegne confermate, inoltri e ricevute di lettura non lo sono: la risposta forse arriva ancora, segnarla «fallita»
 * inviterebbe a rimandarla. Restituisce il Message-ID dell'email non consegnata e i destinatari non raggiunti.
 */
export function rimbalzo(email: PostalMime.Email): { message_id_originale: string | null; motivo: string; destinatari: string[] } | null {
  const stato = email.attachments.find((a) => a.mimeType.toLowerCase() === "message/delivery-status")
  if (!stato) return null
  const falliti = testoDi(stato.content).slice(0, MASSIMO_RAPPORTO).split(/\r?\n[ \t]*\r?\n/).filter((g) => /^action:[ \t]*failed\b/im.test(g))
  if (!falliti.length) return null
  const destinatari = [...new Set(falliti
    .map((g) => /^(?:final|original)-recipient:[ \t]*rfc822[ \t]*;[ \t]*<?([^\s;<>]+@[^\s;<>]+)/im.exec(g)?.[1])
    .filter((x): x is string => Boolean(x))
    .map(minuscolo))]
  const codice = /^status:[ \t]*([0-9.]+)/im.exec(falliti[0])?.[1]
  const diagnosi = /^diagnostic-code:[ \t]*[^;\n]*;[ \t]*([^\r\n]+)/im.exec(falliti[0])?.[1]?.trim()
  const originale = email.attachments.find((a) => INTESTAZIONI_ORIGINALE.test(a.mimeType))
  const message_id_originale = originale ? /^message-id:[ \t]*(<[^<>\s]+>)/im.exec(testoDi(originale.content).slice(0, 65_536))?.[1] ?? null : null
  const motivo = [codice && `Status ${codice}`, diagnosi].filter(Boolean).join(": ") || "the receiving server did not accept it"
  return { message_id_originale, motivo: taglia(motivo, 200), destinatari }
}

const SUFFISSI_DOPPI = /\.(co|com|net|org|gov|ac|edu|ne|or|go)\.[a-z]{2}$/
const ALIAS_FIDATI: Record<string, string> = { "gmail.com": "google.com", "googlemail.com": "google.com" }

/**
 * Dominio del server della casella di cui fidarsi negli Authentication-Results: quello scelto nel connettore, oppure il
 * dominio del server IMAP (per Gmail google.com, il dominio di mx.google.com). Null se non si ricava (un indirizzo IP).
 */
export function serverFidato({ imap_host, server_verifica }: { imap_host?: string | null; server_verifica?: string | null }): string | null {
  const scelto = server_verifica?.trim().toLowerCase().replace(/\.$/, "")
  if (scelto) return scelto
  const host = (imap_host ?? "").trim().toLowerCase().replace(/\.$/, "")
  if (!host || isIP(host) || !host.includes(".")) return null
  const radice = host.split(".").slice(SUFFISSI_DOPPI.test(host) ? -3 : -2).join(".")
  return ALIAS_FIDATI[radice] ?? radice
}

/**
 * Verifica del mittente: vale solo il primo Authentication-Results scritto dal server della casella (authserv-id nel
 * dominio `fidato`, RFC 8601): uno scritto dal mittente non conta, anche se sta in cima perché il server non ne aggiunge.
 * «verificato» solo con dmarc=pass e header.from uguale al dominio del From. DMARC verifica il dominio, non la persona:
 * l'esito informa il team, non collega nessuno da solo.
 */
export function verificaMittente(righe: Intestazione[], dominioFrom: string, fidato: string | null): Verifica {
  if (!fidato) return "sconosciuto"
  const primo = righe.filter((r) => r.key === "authentication-results").map((r) => r.value).find((v) => {
    const id = /^[ \t]*([^\s;]+)/.exec(v)?.[1]?.toLowerCase().replace(/\.$/, "")
    return Boolean(id) && (id === fidato || id!.endsWith(`.${fidato}`))
  })
  if (!primo) return "sconosciuto"
  const dmarc = /\bdmarc=(\w+)([^;]*)/i.exec(primo)
  if (!dmarc) return "sconosciuto"
  if (dmarc[1].toLowerCase() !== "pass") return "non_verificato"
  const da = /header\.from=([^\s;)]+)/i.exec(dmarc[2])?.[1]?.toLowerCase()
  if (!da) return "sconosciuto"
  return da === dominioFrom.toLowerCase() ? "verificato" : "non_verificato"
}

const misura = (byte: number) => (byte >= 1024 * 1024 ? `${(byte / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(byte / 1024))} KB`)
const byteDi = (contenuto: ArrayBuffer | Uint8Array | string) =>
  typeof contenuto === "string" ? Buffer.byteLength(contenuto) : contenuto.byteLength

/** Chiave del messaggio sul canale: il Message-ID (impronta se lunghissimo), oppure UIDVALIDITY e UID. */
export function idMessaggioEmail(message_id: string | null, uidvalidity: string, uid: number): string {
  if (!message_id) return `uid:${uidvalidity}:${uid}`
  return message_id.length > 200 ? `sha256:${createHash("sha256").update(message_id).digest("hex")}` : message_id
}

function messaggioDaBusta(meta: MetaEmail, testo: string): Tradotta {
  const mittente = minuscolo(meta.busta?.mittente)
  if (!mittente) return { tipo: "automatico", motivo: "no sender" }
  if (mittente.length > MASSIMO_INDIRIZZO) return { tipo: "automatico", motivo: "invalid sender address" }
  if (mittente === minuscolo(meta.account)) return { tipo: "nostro" }
  const message_id = idMessaggio(meta.busta?.message_id)
  const oggetto = meta.busta?.oggetto?.trim() ? taglia(meta.busta.oggetto.trim(), MASSIMO_OGGETTO) : null
  return {
    tipo: "messaggio",
    inArrivo: {
      canale: "email",
      account: minuscolo(meta.account),
      id_contatto: mittente,
      nome: meta.busta?.nome?.trim() ? taglia(meta.busta.nome.trim(), MASSIMO_NOME) : null,
      recapito: mittente,
      id_messaggio: idMessaggioEmail(message_id, meta.uidvalidity, meta.uid),
      testo,
      quando: meta.internaldate,
      oggetto,
      dettagli: { message_id: nelFilo(message_id), in_reply_to: null, references: [], oggetto, reply_to: null, verifica: "sconosciuto", allegati: [], testo_completo: null },
    },
  }
}

const SURROGATO_SPAIATO = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g

/**
 * Testi pronti per il database, in ogni campo: Postgres rifiuta il carattere NUL nel testo e, nei dettagli JSON, i
 * surrogati spaiati. Un'email che il database rifiuta non va solo persa: fermerebbe la lettura di tutte le successive.
 */
export function pulisci<T>(valore: T): T {
  if (typeof valore === "string") return valore.replace(/\u0000/g, "").replace(SURROGATO_SPAIATO, "\ufffd") as T
  if (Array.isArray(valore)) return valore.map((v) => pulisci(v)) as T
  if (valore && typeof valore === "object" && Object.getPrototypeOf(valore) === Object.prototype) {
    return Object.fromEntries(Object.entries(valore).map(([chiave, v]) => [chiave, pulisci(v)])) as T
  }
  return valore
}

/** From con l'indirizzo vuoto («"mario@cliente.it" <>»): postal-mime prenderebbe il nome per l'indirizzo, che DMARC non controlla. */
const fromSenzaIndirizzo = (righe: Intestazione[]) => /<\s*>/.test(valore(righe, "from") ?? "")

/** Busta (mittente, nome, oggetto, Message-ID) dalla sola testata: per le email troppo grandi o con un MIME che non si legge. */
export async function bustaDaTestata(grezzo: Buffer): Promise<Required<Busta>> {
  const fine = [grezzo.indexOf("\r\n\r\n"), grezzo.indexOf("\n\n")].filter((i) => i >= 0)
  const testata = fine.length ? grezzo.subarray(0, Math.min(...fine) + 2) : grezzo
  try {
    const email = await PostalMime.parse(testata)
    const da = email.from?.address ? email.from : email.from?.group?.[0]
    const senzaIndirizzo = fromSenzaIndirizzo(email.headers as Intestazione[])
    return {
      mittente: senzaIndirizzo ? null : da?.address?.trim() || null,
      nome: da?.name?.trim() || null,
      oggetto: email.subject?.trim() || null,
      message_id: idMessaggio(email.messageId),
    }
  } catch {
    return { mittente: null, nome: null, oggetto: null, message_id: null }
  }
}

/** Dall'email grezza al messaggio della casella (o al motivo per cui non lo è). Non lancia: un'email illeggibile è un segnaposto. */
export async function traduciEmail(grezzo: Buffer | null, meta: MetaEmail): Promise<Tradotta> {
  return pulisci(await traduci(grezzo, meta))
}

async function traduci(grezzo: Buffer | null, meta: MetaEmail): Promise<Tradotta> {
  if (!grezzo) return messaggioDaBusta(meta, meta.illeggibile ? ILLEGGIBILE : TROPPO_GRANDE)
  let email: PostalMime.Email
  try {
    email = await PostalMime.parse(grezzo, { maxNestingDepth: 32, maxPartCount: 400 })
  } catch {
    return messaggioDaBusta({ ...meta, busta: meta.busta ?? (await bustaDaTestata(grezzo)) }, ILLEGGIBILE)
  }
  const righe = email.headers as Intestazione[]
  if (fromSenzaIndirizzo(righe)) return { tipo: "automatico", motivo: "no sender" }
  const da = email.from?.address ? email.from : email.from?.group?.[0]
  const mittente = minuscolo(da?.address)
  if (!mittente) return messaggioDaBusta(meta, (email.text ?? "").trim() ? taglia((email.text ?? "").trim(), MASSIMO_TESTO) : ILLEGGIBILE)
  if (mittente.length > MASSIMO_INDIRIZZO) return { tipo: "automatico", motivo: "invalid sender address" }
  if (mittente === minuscolo(meta.account)) return { tipo: "nostro" }

  if (rapporto(email)) {
    const rimbalzato = rimbalzo(email)
    return rimbalzato ? { tipo: "rimbalzo", ...rimbalzato } : { tipo: "automatico", motivo: "report" }
  }
  const motivo = automatico(righe, mittente)
  if (motivo) return { tipo: "automatico", motivo }

  const grezzoTesto = (email.text ?? "").trim().slice(0, MASSIMO_ELABORATO) || testoDaHtml(email.html ?? "").slice(0, MASSIMO_ELABORATO)
  const { nuovo, citato } = senzaCitazioni(grezzoTesto)
  // Allegati: ogni parte con un contenuto, anche «inline» (Mail di iPhone e Mac), tranne le immagini usate dall'HTML (cid:).
  const html = email.html ?? ""
  const dellHtml = (a: PostalMime.Email["attachments"][number]) => {
    const id = (a.contentId ?? "").trim().replace(/^<|>$/g, "")
    return Boolean(id) && html.includes(`cid:${id}`)
  }
  const allegati = email.attachments
    .filter((a) => !dellHtml(a))
    .map((a) => ({ nome: (a.filename ?? "").trim() || "attachment", byte: byteDi(a.content) }))
  const righeAllegati = allegati.map((a) => `[Attachment: ${a.nome}, ${misura(a.byte)}]`)
  const testo = taglia([nuovo, righeAllegati.join("\n")].filter(Boolean).join("\n\n") || VUOTA, MASSIMO_TESTO)
  const message_id = idMessaggio(email.messageId)
  const replyTo = minuscolo(email.replyTo?.find((r) => r.address)?.address)
  const oggetto = email.subject?.trim() ? taglia(email.subject.trim(), MASSIMO_OGGETTO) : null
  return {
    tipo: "messaggio",
    inArrivo: {
      canale: "email",
      account: minuscolo(meta.account),
      id_contatto: mittente,
      nome: da?.name?.trim() ? taglia(da.name.trim(), MASSIMO_NOME) : null,
      recapito: mittente,
      id_messaggio: idMessaggioEmail(message_id, meta.uidvalidity, meta.uid),
      testo,
      quando: meta.internaldate,
      oggetto,
      dettagli: {
        message_id: nelFilo(message_id),
        in_reply_to: nelFilo(idMessaggio(email.inReplyTo?.match(/<[^<>\s]+>/)?.[0] ?? email.inReplyTo)),
        references: elencoId(email.references),
        oggetto,
        reply_to: replyTo && replyTo !== mittente ? replyTo : null,
        verifica: verificaMittente(righe, dominio(mittente), meta.fidato ?? null),
        allegati,
        testo_completo: citato ? taglia(grezzoTesto, MASSIMO_COMPLETO) : null,
      },
    },
  }
}

const PREFISSI = /^\s*(?:(?:re|r|rif|aw|sv|antw)\s*(?:\[\d+\])?\s*:\s*)+/i

/** Oggetto della risposta: un solo «Re: » davanti, tolti quelli ripetuti (Re:, R:, RIF:, AW:, Sv:). */
export function oggettoRisposta(oggetto: string): string {
  const resto = oggetto.replace(PREFISSI, "").trim()
  return `Re: ${resto || "Your message"}`
}

const ID_VALIDO = /^<[^<>\s]+>$/

/** Intestazioni del filo salvate con un'email (JSON letto dal database): solo i valori con la forma giusta. */
export function filoDaDettagli(dettagli: unknown): { message_id: string | null; references: string[]; oggetto: string | null } | null {
  if (!dettagli || typeof dettagli !== "object" || Array.isArray(dettagli)) return null
  const d = dettagli as Record<string, unknown>
  const id = (v: unknown): v is string => typeof v === "string" && ID_VALIDO.test(v) && v.length <= MASSIMO_ID_FILO
  return {
    message_id: id(d.message_id) ? d.message_id : null,
    references: Array.isArray(d.references) ? d.references.filter(id).slice(-MASSIMO_REFERENCES) : [],
    oggetto: typeof d.oggetto === "string" ? d.oggetto : null,
  }
}

/** Intestazioni per rispondere nello stesso filo all'ultima email del cliente (RFC 5322 §3.6.4). */
export function intestazioniRisposta(
  ultimo: { message_id: string | null; references: string[]; oggetto: string | null } | null,
  oggettoConversazione: string | null
): { inReplyTo: string | undefined; references: string[]; oggetto: string } {
  const references = [...new Set([...(ultimo?.references ?? []), ...(ultimo?.message_id ? [ultimo.message_id] : [])])].slice(-MASSIMO_REFERENCES)
  return {
    inReplyTo: ultimo?.message_id ?? undefined,
    references,
    oggetto: oggettoRisposta(ultimo?.oggetto ?? oggettoConversazione ?? ""),
  }
}

/** Message-ID di una risposta, deciso dall'id della risposta: lo stesso id dà lo stesso Message-ID. */
export function messageIdNostro(id_client: string, indirizzo: string): string {
  return `<crm.${id_client}@${dominio(indirizzo) || "ishtar-lab.local"}>`
}

/** Id della risposta da un Message-ID scritto da `messageIdNostro` (per i rimbalzi); null se il Message-ID non è nostro. */
export function idClientDaMessageId(message_id: string): string | null {
  return /^<crm\.([^<>\s]+)@[^@<>\s]+>$/i.exec(message_id.trim())?.[1] ?? null
}
