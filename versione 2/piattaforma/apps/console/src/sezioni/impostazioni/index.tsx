import { Navigate, Route, Routes } from "react-router-dom"
import { Schede, type VoceScheda } from "../../componenti"
import { Pagina } from "../../ui"
import Aspetto from "./Aspetto"
import Avvisi from "./Avvisi"
import Dati from "./Dati"
import Negozio from "./Negozio"
import Spedizioni from "./Spedizioni"
import "./fedele.css"
import "./impostazioni.css"

const SCHEDE: VoceScheda[] = [
  { a: "/impostazioni/negozio", etichetta: "Store" },
  // Team e registro hanno già la loro pagina: qui c'è solo il collegamento.
  { a: "/team", etichetta: "Team" },
  { a: "/impostazioni/spedizioni", etichetta: "Shipping" },
  { a: "/impostazioni/avvisi", etichetta: "Alerts" },
  { a: "/impostazioni/aspetto", etichetta: "Appearance" },
  { a: "/impostazioni/dati", etichetta: "Data" },
  { a: "/registro", etichetta: "Activity log" },
]

export default function Sezione() {
  return (
    <Pagina titolo="Settings" sottotitolo="Your store, shipping and alerts, and how the panel looks.">
      <div className="fedele">
        <Schede voci={SCHEDE} etichetta="Settings" />
        <Routes>
          <Route index element={<Navigate to="negozio" replace />} />
          <Route path="negozio" element={<Negozio />} />
          <Route path="spedizioni" element={<Spedizioni />} />
          <Route path="avvisi" element={<Avvisi />} />
          <Route path="aspetto" element={<Aspetto />} />
          <Route path="dati" element={<Dati />} />
          <Route path="*" element={<Navigate to="/impostazioni/negozio" replace />} />
        </Routes>
      </div>
    </Pagina>
  )
}
