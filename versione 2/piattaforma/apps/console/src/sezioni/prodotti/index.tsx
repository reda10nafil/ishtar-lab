import { Navigate, Route, Routes, useLocation } from "react-router-dom"
import ProdottiAzienda from "../../pagine/ProdottiAzienda"
import { useSessione } from "../../sessione"
import Catalogo from "./Catalogo"
import Collezioni from "./Collezioni"
import SchedaCollezione from "./SchedaCollezione"
import SchedaProdotto from "./SchedaProdotto"
import "./prodotti.css"

export default function Prodotti() {
  const { sessione } = useSessione()
  const { search } = useLocation()
  if (sessione?.tipo !== "admin") return <ProdottiAzienda />
  return (
    <Routes>
      <Route index element={<Navigate to={`catalogo${search}`} replace />} />
      <Route path="catalogo" element={<Catalogo />}>
        <Route path=":id" element={<SchedaProdotto />} />
      </Route>
      <Route path="collezioni" element={<Collezioni />}>
        <Route path=":id" element={<SchedaCollezione />} />
      </Route>
      <Route path="*" element={<Navigate to="catalogo" replace />} />
    </Routes>
  )
}
