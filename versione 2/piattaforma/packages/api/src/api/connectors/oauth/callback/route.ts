import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONNECTORS_MODULE } from "../../../../modules/connectors"
import type ConnectorsModuleService from "../../../../modules/connectors/service"

export const AUTHENTICATE = false

/** Ritorno dal servizio dopo il login. L'autorizzazione è garantita dallo stato monouso. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { code, state } = req.query as Record<string, string | undefined>
  const destinazione = new URL("/connettori", process.env.CONSOLE_URL)
  const connettori = req.scope.resolve<ConnectorsModuleService>(CONNECTORS_MODULE)
  try {
    if (!code || !state) throw new Error("risposta incompleta")
    const servizio = await connettori.completaLogin(state, code)
    destinazione.searchParams.set("collegato", servizio.id)
  } catch {
    // Il motivo resta fuori dall'indirizzo: la pagina Connettori mostra lo stato aggiornato.
    destinazione.searchParams.set("errore", "login")
  }
  res.redirect(destinazione.toString())
}
