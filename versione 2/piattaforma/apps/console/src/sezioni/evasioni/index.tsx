import { Navigate, Route, Routes } from "react-router-dom"
import { Guscio } from "../ordini/Guscio"
import Coda from "./Coda"

export default function Sezione() {
  return (
    <Routes>
      <Route index element={<Guscio><Coda /></Guscio>} />
      <Route path="*" element={<Navigate to="/evasioni" replace />} />
    </Routes>
  )
}
