import type { MedusaContainer } from "@medusajs/framework/types"
import { CONNECTORS_MODULE } from "../modules/connectors"
import type ConnectorsModuleService from "../modules/connectors/service"

/** Rinnova ogni ora gli accessi che scadono entro un giorno. */
export default async function rinnovaConnettori(container: MedusaContainer) {
  const connettori = container.resolve<ConnectorsModuleService>(CONNECTORS_MODULE)
  await connettori.rinnovaScadenze()
}

export const config = { name: "rinnova-connettori", schedule: "0 * * * *" }
