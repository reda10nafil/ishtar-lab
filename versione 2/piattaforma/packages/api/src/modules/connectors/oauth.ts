import crypto from "node:crypto"
import type { Servizio, Token } from "./catalogo"

const ATTESA_MS = 15_000

export function creaPkce(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(48).toString("base64url")
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url")
  return { verifier, challenge }
}

export function creaStato(): string {
  return crypto.randomBytes(32).toString("base64url")
}

/** Lo stato si conserva solo come impronta: chi legge il database non può riusarlo. */
export function improntaStato(stato: string): string {
  return crypto.createHash("sha256").update(stato).digest("hex")
}

type DatiAutorizzazione = { clientId: string; redirectUri: string; state: string; challenge: string }

export function urlAutorizzazione(servizio: Servizio, dati: DatiAutorizzazione): string {
  const oauth = servizio.oauth
  if (!oauth) throw new Error(`${servizio.id} does not use sign-in`)
  const url = new URL(oauth.autorizzazione)
  url.searchParams.set(oauth.parametroClient ?? "client_id", dati.clientId)
  url.searchParams.set("redirect_uri", dati.redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("state", dati.state)
  url.searchParams.set("scope", oauth.ambiti.join(oauth.separatoreAmbiti ?? " "))
  if (oauth.pkce) {
    url.searchParams.set("code_challenge", dati.challenge)
    url.searchParams.set("code_challenge_method", "S256")
  }
  for (const [k, v] of Object.entries(oauth.extra ?? {})) url.searchParams.set(k, v)
  return url.toString()
}

async function richiediToken(servizio: Servizio, clientId: string, clientSecret: string, campi: Record<string, string>, fetchFn: typeof fetch): Promise<Token> {
  const oauth = servizio.oauth!
  const corpo = new URLSearchParams(campi)
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }
  if (oauth.autenticazioneBasic) {
    headers.authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`
    if (!campi.client_id) corpo.set("client_id", clientId)
  } else {
    corpo.set(oauth.parametroClient ?? "client_id", clientId)
    corpo.set("client_secret", clientSecret)
  }
  const risposta = await fetchFn(oauth.token, { method: "POST", headers, body: corpo, signal: AbortSignal.timeout(ATTESA_MS) })
  // Il corpo non si riporta mai nell'errore: può contenere dati riservati.
  if (!risposta.ok) throw new Error(`Token exchange refused (HTTP ${risposta.status})`)
  const dati = (await risposta.json()) as Record<string, unknown>
  const accesso = dati.access_token as string | undefined
  if (!accesso) throw new Error("The service did not return a token")
  const durata = Number(dati.expires_in)
  return {
    access_token: accesso,
    refresh_token: dati.refresh_token as string | undefined,
    scope: typeof dati.scope === "string" ? dati.scope : undefined,
    expires_at: Number.isFinite(durata) && durata > 0 ? Date.now() + durata * 1000 : undefined,
  }
}

type DatiScambio = { clientId: string; clientSecret: string; code: string; redirectUri: string; verifier?: string }

export async function scambiaCodice(servizio: Servizio, dati: DatiScambio, fetchFn: typeof fetch = fetch): Promise<Token> {
  const campi: Record<string, string> = { grant_type: "authorization_code", code: dati.code, redirect_uri: dati.redirectUri }
  if (servizio.oauth?.pkce && dati.verifier) campi.code_verifier = dati.verifier
  const token = await richiediToken(servizio, dati.clientId, dati.clientSecret, campi, fetchFn)
  if (servizio.oauth?.scambioLungaDurata !== "instagram") return token

  // Il token Instagram iniziale dura un'ora: si converte subito in quello a lunga durata.
  const url = new URL("https://graph.instagram.com/access_token")
  url.searchParams.set("grant_type", "ig_exchange_token")
  url.searchParams.set("client_secret", dati.clientSecret)
  url.searchParams.set("access_token", token.access_token)
  const risposta = await fetchFn(url, { signal: AbortSignal.timeout(ATTESA_MS) })
  if (!risposta.ok) throw new Error(`Token conversion refused (HTTP ${risposta.status})`)
  const lungo = (await risposta.json()) as { access_token: string; expires_in?: number }
  return {
    ...token,
    access_token: lungo.access_token,
    expires_at: lungo.expires_in ? Date.now() + lungo.expires_in * 1000 : undefined,
  }
}

export async function rinnovaToken(servizio: Servizio, clientId: string, clientSecret: string, token: Token, fetchFn: typeof fetch = fetch): Promise<Token> {
  if (servizio.oauth?.scambioLungaDurata === "instagram") {
    const url = new URL("https://graph.instagram.com/refresh_access_token")
    url.searchParams.set("grant_type", "ig_refresh_token")
    url.searchParams.set("access_token", token.access_token)
    const risposta = await fetchFn(url, { signal: AbortSignal.timeout(ATTESA_MS) })
    if (!risposta.ok) throw new Error(`Renewal refused (HTTP ${risposta.status})`)
    const nuovo = (await risposta.json()) as { access_token: string; expires_in?: number }
    return { ...token, access_token: nuovo.access_token, expires_at: nuovo.expires_in ? Date.now() + nuovo.expires_in * 1000 : undefined }
  }
  if (!token.refresh_token) throw new Error("No refresh token available")
  const nuovo = await richiediToken(servizio, clientId, clientSecret, { grant_type: "refresh_token", refresh_token: token.refresh_token }, fetchFn)
  return { ...nuovo, refresh_token: nuovo.refresh_token ?? token.refresh_token }
}
