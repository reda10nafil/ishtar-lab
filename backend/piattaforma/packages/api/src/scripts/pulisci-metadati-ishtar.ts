import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { ishtarPulito } from "../api/admin/ishtar/catalogo/vista"

const PAGINA = 1000

/**
 * Toglie dalla scheda Ishtar nei metadati dei prodotti i dati che hanno già una fonte nel database: costo d'acquisto,
 * prezzo, scorte, nome, descrizione, foto e SKU. Copiati lì erano leggibili da chi legge i metadati, anche dal negozio
 * online. Da eseguire una volta dopo l'aggiornamento della rotta `/admin/ishtar/catalogo`, con il pannello chiuso (un
 * salvataggio contemporaneo dello stesso prodotto potrebbe essere riscritto); si può rieseguire senza effetti.
 * Con la parola `controlla` conta i prodotti senza modificarli (un'opzione `--controlla` non arriverebbe allo script:
 * la CLI di Medusa la tratterebbe come sua).
 *
 *   npx medusa exec ./src/scripts/pulisci-metadati-ishtar.ts controlla
 *   npx medusa exec ./src/scripts/pulisci-metadati-ishtar.ts
 */
export default async function pulisciMetadatiIshtar({ container, args }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const soloControllo = (args ?? []).includes("controlla")

  const daPulire: string[] = []
  for (let salto = 0; ; salto += PAGINA) {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "metadata"],
      pagination: { skip: salto, take: PAGINA, order: { id: "ASC" } },
    })
    for (const p of data as Array<{ id: string; metadata?: Record<string, unknown> | null }>) {
      if (ishtarPulito(p.metadata)) daPulire.push(p.id)
    }
    if (data.length < PAGINA) break
  }

  logger.info(`${soloControllo ? "Solo controllo. " : ""}Prodotti Ishtar con costo o altri dati duplicati nei metadati: ${daPulire.length}`)
  if (soloControllo || !daPulire.length) return
  let ripuliti = 0
  for (const id of daPulire) {
    // Rilettura subito prima di scrivere; si scrive solo la scheda Ishtar: Medusa unisce i metadati al primo livello.
    const { data } = await query.graph({ entity: "product", fields: ["id", "metadata"], filters: { id } })
    const scheda = ishtarPulito((data[0] as { metadata?: Record<string, unknown> | null } | undefined)?.metadata)
    if (!scheda) continue
    await updateProductsWorkflow(container).run({ input: { selector: { id }, update: { metadata: { ishtar_v1: scheda } } } })
    ripuliti += 1
  }
  logger.info(`Metadati ripuliti: ${ripuliti}`)
}
