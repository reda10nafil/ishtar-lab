import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework/types"
import { leggiClienti, type Scheda } from "../../clienti/lib/clienti"
import { CAMPO_SEGMENTO, SEGMENTI, REGOLE, type Segmento } from "../../clienti/lib/segmenti"

/** I clienti si leggono dalla stessa fonte di Customers, anche dai lavori in background. */
const comeRichiesta = (scope: MedusaContainer) => ({ scope }) as unknown as AuthenticatedMedusaRequest

const SEGMENTI_INGLESE: Record<Segmento, { nome: string; regola: string }> = {
  nuovi: { nome: "New customers", regola: `Joined in the last ${REGOLE.giorni_nuovo} days` },
  abituali: { nome: "Regulars", regola: `At least ${REGOLE.ordini_abituale} valid orders` },
  grandi: { nome: "Big spenders", regola: "The biggest spenders in Customers" },
  inattivi: { nome: "Lapsed", regola: `No order in the last ${REGOLE.giorni_inattivo} days` },
}

/** Il consenso è quello scritto nella scheda del cliente: senza, nessun invio. */
export const iscritti = (clienti: Scheda[]) => clienti.filter((c) => c.newsletter && c.email)

export const leggiIscritti = async (scope: MedusaContainer) => iscritti(await leggiClienti(comeRichiesta(scope)))

export function appartiene(cliente: Scheda, pubblico: string) {
  if (pubblico === "tutti") return true
  const [tipo, valore] = pubblico.split(/:(.*)/s)
  if (tipo === "segmento") return Boolean(cliente[CAMPO_SEGMENTO[valore as Segmento]])
  if (tipo === "gruppo") return cliente.gruppi.some((g) => g.id === valore)
  return false
}

export const pubblicoValido = (pubblico: string) =>
  pubblico === "tutti" || SEGMENTI.some((s) => pubblico === `segmento:${s}`) || /^gruppo:.+/.test(pubblico)

export const destinatariDi = (clienti: Scheda[], pubblico: string) => clienti.filter((c) => appartiene(c, pubblico))

export function elencoPubblici(clienti: Scheda[]) {
  const gruppi = new Map<string, string>()
  for (const c of clienti) for (const g of c.gruppi) gruppi.set(g.id, g.nome ?? "Group")
  return [
    { chiave: "tutti", nome: "All subscribers", regola: "Everyone who agreed to marketing emails", conteggio: clienti.length },
    ...SEGMENTI.map((s) => ({ chiave: `segmento:${s}`, ...SEGMENTI_INGLESE[s], conteggio: destinatariDi(clienti, `segmento:${s}`).length })),
    ...[...gruppi].map(([id, nome]) => ({ chiave: `gruppo:${id}`, nome, regola: "Customer group", conteggio: destinatariDi(clienti, `gruppo:${id}`).length })),
  ]
}
