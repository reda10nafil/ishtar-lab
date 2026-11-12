import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { Modules } from "@medusajs/framework/utils"
import { MercurModules } from "@mercurjs/types"
import { interroga } from "../../../utili"
import { assente } from "./assente"
import { SOGLIA_PREDEFINITA, pubblica, type RigaInterna } from "./scorte"

/** `null` toglie la soglia: l'articolo torna a quella dell'azienda, l'azienda a quella predefinita. */
export const valoreSoglia = z
  .number({ message: "Enter a reorder point: a whole number, zero or more" })
  .int("Reorder point must be a whole number")
  .min(0, "Reorder point cannot be negative")
  .max(1_000_000, "Reorder point is too high")
  .nullable()

export async function salvaSogliaArticolo(req: AuthenticatedMedusaRequest, riga: RigaInterna, soglia: number | null) {
  await req.scope.resolve(Modules.INVENTORY).updateInventoryItems({
    id: riga.articolo_id,
    metadata: { ...riga.metadata_articolo, soglia_sicurezza: soglia },
  })
}

type ServizioAziende = { updateSellers: (dati: { id: string; metadata: Record<string, unknown> }[]) => Promise<unknown> }
type AziendaBase = { id: string; name: string; metadata?: Record<string, unknown> | null }

export async function salvaSogliaAzienda(req: AuthenticatedMedusaRequest, aziendaId: string, soglia: number | null) {
  const { data } = await interroga(req).graph({ entity: "seller", fields: ["id", "name", "metadata"], filters: { id: aziendaId } })
  const azienda = data[0] as unknown as AziendaBase | undefined
  if (!azienda) throw assente("Company")
  const aziende = req.scope.resolve<ServizioAziende>(MercurModules.SELLER)
  await aziende.updateSellers([{ id: azienda.id, metadata: { ...azienda.metadata, soglia_sicurezza: soglia } }])
}

/** Soglie in uso, per azienda e per i singoli articoli che ne hanno una propria. */
export async function riepilogoSoglie(req: AuthenticatedMedusaRequest, righe: RigaInterna[], vedeValore: boolean) {
  const perAzienda = new Map<string, RigaInterna[]>()
  for (const riga of righe) perAzienda.set(riga.azienda_id, [...(perAzienda.get(riga.azienda_id) ?? []), riga])
  const { data } = perAzienda.size
    ? await interroga(req).graph({ entity: "seller", fields: ["id", "name", "metadata"], filters: { id: [...perAzienda.keys()] } })
    : { data: [] }
  const aziende = (data as unknown as AziendaBase[]).map((azienda) => {
    const proprie = perAzienda.get(azienda.id) ?? []
    const salvata = azienda.metadata?.soglia_sicurezza
    return {
      id: azienda.id,
      nome: azienda.name,
      soglia: typeof salvata === "number" ? salvata : null,
      articoli: proprie.length,
      sotto_soglia: proprie.filter((r) => r.stato !== "disponibile").length,
    }
  })
  return {
    soglia_predefinita: SOGLIA_PREDEFINITA,
    aziende: aziende.sort((a, b) => a.nome.localeCompare(b.nome, "it")),
    articoli: righe.filter((r) => r.origine_soglia === "articolo").map((r) => pubblica(r, vedeValore)),
  }
}
