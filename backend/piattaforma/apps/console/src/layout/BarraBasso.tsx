import { MoreHorizontal } from "lucide-react"
import { NavLink } from "react-router-dom"
import type { Voce } from "./voci"

/** Su telefono: quattro voci principali e «More» per il menu completo. */
export default function BarraBasso({ voci, onAltro }: { voci: Voce[]; onAltro: () => void }) {
  return (
    <nav className="barra-basso vetro" aria-label="Quick navigation">
      {voci.slice(0, 4).map(({ a, etichetta, icona: Icona }) => (
        <NavLink key={a} to={a} end={a === "/"}>
          <Icona size={21} aria-hidden="true" />
          <span>{a === "/" ? "Home" : etichetta === "My products" ? "Products" : etichetta}</span>
        </NavLink>
      ))}
      <button type="button" onClick={onAltro}>
        <MoreHorizontal size={21} aria-hidden="true" />
        <span>More</span>
      </button>
    </nav>
  )
}
