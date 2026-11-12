import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom"
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
import { Sezioni } from "./Sezioni"
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
  return (
    <Pagina
      titolo={admin ? "Products" : "Inventory"}
      sottotitolo={admin ? "Every company's stock in one place. Quantities move the moment they change." : "Your company's stock. Quantities change straight away, with no review."}
      azioni={
        admin && puo("products", "edit") ? (
          <button type="button" className="primario mag-azione-testa" onClick={() => naviga("/prodotti/catalogo?nuovo=1")}>
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
      <Outlet />
    </Pagina>
  )
}

/** Riserve, movimenti e conteggio stanno in un blocco unico, con le stesse voci in alto. */
function Blocco() {
  return (
    <section className="mag-stock mag-stock--interno vetro">
      <div className="mag-stock__azioni"><Sezioni /></div>
      <Outlet />
    </section>
  )
}

function ConVoci() {
  return (
    <>
      <div className="mag-stock__azioni"><Sezioni /></div>
      <Outlet />
    </>
  )
}

export default function Sezione() {
  return (
    <Routes>
      <Route element={<Guscio />}>
        <Route index element={<Navigate to="scorte" replace />} />
        <Route path="scorte" element={<Scorte />} />
        <Route element={<Blocco />}>
          <Route path="conteggio" element={<Conteggio />} />
          <Route path="riserve" element={<Riserve />} />
          <Route path="movimenti" element={<Movimenti />} />
        </Route>
        <Route element={<ConVoci />}>
          <Route path="soglie" element={<Soglie />} />
        </Route>
      </Route>
      <Route path="scorte/:id" element={<SchedaArticolo />} />
      <Route path="*" element={<Navigate to="scorte" replace />} />
    </Routes>
  )
}
