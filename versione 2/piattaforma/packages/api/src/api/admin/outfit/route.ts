import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { interroga, valida } from "../../utili"
import { chiaveCoppia, coppieDi, corrisponde, puoVedereMargini, schedeDi, servizioOutfit, sintesiOutfit, vistaOutfit, type RigaOutfit } from "./lettura"
import { FiltriElenco, NuovoOutfit } from "./schemi"

/** Tetto dell'elenco: disponibilità e azienda dipendono dal catalogo e si filtrano dopo la lettura. */
const MASSIMO = 500

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { q, stato, azienda, disponibilita, limit, offset } = valida(FiltriElenco, req.query)
  const righe = await servizioOutfit(req).listOutfits({}, { relations: ["capi"], order: { updated_at: "DESC" }, take: MASSIMO })
  const tutti = righe as unknown as RigaOutfit[]
  const schede = await schedeDi(interroga(req), tutti)
  const margini = puoVedereMargini(req)

  const trovati = q ? tutti.filter((o) => corrisponde(o, schede, q)) : tutti
  const inStato = stato ? trovati.filter((o) => o.stato === stato) : trovati

  /** Le pillole contano gli outfit dello stato scelto, come quelle del catalogo del pannello. */
  const aziende = new Map<string, { nome: string; outfit: Set<string> }>()
  for (const riga of inStato) {
    for (const coppia of riga.capi.flatMap(coppieDi)) {
      const nome = schede.get(chiaveCoppia(coppia))?.azienda_nome
      if (!nome) continue
      const voce = aziende.get(coppia.azienda_id) ?? { nome, outfit: new Set<string>() }
      voce.outfit.add(riga.id)
      aziende.set(coppia.azienda_id, voce)
    }
  }

  const viste = inStato
    .filter((o) => !azienda || o.capi.some((c) => c.azienda_id === azienda || c.alternativa_azienda_id === azienda))
    .map((o) => vistaOutfit(o, schede, margini))
    .filter((v) => !disponibilita || v.disponibilita.acquistabile === (disponibilita === "acquistabili"))

  res.json({
    outfit: viste.slice(offset, offset + limit).map(sintesiOutfit),
    count: viste.length,
    offset,
    limit,
    conteggi: {
      bozza: trovati.filter((o) => o.stato === "bozza").length,
      pubblicato: trovati.filter((o) => o.stato === "pubblicato").length,
      archiviato: trovati.filter((o) => o.stato === "archiviato").length,
    },
    aziende: [...aziende].map(([id, voce]) => ({ id, nome: voce.nome, outfit: voce.outfit.size })).sort((a, b) => a.nome.localeCompare(b.nome, "en")),
  })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const corpo = valida(NuovoOutfit, req.body)
  const creato = await servizioOutfit(req).createOutfits({ nome: corpo.nome, descrizione: corpo.descrizione ?? null })
  const outfit = { ...creato, capi: [] } as unknown as RigaOutfit
  res.status(201).json({ outfit: vistaOutfit(outfit, new Map(), puoVedereMargini(req)) })
}
