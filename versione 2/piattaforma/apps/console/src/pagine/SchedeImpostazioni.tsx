import type { ReactNode } from "react"
import { Schede, type VoceScheda } from "../componenti"
import { Pagina } from "../ui"

const SCHEDE: VoceScheda[] = [
  { a: "/impostazioni/negozio", etichetta: "Store" },
  { a: "/team", etichetta: "Team" },
  { a: "/impostazioni/spedizioni", etichetta: "Shipping" },
  { a: "/impostazioni/avvisi", etichetta: "Alerts" },
  { a: "/impostazioni/aspetto", etichetta: "Appearance" },
  { a: "/impostazioni/dati", etichetta: "Data" },
  { a: "/registro", etichetta: "Activity log" },
]

/** Team e Activity log hanno rotte proprie ma sono schede di Settings: stessa testata, stesse schede. */
export function PaginaImpostazioni({ children }: { children: ReactNode }) {
  return (
    <Pagina titolo="Settings" sottotitolo="Your store details, shipping, alerts and the look of the panel.">
      <Schede voci={SCHEDE} etichetta="Settings" />
      {children}
    </Pagina>
  )
}
