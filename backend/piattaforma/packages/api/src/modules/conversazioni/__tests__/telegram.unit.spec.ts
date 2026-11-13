import { baseTelegram, clientTelegram, ErroreCanale, normalizzaAggiornamento } from "../canali/telegram"

const TOKEN = "123456:SEGRETO-di-prova"

type Chiamata = { url: string; corpo: unknown }

/** fetch finto: registra indirizzo e corpo di ogni chiamata e risponde con la funzione data. */
function fintoFetch(risposta: () => Response) {
  const chiamate: Chiamata[] = []
  const chiama = (async (url: unknown, init?: { body?: string }) => {
    chiamate.push({ url: String(url), corpo: init?.body ? JSON.parse(init.body) : undefined })
    return risposta()
  }) as unknown as typeof fetch
  return { chiama, chiamate }
}
const json = (stato: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status: stato, headers: { "content-type": "application/json" } })

describe("normalizzaAggiornamento", () => {
  const messaggio = (extra: Record<string, unknown> = {}) => ({
    message_id: 45, date: 1794560000, chat: { id: 123, type: "private" },
    from: { id: 123, is_bot: false, first_name: "Mario", last_name: "Rossi" }, text: "Ciao", ...extra,
  })
  const aggiornamento = (extra: Record<string, unknown> = {}) => ({ update_id: 10, message: messaggio(extra) })

  it("messaggio privato di testo", () => {
    expect(normalizzaAggiornamento(aggiornamento(), "negozio_bot")).toEqual({
      canale: "telegram", account: "negozio_bot", id_contatto: "123", nome: "Mario Rossi", recapito: null,
      id_messaggio: "123:45", testo: "Ciao", quando: new Date(1794560000 * 1000),
    })
  })

  it("didascalia, poi segnaposto per foto, sticker, vocale, documento e altro", () => {
    const testo = (extra: Record<string, unknown>) => normalizzaAggiornamento(aggiornamento({ text: undefined, ...extra }), "b")?.testo
    expect(testo({ photo: [{}], caption: "Questa taglia?" })).toBe("Questa taglia?")
    expect(testo({ photo: [{}] })).toBe("[Photo]")
    expect(testo({ sticker: {} })).toBe("[Sticker]")
    expect(testo({ voice: {} })).toBe("[Voice message]")
    expect(testo({ document: {} })).toBe("[Document]")
    expect(testo({ location: {} })).toBe("[Attachment]")
  })

  it("username se mancano nome e cognome; null se manca tutto", () => {
    expect(normalizzaAggiornamento(aggiornamento({ from: { id: 123, is_bot: false, username: "mrossi" } }), "b")?.nome).toBe("mrossi")
    expect(normalizzaAggiornamento(aggiornamento({ from: { id: 123, is_bot: false } }), "b")?.nome).toBeNull()
  })

  it("ignora gruppi, bot e messaggi modificati", () => {
    expect(normalizzaAggiornamento(aggiornamento({ chat: { id: -5, type: "group" } }), "b")).toBeNull()
    expect(normalizzaAggiornamento(aggiornamento({ from: { id: 9, is_bot: true, first_name: "Bot" } }), "b")).toBeNull()
    expect(normalizzaAggiornamento({ update_id: 11, edited_message: messaggio() }, "b")).toBeNull()
    expect(normalizzaAggiornamento(null, "b")).toBeNull()
  })
})

describe("clientTelegram", () => {
  const base = process.env.TELEGRAM_API_BASE
  const ambiente = process.env.NODE_ENV
  afterEach(() => {
    if (base === undefined) delete process.env.TELEGRAM_API_BASE
    else process.env.TELEGRAM_API_BASE = base
    process.env.NODE_ENV = ambiente
  })

  it("getUpdates con offset, attesa e solo i messaggi; senza offset quando è null", async () => {
    delete process.env.TELEGRAM_API_BASE
    const f = fintoFetch(() => json(200, { ok: true, result: [{ update_id: 11 }] }))
    const client = clientTelegram(TOKEN, f.chiama)
    expect(await client.leggi(11, 25)).toEqual([{ update_id: 11 }])
    expect(f.chiamate[0].url).toBe(`https://api.telegram.org/bot${TOKEN}/getUpdates`)
    expect(f.chiamate[0].corpo).toEqual({ offset: 11, timeout: 25, allowed_updates: ["message"] })
    await client.leggi(null, 0)
    expect(f.chiamate[1].corpo).toEqual({ timeout: 0, allowed_updates: ["message"] })
  })

  it("sendMessage restituisce l'id esterno chat:messaggio", async () => {
    const f = fintoFetch(() => json(200, { ok: true, result: { message_id: 99, chat: { id: 123 } } }))
    expect(await clientTelegram(TOKEN, f.chiama).invia("123", "Grazie!")).toEqual({ id_esterno: "123:99" })
    expect(f.chiamate[0].url.endsWith("/sendMessage")).toBe(true)
    expect(f.chiamate[0].corpo).toEqual({ chat_id: "123", text: "Grazie!" })
  })

  it("getMe dà lo username del bot", async () => {
    const f = fintoFetch(() => json(200, { ok: true, result: { username: "negozio_bot" } }))
    expect(await clientTelegram(TOKEN, f.chiama).account()).toBe("negozio_bot")
  })

  it("usa TELEGRAM_API_BASE fuori produzione, senza la barra finale", async () => {
    process.env.TELEGRAM_API_BASE = "http://127.0.0.1:9999/"
    const f = fintoFetch(() => json(200, { ok: true, result: [] }))
    await clientTelegram(TOKEN, f.chiama).leggi(null, 0)
    expect(f.chiamate[0].url).toBe(`http://127.0.0.1:9999/bot${TOKEN}/getUpdates`)
    expect(baseTelegram()).toBe("http://127.0.0.1:9999")
  })

  it("in produzione ignora un indirizzo non HTTPS", () => {
    process.env.TELEGRAM_API_BASE = "http://127.0.0.1:9999"
    process.env.NODE_ENV = "production"
    expect(baseTelegram()).toBe("https://api.telegram.org")
  })

  it.each([
    [401, "credenziali"], [404, "credenziali"], [403, "bloccato"], [409, "webhook"], [429, "limite"], [400, "richiesta"], [502, "servizio"],
  ])("risposta %i → %s, senza il token nel messaggio", async (stato, codice) => {
    const f = fintoFetch(() => json(stato, { ok: false, error_code: stato, description: `Errore ${stato} per bot${TOKEN}` }))
    const errore = await clientTelegram(TOKEN, f.chiama).invia("123", "x").catch((e: unknown) => e)
    expect(errore).toBeInstanceOf(ErroreCanale)
    expect((errore as ErroreCanale).codice).toBe(codice)
    expect((errore as ErroreCanale).message).not.toContain("SEGRETO")
  })

  it("rete irraggiungibile → «rete», senza il token", async () => {
    const chiama = (async () => { throw new TypeError(`fetch failed https://api.telegram.org/bot${TOKEN}/getMe`) }) as unknown as typeof fetch
    const errore = await clientTelegram(TOKEN, chiama).account().catch((e: unknown) => e)
    expect(errore).toBeInstanceOf(ErroreCanale)
    expect((errore as ErroreCanale).codice).toBe("rete")
    expect((errore as ErroreCanale).message).not.toContain("SEGRETO")
  })
})
