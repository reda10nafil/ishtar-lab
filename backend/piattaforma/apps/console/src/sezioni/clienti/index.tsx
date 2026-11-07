import { useQuery } from "@tanstack/react-query"
import { UserPlus } from "lucide-react"
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom"
import { api } from "../../api/client"
import { Schede } from "../../componenti"
import { numero } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Pagina } from "../../ui"
import "./clienti.css"
import Persone from "./Persone"
import SchedaCliente from "./SchedaCliente"
import Segmenti from "./Segmenti"
import type { ElencoClienti } from "./tipi"

function Guscio() {
  const { puo } = usePermessi()
  const naviga = useNavigate()
  const { pathname } = useLocation()
  const { data } = useQuery({ queryKey: ["clienti", "totali"], queryFn: () => api<ElencoClienti>("/admin/clienti?limit=1") })
  const totale = data?.conteggi.tutti ?? 0
  const quanti = `${numero(totale)} ${totale === 1 ? "customer" : "customers"}, ${numero(data?.conteggi.rivenditori ?? 0)} of them stockists.`
  return (
    <Pagina
      titolo="Customers"
      sottotitolo={pathname.endsWith("/segmenti") ? "Counted live from your real customers and orders." : quanti}
      azioni={
        puo("customers", "edit") ? (
          <button type="button" className="primario" onClick={() => naviga("/clienti/persone?nuovo=1")}>
            <UserPlus size={17} aria-hidden="true" /> Add customer
          </button>
        ) : undefined
      }
    >
      <Schede
        etichetta="Customer sections"
        voci={[
          { a: "/clienti/persone", etichetta: "People" },
          { a: "/clienti/segmenti", etichetta: "Segments" },
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
        <Route index element={<Navigate to="persone" replace />} />
        <Route path="persone" element={<Persone />} />
        <Route path="segmenti" element={<Segmenti />} />
      </Route>
      <Route path="persone/:id" element={<SchedaCliente />} />
      <Route path="*" element={<Navigate to="persone" replace />} />
    </Routes>
  )
}
