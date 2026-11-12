import { Route, Routes } from "react-router-dom"
import { useSessione } from "../../sessione"
import Editor from "./Editor"
import Elenco from "./Elenco"
import ElencoAzienda from "./ElencoAzienda"
import SchedaAzienda from "./SchedaAzienda"
import "./outfit.css"

/** Amministratore e azienda hanno pagine diverse: all'azienda arrivano solo i propri capi. */
export default function Sezione() {
  const { sessione } = useSessione()
  const azienda = sessione?.tipo === "azienda"
  return (
    <div className="outfit-sezione">
      <Routes>
        <Route index element={azienda ? <ElencoAzienda /> : <Elenco />} />
        <Route path=":id" element={azienda ? <SchedaAzienda /> : <Editor />} />
      </Routes>
    </div>
  )
}
