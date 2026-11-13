import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { invalido } from "../../../utili"

type ConSku = { sku: string }

const conCodici = async (scope: MedusaContainer, entity: string, codici: string[]) => {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity, fields: ["sku"], filters: { sku: codici } })
  return (data as ConSku[]).map((r) => r.sku)
}

/**
 * Codici liberi prima di creare un prodotto. Lo SKU è unico anche sulle voci di magazzino: una voce rimasta orfana con lo
 * stesso codice farebbe fallire la creazione a metà strada, dopo aver già creato prodotto e variante.
 */
export async function controllaCodici(scope: MedusaContainer, codici: string[]) {
  const doppio = codici.find((codice, indice) => codici.indexOf(codice) !== indice)
  if (doppio) throw invalido(`The code ${doppio} is repeated: every variant needs its own`)
  const [usato] = await conCodici(scope, "variant", codici)
  if (usato) throw invalido(`The code ${usato} is already used by another item`)
  const [voce] = await conCodici(scope, "inventory_item", codici)
  if (voce) throw invalido(`The code ${voce} is already used by a stock item`)
}

/**
 * Resti di una creazione annullata: varianti o voci di magazzino con quei codici. Un workflow annidato che non riesce ad
 * annullarsi da solo non lo fa sapere al workflow esterno; se resta qualcosa, il salvataggio è rimasto a metà.
 */
export async function restiDeiCodici(scope: MedusaContainer, codici: string[]) {
  const [varianti, voci] = await Promise.all([conCodici(scope, "variant", codici), conCodici(scope, "inventory_item", codici)])
  return [...varianti, ...voci]
}
