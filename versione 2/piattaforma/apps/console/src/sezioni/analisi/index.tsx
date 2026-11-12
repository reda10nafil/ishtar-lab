import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom"
import { Schede } from "../../componenti"
import { Pagina } from "../../ui"
import "./analisi.css"
import "./panoramica.css"
import Report from "./Report"
import Traffico from "./Traffico"
import Vendite from "./Vendite"

const SOTTOTITOLI: Record<string, string> = {
  "/analisi/vendite": "A year of sales, split by where each one happened.",
  "/analisi/traffico": "Who comes to the online shop, when, and from where.",
  "/analisi/report": "Pick a measure, see the chart, take the numbers away.",
}

function Guscio() {
  const { pathname } = useLocation()
  return (
    <Pagina titolo="Analytics" sottotitolo={SOTTOTITOLI[pathname] ?? SOTTOTITOLI["/analisi/vendite"]}>
      <Schede
        etichetta="Analytics sections"
        voci={[
          { a: "/analisi/vendite", etichetta: "Sales" },
          { a: "/analisi/traffico", etichetta: "Traffic" },
          { a: "/analisi/report", etichetta: "Report builder" },
        ]}
      />
      <Outlet />
    </Pagina>
  )
}

export default function Sezione() {
  return (
    <Routes>
      <Route element={<Guscio />}>
        <Route index element={<Navigate to="vendite" replace />} />
        <Route path="vendite" element={<Vendite />} />
        <Route path="traffico" element={<Traffico />} />
        <Route path="report" element={<Report />} />
      </Route>
      <Route path="*" element={<Navigate to="vendite" replace />} />
    </Routes>
  )
}
