import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { Navigate, Route, Routes, useLocation, useSearchParams } from "react-router-dom"
import { api } from "../../api/client"
import { usePermessi } from "../../permessi"
import { Pagina } from "../../ui"
import Bacheca from "./Bacheca"
import "./ingrosso.css"
import Rivenditori from "./Rivenditori"
import { conteggioDi } from "./testi"
import type { Rivenditore } from "./tipi"

/** Una sola pagina, come nel pannello: riquadri, colonne e rivenditori uno sotto l'altro. */
function Pannello() {
  const { puo } = usePermessi()
  const [, setParametri] = useSearchParams()
  const query = useQuery({ queryKey: ["ingrosso", "rivenditori"], queryFn: () => api<{ rivenditori: Rivenditore[] }>("/admin/ingrosso/rivenditori") })
  const quanti = query.data?.rivenditori.length ?? 0

  return (
    <Pagina
      titolo="Wholesale"
      sottotitolo={quanti ? `${conteggioDi(quanti, "stockist")} on your books. Drag a deal to move it along.` : "Stockists and deals, all the way to a draft order."}
      azioni={quanti && puo("ingrosso", "edit") ? <button type="button" className="primario" onClick={() => setParametri({ nuovo: "1" })}><Plus size={17} aria-hidden="true" /> New deal</button> : undefined}
    >
      <Bacheca />
      <Rivenditori />
    </Pagina>
  )
}

export default function Ingrosso() {
  const { search } = useLocation()
  return (
    <Routes>
      <Route index element={<Pannello />} />
      <Route path="*" element={<Navigate to={`/ingrosso${search}`} replace />} />
    </Routes>
  )
}
