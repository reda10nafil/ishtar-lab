import { Modules } from "@medusajs/framework/utils"
import PostalMime from "postal-mime"
import { CONNECTORS_MODULE } from "../../connectors"
import { CONVERSAZIONI_MODULE } from "../index"
import { inviaRisposta } from "../invio"
import { avviaSmtpFinto, type SmtpFinto } from "./finti/smtp"

const CASELLA = "negozio@ishtar.example"
const SEGRETO = "SEGRETO-di-prova-invio"
const ID = "8f14e45f-ceea-467f-a8f5"
const NOSTRO = `<crm.${ID}@ishtar.example>`

/** Contenitore finto: la risposta è già preparata («invia»); si registra l'ordine delle chiamate al servizio. */
function contenitore(valori: Record<string, string> | null, dettagliUltimo: unknown) {
  const chiamate: string[] = []
  const errori: unknown[][] = []
  const salvati: { dettagli?: Record<string, unknown>; esito?: Record<string, unknown> } = {}
  const messaggio = { id: "msg_1", conversazione_id: "conv_1", testo: "Il pacco parte domani.", chiave_unica: `uscita:${ID}`, stato_consegna: "in_coda" }
  const servizi: Record<string, unknown> = {
    [Modules.LOCKING]: { execute: async (_chiavi: string[], lavoro: () => Promise<unknown>) => lavoro() },
    [CONNECTORS_MODULE]: {
      credenzialiCollegate: async (id: string) => (id === "casella_email" && valori ? { valori, account: valori.indirizzo } : null),
      segnaErrore: async (...argomenti: unknown[]) => { errori.push(argomenti) },
    },
    [CONVERSAZIONI_MODULE]: {
      preparaUscita: async () => ({ messaggio, decisione: "invia" }),
      retrieveConversazione: async () => ({ id: "conv_1", canale: "email", oggetto: "Ordine 12", identita: { id_contatto: "cliente@example.com" } }),
      ultimoInArrivo: async () => (dettagliUltimo === undefined ? null : { id: "msg_0", dettagli: dettagliUltimo }),
      dettagliUscita: async (_id: string, dettagli: Record<string, unknown>) => { chiamate.push("dettagli"); salvati.dettagli = dettagli },
      segnaTentativo: async () => { chiamate.push("tentativo") },
      esitoUscita: async (_id: string, esito: Record<string, unknown>) => { chiamate.push(`esito:${esito.stato}`); salvati.esito = esito },
      retrieveBattuta: async () => messaggio,
    },
  }
  return { container: { resolve: (chiave: string) => servizi[chiave] } as never, chiamate, errori, salvati }
}

describe("risposte del team sulle conversazioni email", () => {
  let smtp: SmtpFinto
  const prima = process.env.EMAIL_PROVE_LOCALI
  beforeAll(() => { process.env.EMAIL_PROVE_LOCALI = "1" })
  afterAll(() => { if (prima === undefined) delete process.env.EMAIL_PROVE_LOCALI; else process.env.EMAIL_PROVE_LOCALI = prima })
  beforeEach(async () => { smtp = await avviaSmtpFinto({ utente: CASELLA, password: SEGRETO }) })
  afterEach(async () => { await smtp.chiudi() })
  const valori = (extra: Record<string, string> = {}) => ({
    indirizzo: CASELLA, password: SEGRETO, imap_host: "127.0.0.1", imap_porta: "1", smtp_host: "127.0.0.1", smtp_porta: String(smtp.porta), ...extra,
  })
  const uscita = { testo: "Il pacco parte domani.", id_client: ID, autore: { id: "user_1", nome: "Giulia" }, ultimo_visto: null }

  it("filo dall'ultima email del cliente, al mittente (mai al Reply-To), intestazioni salvate prima del tentativo", async () => {
    const c = contenitore(valori(), {
      message_id: "<abc@example.com>", references: ["<x@example.com>"], oggetto: "Ordine 12", reply_to: "altro@example.com",
      in_reply_to: null, verifica: "verificato", allegati: [], testo_completo: null,
    })
    await inviaRisposta(c.container, "conv_1", uscita)
    expect(c.chiamate).toEqual(["dettagli", "tentativo", "esito:inviato"])
    expect(c.salvati.dettagli).toEqual({ message_id: NOSTRO, in_reply_to: "<abc@example.com>", references: ["<x@example.com>", "<abc@example.com>"], oggetto: "Re: Ordine 12" })
    expect(c.salvati.esito).toEqual({ stato: "inviato", id_esterno: NOSTRO })
    expect(smtp.consegne.map((x) => x.a)).toEqual([["cliente@example.com"]])
    expect(await PostalMime.parse(smtp.consegne[0].grezzo)).toMatchObject({ inReplyTo: "<abc@example.com>", messageId: NOSTRO, subject: "Re: Ordine 12" })
  })

  it("nessuna email leggibile prima (segnaposto o dettagli rovinati): oggetto della conversazione, nessun In-Reply-To", async () => {
    for (const dettagli of [null, { message_id: 5, references: "x", oggetto: ["?"] }]) {
      const c = contenitore(valori(), dettagli)
      await inviaRisposta(c.container, "conv_1", uscita)
      expect(c.salvati.dettagli).toEqual({ message_id: NOSTRO, in_reply_to: null, references: [], oggetto: "Re: Ordine 12" })
      expect(c.salvati.esito).toEqual({ stato: "inviato", id_esterno: NOSTRO })
    }
    expect(smtp.consegne.map((x) => /^In-Reply-To:/im.test(x.grezzo))).toEqual([false, false])
  })

  it("id salvati con una forma sbagliata: restano fuori dalle intestazioni della risposta", async () => {
    const c = contenitore(valori(), { message_id: "non un id", references: ["<ok@example.com>", "<a@b>\r\nBcc: spia@example.com", 7], oggetto: "Ordine 12" })
    await inviaRisposta(c.container, "conv_1", uscita)
    expect(c.salvati.dettagli).toEqual({ message_id: NOSTRO, in_reply_to: null, references: ["<ok@example.com>"], oggetto: "Re: Ordine 12" })
    expect(smtp.consegne[0].grezzo).not.toMatch(/spia@example\.com/)
  })

  it("casella non collegata: fallito «Email is not connected», nessun tentativo", async () => {
    const c = contenitore(null, null)
    await inviaRisposta(c.container, "conv_1", uscita)
    expect(c.chiamate).toEqual(["esito:fallito"])
    expect(c.salvati.esito).toEqual({ stato: "fallito", errore: "Email is not connected" })
    expect(smtp.consegne).toEqual([])
  })

  it("password rifiutata dal server SMTP: connettore in errore con i valori salvati, risposta fallita", async () => {
    const usati = valori({ password: "sbagliata-segreta-9" })
    const c = contenitore(usati, null)
    await inviaRisposta(c.container, "conv_1", uscita)
    expect(c.errori).toEqual([["casella_email", "The mailbox refused the username or password", usati]])
    expect(c.salvati.esito).toEqual({ stato: "fallito", errore: "The mailbox refused the username or password" })
    expect(c.chiamate).toEqual(["dettagli", "esito:fallito"])
  })
})
