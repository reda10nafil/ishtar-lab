import http from "node:http"
import type { AddressInfo } from "node:net"
import { segretoDaRiscrivere, trovaServizio, valoriValidi } from "../../connectors/catalogo"
import { eseguiProva } from "../../connectors/prova"
import { clientCasella, MESSAGGI_SITO, provaCasellaSito } from "../canali/sito"
import { ErroreSito, MESSAGGIO_INDIRIZZO } from "../canali/sito-regole"
import { avviaCasellaFinta, type CasellaFinta } from "./finti/casella"

const CHIAVE = "sb_secret_prova-della-chat-1234"
const VISITATORE = "0d9e8f7a-6b5c-4d3e-9f2a-1b0c9d8e7f6a"

describe("connettore e client della chat del sito (casella finta)", () => {
  let casella: CasellaFinta
  const prima = process.env.SITO_PROVE_LOCALI
  beforeAll(() => { process.env.SITO_PROVE_LOCALI = "1" })
  afterAll(() => { if (prima === undefined) delete process.env.SITO_PROVE_LOCALI; else process.env.SITO_PROVE_LOCALI = prima })
  beforeEach(async () => { casella = await avviaCasellaFinta({ chiave: CHIAVE }) })
  afterEach(async () => { await casella.chiudi() })
  const valori = (extra: Record<string, string> = {}) => ({ url: casella.base, chiave: CHIAVE, ...extra })
  const errore = (p: Promise<unknown>) => p.then(() => null, (e) => e)

  it("prova riuscita: versione 1 del protocollo, account = riferimento del progetto", async () => {
    expect(await provaCasellaSito(valori())).toEqual({ ok: true, account: "locale" })
    expect(casella.chiamate).toEqual(["chat_versione"])
  })

  it("prova non riuscita: testi fissi, chiave mai nell'esito", async () => {
    const sbagliata = await provaCasellaSito(valori({ chiave: "sb_secret_sbagliata-e-segreta" }))
    expect(sbagliata).toEqual({ ok: false, errore: "The chat project refused the secret key" })
    expect(JSON.stringify(sbagliata)).not.toContain("sbagliata-e-segreta")
    casella.negozio.versione = 2
    expect(await provaCasellaSito(valori())).toEqual({ ok: false, errore: "Run the latest chat SQL on the project" })
    expect(await provaCasellaSito(valori({ url: "https://evil.example" }))).toEqual({ ok: false, errore: MESSAGGIO_INDIRIZZO })
    expect(await provaCasellaSito(valori({ url: "http://127.0.0.1:1" }))).toEqual({ ok: false, errore: "The site chat can't be reached" })
  })

  it("progetto senza l'SQL della chat (funzione assente, 404 PGRST202 come la Supabase locale): invito a eseguire l'SQL", async () => {
    const senzaSql = (async () => new Response(
      JSON.stringify({ code: "PGRST202", message: "Could not find the function public.chat_versione without parameters in the schema cache" }),
      { status: 404, headers: { "content-type": "application/json" } },
    )) as unknown as typeof fetch
    expect(await provaCasellaSito(valori(), { chiama: senzaSql })).toEqual({ ok: false, errore: "Run the latest chat SQL on the project" })
    const nonJson = (async () => new Response("<html>ok</html>", { status: 200 })) as unknown as typeof fetch
    expect(await errore(clientCasella(valori(), { chiama: nonJson }).preleva("istanza-1", 50))).toMatchObject({ codice: "servizio" })
    expect(await provaCasellaSito(valori(), { chiama: nonJson })).toEqual({ ok: false, errore: MESSAGGI_SITO.servizio })
    const oggetto = (async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch
    expect(await errore(clientCasella(valori(), { chiama: oggetto }).preleva("istanza-1", 50))).toMatchObject({ codice: "servizio" })
    expect(await errore(clientCasella(valori(), { chiama: oggetto }).conferma("istanza-1", ["0d9e8f7a-6b5c-4d3e-9f2a-1b0c9d8e7f6a"]))).toMatchObject({ codice: "servizio" })
    expect(await errore(clientCasella(valori(), { chiama: oggetto }).rispondi(VISITATORE, "risposta-0009", "ciao", null))).toMatchObject({ codice: "servizio" })
  })

  it("reindirizzamento: la chiave non segue mai un altro indirizzo", async () => {
    const ricevute: unknown[] = []
    const altro = http.createServer((req, res) => { ricevute.push(req.headers.apikey); res.end("{}") })
    await new Promise<void>((ok) => altro.listen(0, "127.0.0.1", () => ok()))
    const portaAltro = (altro.address() as AddressInfo).port
    const rimanda = http.createServer((req, res) => { res.writeHead(307, { location: `http://127.0.0.1:${portaAltro}${req.url}` }); res.end() })
    await new Promise<void>((ok) => rimanda.listen(0, "127.0.0.1", () => ok()))
    try {
      const url = `http://127.0.0.1:${(rimanda.address() as AddressInfo).port}`
      expect(await provaCasellaSito({ url, chiave: CHIAVE })).toEqual({ ok: false, errore: MESSAGGI_SITO.rete })
      expect(ricevute).toEqual([])
    } finally {
      for (const s of [altro, rimanda]) { s.closeAllConnections(); await new Promise((ok) => s.close(ok)) }
    }
  })

  it("client: preleva, conferma, risponde una volta sola per id e ritrova la risposta", async () => {
    const m = casella.aggiungiDalVisitatore({ visitatore: VISITATORE, testo: "Ciao!", nome: "Anna", email: "anna@example.com", pagina: "https://negozio.example/p" })
    const client = clientCasella(valori())
    expect(client.rif).toBe("locale")
    const righe = await client.preleva("istanza-prova", 50)
    expect(righe).toEqual([{ id: m.id, visitatore: VISITATORE, testo: "Ciao!", pagina: "https://negozio.example/p", nome: "Anna", email: "anna@example.com", creato_il: m.creato_il }])
    expect(await client.conferma("istanza-prova", [m.id])).toBe(1)
    expect(await client.conferma("istanza-prova", [m.id])).toBe(0)
    const chiamatePrima = casella.chiamate.length
    expect(await client.conferma("istanza-prova", [])).toBe(0)
    expect(casella.chiamate).toHaveLength(chiamatePrima)
    const prima = await client.rispondi(VISITATORE, "risposta-0001", "Sì!", "Ishtar Lab")
    expect(await client.rispondi(VISITATORE, "risposta-0001", "Sì!", "Ishtar Lab")).toEqual(prima)
    expect(casella.messaggi.filter((x) => x.direzione === "uscita")).toHaveLength(1)
    expect(await client.verifica("risposta-0001")).toEqual(prima)
    expect(await client.verifica("mai-scritta-0001")).toBeNull()
  })

  it("errori del client classificati: lettore occupato, servizio, richiesta, rete dopo la scrittura, lentezza", async () => {
    casella.aggiungiDalVisitatore({ visitatore: VISITATORE, testo: "Ciao!" })
    await clientCasella(valori()).preleva("istanza-1", 50)
    expect(await errore(clientCasella(valori()).preleva("istanza-2", 50))).toMatchObject({ codice: "lettore", message: MESSAGGI_SITO.lettore })
    expect(await errore(clientCasella(valori()).rispondi("99999999-9999-4999-8999-999999999999", "risposta-0002", "ciao", null)))
      .toMatchObject({ codice: "richiesta", message: "The visitor is no longer in the site chat" })
    expect(await errore(clientCasella(valori()).rispondi(VISITATORE, "risposta-0004", "x".repeat(4001), null))).toMatchObject({ codice: "richiesta", message: "The reply is empty or longer than 4000 characters" })
    casella.guasti = { cadeDopoScrittura: true }
    expect(await errore(clientCasella(valori()).rispondi(VISITATORE, "risposta-0003", "ciao", null))).toMatchObject({ codice: "rete" })
    expect(casella.messaggi.some((x) => x.id_client === "risposta-0003")).toBe(true)
    casella.guasti = { stato: 503 }
    expect(await errore(clientCasella(valori()).verifica("risposta-0003"))).toMatchObject({ codice: "servizio", message: MESSAGGI_SITO.servizio })
    casella.guasti = { lento: 600 }
    expect(await errore(clientCasella(valori(), { attesaMs: 150 }).versione())).toMatchObject({ codice: "rete" })
    const tutti = [MESSAGGI_SITO.credenziali, MESSAGGI_SITO.lettore, MESSAGGI_SITO.rete, MESSAGGI_SITO.servizio, MESSAGGI_SITO.richiesta].join(" ")
    expect(tutti).not.toContain(CHIAVE)
  })

  it("indirizzo non ammesso: il client non parte e la chiave non esce", async () => {
    expect(() => clientCasella({ url: "https://evil.example", chiave: CHIAVE })).toThrow(ErroreSito)
    expect(casella.chiamate).toEqual([])
  })

  it("voce «Site chat» del catalogo: campi, controlli e chiave da riscrivere cambiando progetto", async () => {
    const servizio = trovaServizio("chat_sito")!
    expect(servizio).toMatchObject({ nome: "Site chat", categoria: "messaggi", accesso: "chiave", confermato: true })
    expect(servizio.campi.find((c) => c.chiave === "chiave")?.segreto).toBe(true)
    expect(servizio.campi.find((c) => c.chiave === "url")?.legatoAlSegreto).toBe(true)
    expect(valoriValidi(servizio, valori())).toBeNull()
    expect(valoriValidi(servizio, valori({ url: "https://evil.example/rest" }))).toBe(MESSAGGIO_INDIRIZZO)
    expect(valoriValidi(servizio, valori({ chiave: "sb_publishable_abc123" }))).toBe("Use the secret key (sb_secret_…), not the publishable key")
    expect(valoriValidi(servizio, valori({ nome: "x".repeat(101) }))).toBe("The name shown to visitors can be at most 100 characters")
    expect(valoriValidi(servizio, valori({ nome: "Ishtar Hub" }))).toBeNull()
    expect(await eseguiProva(servizio, valori())).toEqual({ ok: true, account: "locale" })
    expect(segretoDaRiscrivere(servizio, { url: "https://abcdefghijklmnopqrst.supabase.co", chiave: "k" }, { url: "https://zyxwvutsrqponmlkjihg.supabase.co" })).toBe(true)
    expect(segretoDaRiscrivere(servizio, { url: "https://abcdefghijklmnopqrst.supabase.co", chiave: "k" }, { nome: "Negozio" })).toBe(false)
  })
})
