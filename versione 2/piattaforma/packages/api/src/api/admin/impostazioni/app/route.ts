import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { impostazioniDi, leggiStore, type Store } from "../lettura"
import { APP_DEMO } from "./catalogo"

/** Stato di ogni app: quello salvato, oppure com'è al primo avvio. */
export function vistaApp(store: Store) {
  const { app } = impostazioniDi(store)
  return {
    app: APP_DEMO.map(({ predefinita, ...dati }) => {
      const salvato = app[dati.id]
      return { ...dati, installata: salvato?.installata ?? Boolean(predefinita), attiva: salvato?.attiva ?? predefinita?.attiva ?? false }
    }),
    // Per i connettori conta solo se sono accesi: collegarli resta compito del loro modulo.
    connettori_spenti: Object.entries(app).filter(([id, stato]) => !APP_DEMO.some((a) => a.id === id) && stato.attiva === false).map(([id]) => id),
  }
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(vistaApp(await leggiStore(req.scope)))
}
