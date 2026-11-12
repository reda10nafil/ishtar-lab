export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:9100"

export type Sessione = {
  tipo: "admin" | "azienda"
  token: string
  email: string
  aziendaId?: string
  aziendaNome?: string
}

const CHIAVE = "multi-outfit-sessione"

export function leggiSessione(): Sessione | null {
  try {
    const dato = sessionStorage.getItem(CHIAVE)
    return dato ? (JSON.parse(dato) as Sessione) : null
  } catch {
    return null
  }
}

export function scriviSessione(sessione: Sessione | null) {
  if (sessione) sessionStorage.setItem(CHIAVE, JSON.stringify(sessione))
  else sessionStorage.removeItem(CHIAVE)
}

export class ErroreApi extends Error {
  constructor(messaggio: string, readonly stato: number) {
    super(messaggio)
  }
}

const MESSAGGI: Record<number, string> = {
  401: "Your session has expired: sign in again",
  403: "You do not have permission to do this",
  404: "Not found",
  429: "Too many requests: try again shortly",
}

let inScadenza: (() => void) | null = null
export const allaScadenza = (azione: () => void) => {
  inScadenza = azione
}

type Opzioni = { metodo?: string; corpo?: unknown; dati?: FormData; pubblico?: boolean }

export async function api<T>(percorso: string, opzioni: Opzioni = {}): Promise<T> {
  const sessione = leggiSessione()
  const headers: Record<string, string> = {}
  if (!opzioni.pubblico && sessione) {
    headers.authorization = `Bearer ${sessione.token}`
    if (sessione.aziendaId) headers["x-seller-id"] = sessione.aziendaId
  }
  if (opzioni.corpo !== undefined) headers["content-type"] = "application/json"

  let risposta: Response
  try {
    risposta = await fetch(`${API_URL}${percorso}`, {
      method: opzioni.metodo ?? (opzioni.corpo !== undefined || opzioni.dati ? "POST" : "GET"),
      headers,
      body: opzioni.dati ?? (opzioni.corpo !== undefined ? JSON.stringify(opzioni.corpo) : undefined),
    })
  } catch {
    throw new ErroreApi("Server unavailable", 0)
  }

  const testo = await risposta.text()
  let dati: unknown
  try {
    dati = testo ? JSON.parse(testo) : undefined
  } catch {
    dati = undefined
  }
  if (!risposta.ok) {
    if (risposta.status === 401 && !opzioni.pubblico) inScadenza?.()
    const messaggio = risposta.status === 400 ? (dati as { message?: string })?.message : undefined
    throw new ErroreApi(messaggio ?? MESSAGGI[risposta.status] ?? "Something went wrong: try again shortly", risposta.status)
  }
  return dati as T
}

export async function accedi(tipo: Sessione["tipo"], email: string, password: string): Promise<Sessione> {
  const percorso = tipo === "admin" ? "/auth/user/emailpass" : "/auth/member/emailpass"
  let token: string
  try {
    ;({ token } = await api<{ token: string }>(percorso, { corpo: { email, password }, pubblico: true }))
  } catch (errore) {
    if (errore instanceof ErroreApi && errore.stato === 401) throw new ErroreApi("Wrong email or password", 401)
    throw errore
  }
  if (tipo === "admin") return { tipo, token, email }

  const risposta = await fetch(`${API_URL}/vendor/sellers`, { headers: { authorization: `Bearer ${token}` } })
  const dati = (await risposta.json()) as { seller_members?: { seller_id: string; seller: { name: string } }[] }
  const membro = dati.seller_members?.[0]
  if (!membro) throw new ErroreApi("This account does not belong to a company", 403)
  return { tipo, token, email, aziendaId: membro.seller_id, aziendaNome: membro.seller.name }
}
