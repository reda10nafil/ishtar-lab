import { permesso, type RottaProtetta } from "./permesso"

/**
 * Overview è la prima schermata di ogni ruolo: `store: view` ce l'hanno tutti e il filtro vero è
 * in `admin/analisi/lib/panoramica.ts`, dove ogni parte segue i permessi di chi la chiede.
 * I margini si controllano nelle rotte: escono solo con il permesso `margini`.
 */
export const rotteAnalisi: RottaProtetta[] = [
  { matcher: "/admin/analisi/panoramica", method: ["GET"], middlewares: [permesso("store", "view")] },
  { matcher: "/vendor/analisi/panoramica", method: ["GET"], middlewares: [permesso("store", "view")] },
  { matcher: "/admin/analisi/vendite", method: ["GET"], middlewares: [permesso("analisi", "view")] },
  { matcher: "/admin/analisi/report", method: ["GET"], middlewares: [permesso("analisi", "view")] },
  { matcher: "/admin/analisi/traffico", method: ["GET"], middlewares: [permesso("analisi", "view")] },
]
