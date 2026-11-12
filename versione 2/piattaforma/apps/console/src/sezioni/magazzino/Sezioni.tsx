import { NavLink } from "react-router-dom"
import { usePermessi } from "../../permessi"
import { useMagazzino } from "./dati"

/** Funzioni di Ishtar Lab che il pannello non ha: stanno nel blocco, senza spostare le sue schede. */
export function Sezioni() {
  const { admin } = useMagazzino()
  const { puo } = usePermessi()
  const voci = [
    ...(!admin && puo("magazzino", "edit") ? [{ a: "/magazzino/conteggio", etichetta: "Count" }] : []),
    { a: "/magazzino/riserve", etichetta: "Reservations" },
    { a: "/magazzino/movimenti", etichetta: "Movements" },
    { a: "/magazzino/soglie", etichetta: "Reorder points" },
  ]
  return (
    <nav className="mag-sezioni" aria-label="Inventory tools">
      {voci.map((v) => <NavLink key={v.a} to={v.a}>{v.etichetta}</NavLink>)}
    </nav>
  )
}
