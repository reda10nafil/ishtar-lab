import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { leggiClienti, type Scheda } from "../lib/clienti"
import { leggiGruppi } from "../lib/gruppi"
import { REGOLE } from "../lib/segmenti"

/** I gruppi hanno un permesso proprio: `customers:view` da solo non li mostra. */
const vedeGruppi = (req: AuthenticatedMedusaRequest) =>
  Boolean((req as unknown as { permissions?: Record<string, string> }).permissions?.customer_groups)

function riga(chiave: string, nome: string, membri: Scheda[]) {
  return {
    chiave,
    nome,
    conteggio: membri.length,
    media: membri.length ? membri.reduce((totale, c) => totale + c.speso, 0) / membri.length : null,
    anteprima: membri.slice(0, 4).map((c) => ({ id: c.id, nome: c.nome, cognome: c.cognome, email: c.email })),
  }
}

/** Conteggi calcolati ogni volta dai dati veri: con zero clienti ogni segmento vale zero. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const [clienti, gruppi] = await Promise.all([leggiClienti(req), vedeGruppi(req) ? leggiGruppi(req) : []])
  const citta = new Map<string, number>()
  for (const { citta: nome } of clienti) {
    if (nome) citta.set(nome, (citta.get(nome) ?? 0) + 1)
  }
  const inOrdine = [...citta].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en-GB"))
  const casa = inOrdine[0]?.[0] ?? null
  res.json({
    totale: clienti.length,
    regole: REGOLE,
    segmenti: [
      riga("abituali", "Regulars", clienti.filter((c) => c.abituale)),
      riga("grandi", "Big spenders", clienti.filter((c) => c.grande)),
      riga("nuovi", "First-timers", clienti.filter((c) => c.nuovo)),
      riga("newsletter", "Newsletter", clienti.filter((c) => c.newsletter)),
      riga("locali", "Locals", clienti.filter((c) => casa !== null && c.citta === casa)),
      riga("inattivi", "Gone quiet", clienti.filter((c) => c.inattivo)),
    ],
    casa,
    citta: [...citta]
      .map(([nome, conteggio]) => ({ nome, conteggio }))
      .sort((a, b) => b.conteggio - a.conteggio || a.nome.localeCompare(b.nome, "en-GB")),
    gruppi: gruppi.map((g) => ({ id: g.id, nome: g.nome, conteggio: g.membri.length })),
  })
}
