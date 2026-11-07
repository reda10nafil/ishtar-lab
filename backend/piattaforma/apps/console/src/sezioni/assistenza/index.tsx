import { Navigate, Route, Routes } from "react-router-dom"
import Domande from "./Domande"
import Richiesta from "./Richiesta"
import Richieste from "./Richieste"
import "./assistenza.css"

export default function Sezione() {
  return (
    <Routes>
      <Route index element={<Domande />} />
      <Route path="richieste" element={<Richieste />} />
      <Route path="richieste/:id" element={<Richiesta />} />
      <Route path="*" element={<Navigate to="/assistenza" replace />} />
    </Routes>
  )
}
