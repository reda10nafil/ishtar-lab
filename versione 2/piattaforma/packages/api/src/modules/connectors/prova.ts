import type { Servizio, Token, Valori } from "./catalogo"

export type EsitoProva = { ok: true; account?: string } | { ok: false; errore: string }

const ATTESA_MS = 10_000

/**
 * Prova un collegamento con una lettura reale sul servizio.
 * I messaggi sono fissi: testo e URL delle risposte non vengono mai riportati, perché possono contenere segreti.
 */
export async function eseguiProva(
  servizio: Servizio,
  valori: Valori,
  token?: Token,
  fetchFn: typeof fetch = fetch
): Promise<EsitoProva> {
  if (!servizio.prova) return { ok: false, errore: "This service has no connection test" }
  const richiesta = servizio.prova(valori, token)

  let risposta: Response
  try {
    risposta = await fetchFn(richiesta.url, {
      method: richiesta.corpo ? "POST" : "GET",
      headers: richiesta.headers,
      body: richiesta.corpo,
      signal: AbortSignal.timeout(ATTESA_MS),
      redirect: "error",
    })
  } catch {
    return { ok: false, errore: "Service unreachable" }
  }

  if (risposta.status === 401 || risposta.status === 403) return { ok: false, errore: "Credentials rejected by the service" }
  if (risposta.status === 429) return { ok: false, errore: "Too many requests: try again shortly" }
  if (!risposta.ok) return { ok: false, errore: `The service responded with error ${risposta.status}` }

  let dati: unknown
  try {
    dati = await risposta.json()
  } catch {
    dati = undefined
  }
  let account: string | undefined
  try {
    account = richiesta.account?.(dati)
  } catch {
    account = undefined
  }
  return account ? { ok: true, account } : { ok: true }
}
