import { useRef } from "react"
import { Navigate, Outlet, Route, Routes } from "react-router-dom"
import OrdiniAzienda from "../../pagine/OrdiniAzienda"
import { useSessione } from "../../sessione"
import Bozze from "./Bozze"
import { Guscio } from "./Guscio"
import Resi from "./Resi"
import Scheda from "./Scheda"
import SchedaAzienda from "./SchedaAzienda"
import Tutti from "./Tutti"

function GuscioRotte() {
  const esporta = useRef<(() => void) | null>(null)
  return (
    <Guscio esporta={esporta}>
      <Outlet context={{ esporta }} />
    </Guscio>
  )
}

export default function Sezione() {
  const { sessione } = useSessione()
  const admin = sessione?.tipo === "admin"
  return (
    <Routes>
      <Route element={<GuscioRotte />}>
        <Route index element={<Navigate to="tutti" replace />} />
        <Route path="tutti" element={admin ? <Tutti /> : <OrdiniAzienda />}>
          <Route path=":id" element={admin ? <Scheda /> : <SchedaAzienda />} />
        </Route>
        {admin ? <Route path="bozze" element={<Bozze />} /> : null}
        {admin ? <Route path="resi" element={<Resi />} /> : null}
      </Route>
      <Route path="*" element={<Navigate to="tutti" replace />} />
    </Routes>
  )
}
