export type Regola = [metodo: string, percorso: RegExp, testo: string]

const ID = "[^/]+"

/** Traduce le richieste più frequenti in una frase leggibile per il registro. */
const REGOLE: Regola[] = [
  ["POST", new RegExp(`^/admin/products/${ID}/confirm$`), "Product approved"],
  ["POST", new RegExp(`^/admin/products/${ID}/reject$`), "Product rejected"],
  ["POST", new RegExp(`^/admin/products/${ID}/request-changes$`), "Changes requested from the company"],
  ["POST", new RegExp(`^/admin/product-changes/${ID}/confirm$`), "Product change approved"],
  ["POST", new RegExp(`^/admin/product-changes/${ID}/cancel$`), "Product change cancelled"],
  ["POST", /^\/admin\/sellers$/, "Company created"],
  ["POST", new RegExp(`^/admin/sellers/${ID}/approve$`), "Company approved"],
  ["POST", new RegExp(`^/admin/sellers/${ID}/suspend$`), "Company suspended"],
  ["POST", new RegExp(`^/admin/sellers/${ID}/unsuspend$`), "Company reactivated"],
  ["POST", /^\/admin\/team$/, "Team member invited"],
  ["POST", new RegExp(`^/admin/team/inviti/${ID}$`), "Invitation updated"],
  ["DELETE", new RegExp(`^/admin/team/inviti/${ID}$`), "Invitation cancelled"],
  ["POST", new RegExp(`^/admin/team/${ID}$`), "Team member updated"],
  ["DELETE", new RegExp(`^/admin/team/${ID}$`), "Team member removed"],
  ["POST", new RegExp(`^/admin/connectors/${ID}$`), "Connector set up"],
  ["DELETE", new RegExp(`^/admin/connectors/${ID}$`), "Connector disconnected"],
  ["POST", /^\/vendor\/products$/, "Product created"],
  ["POST", new RegExp(`^/vendor/products/${ID}$`), "Product change proposed"],
  ["POST", new RegExp(`^/vendor/sellers/${ID}/members$`), "Person invited to the company team"],
  ["POST", new RegExp(`^/vendor/sellers/${ID}/members/${ID}$`), "Role changed in the company team"],
  ["DELETE", new RegExp(`^/vendor/sellers/${ID}/members/${ID}$`), "Person removed from the company team"],
]

/** Ogni sezione dichiara le proprie frasi nel suo file in `src/api/rotte/`. */
export const aggiungiRegole = (nuove: Regola[]) => {
  REGOLE.push(...nuove)
}

export function descriviAzione(metodo: string, percorso: string, esito: number): string {
  const trovata = REGOLE.find(([m, regola]) => m === metodo && regola.test(percorso))?.[2]
  const azione = trovata ?? (metodo === "DELETE" ? "Deletion" : "Change")
  if (esito === 401 || esito === 403) return `Denied: ${azione.toLowerCase()}`
  return esito >= 400 ? `Failed: ${azione.toLowerCase()}` : azione
}
