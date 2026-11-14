import { classificaRisposta, controllaCasella, ErroreSito, intestazioniChiave, rigaInArrivo } from "../canali/sito-regole"

const RIF = "abcdefghijklmnopqrst"
const UUID = "6f1c2a9e-3b4d-4c5e-8f6a-7b8c9d0e1f2a"
const VISITATORE = "0d9e8f7a-6b5c-4d3e-9f2a-1b0c9d8e7f6a"

describe("indirizzo della casella della chat", () => {
  const prima = { prove: process.env.SITO_PROVE_LOCALI, ambiente: process.env.NODE_ENV }
  afterEach(() => {
    if (prima.prove === undefined) delete process.env.SITO_PROVE_LOCALI; else process.env.SITO_PROVE_LOCALI = prima.prove
    process.env.NODE_ENV = prima.ambiente
  })

  it("solo il progetto Supabase https://<rif>.supabase.co, senza percorso né credenziali", () => {
    expect(controllaCasella(`https://${RIF}.supabase.co`)).toEqual({ base: `https://${RIF}.supabase.co`, rif: RIF })
    expect(controllaCasella(` https://${RIF.toUpperCase()}.supabase.co/ `)).toEqual({ base: `https://${RIF}.supabase.co`, rif: RIF })
    for (const cattivo of [
      `http://${RIF}.supabase.co`, `https://${RIF}.supabase.co:8443`, `https://${RIF}.supabase.co/rest/v1`, `https://${RIF}.supabase.co?x=1`,
      `https://utente:segreto@${RIF}.supabase.co`, "https://abc.supabase.co", `https://${RIF}.supabase.co.evil.example`,
      `https://evil.example/${RIF}.supabase.co`, "https://10.0.0.5", "non un indirizzo", "",
    ]) {
      expect(() => controllaCasella(cattivo)).toThrow(ErroreSito)
    }
    expect(() => controllaCasella("http://x")).toThrow("Enter the project URL, for example https://abcdefghijklmnopqrst.supabase.co")
  })

  it("127.0.0.1 solo con SITO_PROVE_LOCALI=1 fuori dalla produzione (Supabase locale e casella finta)", () => {
    delete process.env.SITO_PROVE_LOCALI
    expect(() => controllaCasella("http://127.0.0.1:54321")).toThrow(ErroreSito)
    process.env.SITO_PROVE_LOCALI = "1"
    expect(controllaCasella("http://127.0.0.1:54321")).toEqual({ base: "http://127.0.0.1:54321", rif: "locale" })
    expect(() => controllaCasella("http://10.0.0.5:54321")).toThrow(ErroreSito)
    expect(() => controllaCasella("http://localhost:54321/rest")).toThrow(ErroreSito)
    process.env.NODE_ENV = "production"
    expect(() => controllaCasella("http://127.0.0.1:54321")).toThrow(ErroreSito)
  })
})

describe("messaggio del visitatore dalla casella", () => {
  const riga = (extra: Record<string, unknown> = {}) => ({
    id: UUID, visitatore: VISITATORE, testo: "Avete l'abito verde in taglia S?", pagina: "https://negozio.example/abiti/verde",
    nome: "Giulia", email: "Giulia@Example.com", creato_il: "2026-11-14T09:30:00.000Z", ...extra,
  })

  it("diventa un messaggio della casella dei clienti, con nome ed email dichiarati dal visitatore", () => {
    expect(rigaInArrivo(riga(), RIF)).toEqual({
      canale: "sito", account: RIF, id_contatto: VISITATORE, nome: "Giulia", recapito: "giulia@example.com", id_messaggio: UUID,
      testo: "Avete l'abito verde in taglia S?", quando: new Date("2026-11-14T09:30:00.000Z"),
      dettagli: { pagina: "https://negozio.example/abiti/verde", dichiarato: true },
    })
  })

  it("dati ostili o sbagliati: testi puliti e accorciati, email non valida tolta, pagina senza query né frammento", () => {
    const m = rigaInArrivo(riga({
      testo: "ciao\u0000mondo \ud800", nome: `${"N".repeat(300)}\u0000`, email: "non-un-indirizzo",
      pagina: "https://negozio.example/carrello?email=giulia@example.com&token=x#pagamento",
    }), RIF)!
    expect(m.testo).toBe("ciaomondo �")
    expect(m.nome).toHaveLength(100)
    expect(m.recapito).toBeNull()
    expect(m.dettagli).toEqual({ pagina: "https://negozio.example/carrello", dichiarato: true })
    expect(rigaInArrivo(riga({ pagina: "javascript:alert(1)", nome: "  ", email: null }), RIF)).toMatchObject({ nome: null, recapito: null, dettagli: { pagina: null } })
    expect(rigaInArrivo(riga({ email: `${"a".repeat(250)}@example.com` }), RIF)?.recapito).toBeNull()
  })

  it("riga che non viene dalla casella (id o visitatore non uuid): nessun messaggio", () => {
    expect(rigaInArrivo(riga({ id: "scelto-dal-browser" }), RIF)).toBeNull()
    expect(rigaInArrivo(riga({ visitatore: "x" }), RIF)).toBeNull()
  })
})

describe("risposte della casella e chiave", () => {
  it("stati HTTP e errori della casella", () => {
    expect(classificaRisposta(200)).toBe("ok")
    expect(classificaRisposta(204)).toBe("ok")
    expect(classificaRisposta(401)).toBe("credenziali")
    expect(classificaRisposta(403, { message: "permission denied" })).toBe("credenziali")
    expect(classificaRisposta(409, { code: "PT409", message: "reader_busy" })).toBe("lettore")
    expect(classificaRisposta(400, { message: "reader_busy" })).toBe("lettore")
    expect(classificaRisposta(404)).toBe("richiesta")
    expect(classificaRisposta(422, "testo")).toBe("richiesta")
    expect(classificaRisposta(500)).toBe("servizio")
    expect(classificaRisposta(503)).toBe("servizio")
  })

  it("chiave segreta nuova solo in apikey; chiave JWT anche come Bearer", () => {
    expect(intestazioniChiave(" sb_secret_abc123 ")).toEqual({ apikey: "sb_secret_abc123" })
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.firma-di-prova"
    expect(intestazioniChiave(jwt)).toEqual({ apikey: jwt, authorization: `Bearer ${jwt}` })
  })
})
