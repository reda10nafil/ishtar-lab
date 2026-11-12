// Il rinnovo dei token chiamerebbe il servizio esterno: qui risponde sempre con un accesso nuovo.
jest.mock("../oauth", () => ({
  ...jest.requireActual("../oauth"),
  rinnovaToken: jest.fn(async () => ({ access_token: "nuovo", refresh_token: "r2", expires_at: Date.now() + 3600_000 })),
}))

import ConnectorsModuleService from "../service"
import { CATALOGO } from "../catalogo"
import { cifra, decifra } from "../crypto"

const CHIAVE = "ab".repeat(32)
const ALTRA_CHIAVE = "cd".repeat(32)

// Un servizio con chiave API e almeno un campo obbligatorio: i valori si possono inserire di nuovo dalla scheda.
const servizio = CATALOGO.find((s) => s.accesso === "chiave" && s.campi.some((c) => !c.facoltativo))!
const valoriCompleti = Object.fromEntries(servizio.campi.map((c) => [c.chiave, `valore-${c.chiave}`]))
const altro = CATALOGO.find((s) => s.accesso === "chiave" && s.id !== servizio.id)!

/** Il servizio vero, con i soli accessi al database sostituiti. */
function finto(conti: Array<{ id: string; provider: string; secret: string; status: string }>) {
  const scritti: Array<Record<string, unknown>> = []
  const io: any = Object.assign(Object.create(ConnectorsModuleService.prototype), {
    listConnectorAccounts: async (filtro: { provider?: string }) => conti.filter((c) => !filtro.provider || c.provider === filtro.provider),
    updateConnectorAccounts: async (dati: Record<string, unknown>) => { scritti.push(dati) },
    createConnectorAccounts: async (dati: Record<string, unknown>) => { scritti.push(dati) },
    verifica: async () => ({ ok: true }),
  })
  return { io, scritti }
}

describe("credenziali salvate non più leggibili", () => {
  const prima = process.env.CONNECTORS_KEY
  beforeEach(() => { process.env.CONNECTORS_KEY = CHIAVE })
  afterAll(() => { process.env.CONNECTORS_KEY = prima })

  const leggibile = { id: "conto-1", provider: altro.id, secret: cifra(JSON.stringify({ valori: { [altro.campi[0].chiave]: "ok" } }), CHIAVE), status: "collegato" }
  const illeggibile = { id: "conto-2", provider: servizio.id, secret: cifra(JSON.stringify({ valori: valoriCompleti }), ALTRA_CHIAVE), status: "collegato" }

  it("l'elenco dei connettori resta disponibile e indica il servizio da sistemare", async () => {
    const { io } = finto([leggibile, illeggibile])
    const elenco = await io.elenco()
    const rotto = elenco.find((s: any) => s.id === servizio.id)
    const sano = elenco.find((s: any) => s.id === altro.id)
    expect(rotto.stato).toBe("errore")
    expect(rotto.errore).toMatch(/can't be read/)
    expect(rotto.campi.every((c: any) => c.impostato === false)).toBe(true)
    expect(sano.stato).toBe("collegato")
    expect(sano.campi.find((c: any) => c.chiave === altro.campi[0].chiave).impostato).toBe(true)
  })

  it("si possono inserire di nuovo i valori senza scollegare il servizio", async () => {
    const { io, scritti } = finto([illeggibile])
    await io.salva(servizio.id, valoriCompleti)
    expect(scritti).toHaveLength(1)
    expect(JSON.parse(decifra(String(scritti[0].secret), CHIAVE)).valori).toEqual(valoriCompleti)
  })

  const servizioLogin = CATALOGO.find((s) => s.accesso === "login" && s.oauth)!
  const altroLogin = CATALOGO.find((s) => s.accesso === "login" && s.oauth && s.id !== servizioLogin.id)!
  const tokenScaduto = { access_token: "vecchio", refresh_token: "r", expires_at: Date.now() - 1000 }

  it("il rinnovo orario degli accessi prosegue oltre una credenziale illeggibile e la segnala", async () => {
    const rotto = { id: "conto-r", provider: servizioLogin.id, secret: cifra(JSON.stringify({ valori: {}, token: tokenScaduto }), ALTRA_CHIAVE), status: "collegato" }
    const sano = { id: "conto-s", provider: altroLogin.id, secret: cifra(JSON.stringify({ valori: { client_id: "c", client_secret: "s" }, token: tokenScaduto }), CHIAVE), status: "collegato" }
    const { io, scritti } = finto([rotto, sano])
    await expect(io.rinnovaScadenze()).resolves.toBe(1)
    expect(scritti.find((s) => s.id === "conto-r")).toMatchObject({ status: "errore", last_error: expect.stringMatching(/can't be read/) })
    expect(scritti.find((s) => s.id === "conto-s")).toMatchObject({ last_error: null })
  })

  it("prova di un servizio con credenziali illeggibili: messaggio chiaro invece dell'errore di cifratura", async () => {
    const { io } = finto([illeggibile])
    delete io.verifica
    await expect(io.verifica(servizio.id)).rejects.toThrow(/can't be read/)
  })

  it("chiave CONNECTORS_KEY scritta male: errore di configurazione, non «credenziali da reinserire»", async () => {
    process.env.CONNECTORS_KEY = "ab".repeat(31) + "a"
    const { io } = finto([leggibile, illeggibile])
    await expect(io.elenco()).rejects.toThrow(/CONNECTORS_KEY/)
  })
})
