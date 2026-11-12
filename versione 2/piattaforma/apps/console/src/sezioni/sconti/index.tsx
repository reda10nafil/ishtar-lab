import { Navigate, Route, Routes, useLocation } from "react-router-dom"
import { useSessione } from "../../sessione"
import CarteRegalo from "./CarteRegalo"
import Codici from "./Codici"
import Proposte from "./Proposte"
import ProposteAzienda from "./ProposteAzienda"
import "./sconti.css"

function SezioneAdmin() {
  const { search } = useLocation()
  return (
    <Routes>
      <Route index element={<Navigate to={`/sconti/codici${search}`} replace />} />
      <Route path="codici" element={<Codici />} />
      <Route path="carte-regalo" element={<CarteRegalo />} />
      <Route path="proposte" element={<Proposte />} />
      <Route path="*" element={<Navigate to="/sconti/codici" replace />} />
    </Routes>
  )
}

/** L'azienda non ha schede: vede soltanto le proprie proposte. */
export default function Sezione() {
  const { sessione } = useSessione()
  return sessione?.tipo === "admin" ? <SezioneAdmin /> : <ProposteAzienda />
}
