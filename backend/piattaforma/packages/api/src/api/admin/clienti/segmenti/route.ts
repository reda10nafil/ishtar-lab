import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { leggiClienti } from "../lib/clienti"
import { leggiGruppi } from "../lib/gruppi"
import { CAMPO_SEGMENTO, REGOLE, SEGMENTI_DESCRITTI } from "../lib/segmenti"

/** I gruppi hanno un permesso proprio: `customers:view` da solo non li mostra. */
const vedeGruppi = (req: AuthenticatedMedusaRequest) =>
  Boolean((req as unknown as { permissions?: Record<string, string> }).permissions?.customer_groups)

/** Conteggi calcolati ogni volta dai dati veri: con zero clienti ogni segmento vale zero. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const [clienti, gruppi] = await Promise.all([leggiClienti(req), vedeGruppi(req) ? leggiGruppi(req) : []])
  const citta = new Map<string, number>()
  for (const { citta: nome } of clienti) {
    if (nome) citta.set(nome, (citta.get(nome) ?? 0) + 1)
  }
  res.json({
    totale: clienti.length,
    regole: REGOLE,
    segmenti: SEGMENTI_DESCRITTI.map((s) => {
      const membri = clienti.filter((c) => c[CAMPO_SEGMENTO[s.chiave]])
      return {
        ...s,
        conteggio: membri.length,
        media: membri.length ? membri.reduce((totale, c) => totale + c.speso, 0) / membri.length : null,
        anteprima: membri.slice(0, 4).map((c) => ({ id: c.id, nome: c.nome, cognome: c.cognome, email: c.email })),
      }
    }),
    citta: [...citta]
      .map(([nome, conteggio]) => ({ nome, conteggio }))
      .sort((a, b) => b.conteggio - a.conteggio || a.nome.localeCompare(b.nome, "en-GB")),
    gruppi: gruppi.map((g) => ({ id: g.id, nome: g.nome, conteggio: g.membri.length })),
  })
}
