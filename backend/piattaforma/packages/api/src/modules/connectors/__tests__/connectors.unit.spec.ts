import { cifra, decifra } from "../crypto"
import { CATALOGO, trovaServizio, valoriValidi } from "../catalogo"
import { eseguiProva } from "../prova"
import { creaPkce, urlAutorizzazione, scambiaCodice } from "../oauth"

const CHIAVE = "ab".repeat(32)

describe("cifratura delle credenziali", () => {
  it("restituisce il testo originale", () => {
    expect(decifra(cifra("segreto", CHIAVE), CHIAVE)).toBe("segreto")
  })

  it("non contiene il testo in chiaro e cambia a ogni cifratura", () => {
    const a = cifra("segreto", CHIAVE)
    expect(a).not.toContain("segreto")
    expect(a).not.toBe(cifra("segreto", CHIAVE))
  })

  it("rifiuta un dato alterato o una chiave sbagliata", () => {
    const dato = cifra("segreto", CHIAVE)
    expect(() => decifra(`${dato.slice(0, -2)}00`, CHIAVE)).toThrow()
    expect(() => decifra(dato, "cd".repeat(32))).toThrow()
  })

  it("rifiuta un controllo di integrità accorciato", () => {
    // AES-GCM con tag di 4 byte: una falsificazione riesce una volta su 2^32 invece che su 2^128.
    const [versione, iv, tag, dati] = cifra("segreto", CHIAVE).split(".")
    const corto = Buffer.from(tag, "base64url").subarray(0, 4).toString("base64url")
    expect(() => decifra([versione, iv, corto, dati].join("."), CHIAVE)).toThrow()
  })

  it("rifiuta una chiave non valida", () => {
    expect(() => cifra("segreto", "corta")).toThrow(/CONNECTORS_KEY/)
  })
})

describe("catalogo", () => {
  it("ha identificativi unici e dati completi", () => {
    const ids = CATALOGO.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of CATALOGO) {
      expect(s.nome && s.descrizione && s.documentazione).toBeTruthy()
      expect(s.campi.length).toBeGreaterThan(0)
      if (s.accesso === "login") expect(s.oauth).toBeDefined()
      else expect(s.prova ?? s.provaPersonalizzata).toBeDefined()
    }
  })

  it("comprende i servizi richiesti", () => {
    for (const id of ["stripe", "sendcloud", "shopify", "instagram", "facebook", "tiktok", "whatsapp", "google"]) {
      expect(trovaServizio(id)).toBeDefined()
    }
  })

  it("segnala i campi obbligatori mancanti", () => {
    const stripe = trovaServizio("stripe")!
    expect(valoriValidi(stripe, {})).toMatch(/Secret key/)
    expect(valoriValidi(stripe, { secret_key: "sk_test_123" })).toBeNull()
  })

  it("accetta solo domini Shopify validi", () => {
    const shopify = trovaServizio("shopify")!
    const base = { client_id: "a", client_secret: "b" }
    expect(valoriValidi(shopify, { ...base, shop: "http://169.254.169.254/" })).toMatch(/myshopify/)
    expect(valoriValidi(shopify, { ...base, shop: "negozio.myshopify.com" })).toBeNull()
  })

  it("rifiuta siti interni o non sicuri per WooCommerce", () => {
    const woo = trovaServizio("woocommerce")!
    const base = { consumer_key: "a", consumer_secret: "b" }
    expect(valoriValidi(woo, { ...base, site: "http://negozio.it" })).toMatch(/https/)
    expect(valoriValidi(woo, { ...base, site: "https://127.0.0.1" })).toMatch(/public/)
    expect(valoriValidi(woo, { ...base, site: "https://192.168.1.10" })).toMatch(/public/)
    expect(valoriValidi(woo, { ...base, site: "https://negozio.it" })).toBeNull()
  })
})

describe("prova di collegamento", () => {
  const risposta = (status: number, corpo: unknown = {}) =>
    Promise.resolve(new Response(JSON.stringify(corpo), { status }))

  it("riconosce una chiave valida e indica l'account", async () => {
    const fetchFinto = jest.fn(() => risposta(200, { settings: { dashboard: { display_name: "Multi Outfit" } } }))
    const esito = await eseguiProva(trovaServizio("stripe")!, { secret_key: "sk_test_1" }, undefined, fetchFinto as typeof fetch)
    expect(esito).toEqual({ ok: true, account: "Multi Outfit" })
  })

  it("spiega il rifiuto senza mostrare la chiave", async () => {
    const segreto = "sk_test_NON_MOSTRARE"
    const fetchFinto = jest.fn(() => risposta(401, { error: { message: `Invalid key ${segreto}` } }))
    const esito = await eseguiProva(trovaServizio("stripe")!, { secret_key: segreto }, undefined, fetchFinto as typeof fetch)
    expect(esito.ok).toBe(false)
    expect(JSON.stringify(esito)).not.toContain(segreto)
    expect(esito).toEqual({ ok: false, errore: "Credentials rejected by the service" })
  })

  it("gestisce un servizio non raggiungibile", async () => {
    const fetchFinto = jest.fn(() => Promise.reject(new Error("rete giu")))
    const esito = await eseguiProva(trovaServizio("stripe")!, { secret_key: "k" }, undefined, fetchFinto as typeof fetch)
    expect(esito).toEqual({ ok: false, errore: "Service unreachable" })
  })

  it("non mette il token Telegram nel messaggio di errore", async () => {
    const fetchFinto = jest.fn(() => Promise.reject(new Error("https://api.telegram.org/botSEGRETO/getMe")))
    const esito = await eseguiProva(trovaServizio("telegram")!, { bot_token: "SEGRETO" }, undefined, fetchFinto as typeof fetch)
    expect(JSON.stringify(esito)).not.toContain("SEGRETO")
  })
})

describe("login OAuth", () => {
  it("crea un PKCE S256 conforme", () => {
    const { verifier, challenge } = creaPkce()
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43,}$/)
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(challenge).not.toBe(verifier)
  })

  it("costruisce l'indirizzo di autorizzazione", () => {
    const url = new URL(
      urlAutorizzazione(trovaServizio("google")!, {
        clientId: "id-app",
        redirectUri: "http://localhost:9273/connectors/oauth/callback",
        state: "stato",
        challenge: "sfida",
      })
    )
    expect(url.origin).toBe("https://accounts.google.com")
    expect(url.searchParams.get("client_id")).toBe("id-app")
    expect(url.searchParams.get("state")).toBe("stato")
    expect(url.searchParams.get("code_challenge")).toBe("sfida")
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
    expect(url.searchParams.get("response_type")).toBe("code")
  })

  it("usa client_key per TikTok", () => {
    const url = new URL(
      urlAutorizzazione(trovaServizio("tiktok")!, { clientId: "chiave", redirectUri: "https://x.it/cb", state: "s", challenge: "c" })
    )
    expect(url.searchParams.get("client_key")).toBe("chiave")
    expect(url.searchParams.get("client_id")).toBeNull()
  })

  it("normalizza i token ricevuti", async () => {
    const fetchFinto = jest.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ access_token: "tok", refresh_token: "rin", expires_in: 3600 })))
    )
    const prima = Date.now()
    const token = await scambiaCodice(
      trovaServizio("google")!,
      { clientId: "a", clientSecret: "b", code: "c", redirectUri: "https://x.it/cb", verifier: "v" },
      fetchFinto as typeof fetch
    )
    expect(token.access_token).toBe("tok")
    expect(token.refresh_token).toBe("rin")
    expect(token.expires_at).toBeGreaterThanOrEqual(prima + 3_590_000)
  })

  it("non espone i dettagli del servizio se lo scambio fallisce", async () => {
    const fetchFinto = jest.fn(() => Promise.resolve(new Response('{"error":"invalid_client","secret":"abc"}', { status: 400 })))
    await expect(
      scambiaCodice(
        trovaServizio("google")!,
        { clientId: "a", clientSecret: "b", code: "c", redirectUri: "https://x.it/cb", verifier: "v" },
        fetchFinto as typeof fetch
      )
    ).rejects.toThrow(/HTTP 400/)
  })
})
