import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { NavLink, Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom"
import { api } from "../../api/client"
import { Schede } from "../../componenti"
import { usePermessi } from "../../permessi"
import { Pagina } from "../../ui"
import Conteggio from "./Conteggio"
import { useMagazzino } from "./dati"
import "./magazzino.css"
import Movimenti from "./Movimenti"
import Riserve from "./Riserve"
import SchedaArticolo from "./SchedaArticolo"
import Scorte from "./Scorte"
import Soglie from "./Soglie"

/** Per l'amministratore Inventory è una scheda di Products; l'azienda ha la propria voce di menu. */
function Guscio() {
  const { admin, base } = useMagazzino()
  const { puo } = usePermessi()
  const naviga = useNavigate()
  const basse = useQuery({
    queryKey: ["magazzino", "avvisi", base],
    queryFn: () => api<{ conteggio: number }>(`${base}/scorte-basse`),
    enabled: admin,
  })
  const sezioni = [
    { a: "/magazzino/scorte", etichetta: "Stock" },
    ...(!admin && puo("magazzino", "edit") ? [{ a: "/magazzino/conteggio", etichetta: "Count" }] : []),
    { a: "/magazzino/riserve", etichetta: "Reservations" },
    { a: "/magazzino/movimenti", etichetta: "Movements" },
    { a: "/magazzino/soglie", etichetta: "Safety stock" },
  ]
  return (
    <Pagina
      titolo={admin ? "Products" : "Inventory"}
      sottotitolo={admin ? "Stock held in each company's warehouse. Quantities change as soon as a company updates them." : "Your company's stock. Quantities change straight away, with no review."}
      azioni={
        admin && puo("products", "edit") ? (
          <button type="button" className="primario" onClick={() => naviga("/prodotti/catalogo?nuovo=1")}>
            <Plus size={17} aria-hidden="true" /> New product
          </button>
        ) : undefined
      }
    >
      {admin ? (
        <Schede
          etichetta="Product sections"
          voci={[
            { a: "/prodotti/catalogo", etichetta: "Catalogue" },
            { a: "/magazzino", etichetta: "Inventory", conteggio: basse.data?.conteggio },
            { a: "/prodotti/collezioni", etichetta: "Collections" },
          ]}
        />
      ) : null}
      <nav className="mag-sezioni" aria-label="Inventory sections">
        {sezioni.map((s) => <NavLink key={s.a} to={s.a}>{s.etichetta}</NavLink>)}
      </nav>
      <Outlet />
    </Pagina>
  )
}

export default function Sezione() {
  return (
    <Routes>
      <Route element={<Guscio />}>
        <Route index element={<Navigate to="scorte" replace />} />
        <Route path="scorte" element={<Scorte />} />
        <Route path="conteggio" element={<Conteggio />} />
        <Route path="riserve" element={<Riserve />} />
        <Route path="movimenti" element={<Movimenti />} />
        <Route path="soglie" element={<Soglie />} />
      </Route>
      <Route path="scorte/:id" element={<SchedaArticolo />} />
      <Route path="*" element={<Navigate to="scorte" replace />} />
    </Routes>
  )
}
