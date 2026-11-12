import { CircleHelp, Keyboard, LogOut, Monitor, Moon, Settings, Sun, UsersRound } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { Tendina } from "../componenti"
import { usePermessi } from "../permessi"
import { useSessione } from "../sessione"
import { seguiSistema, usaSistema } from "../sezioni/impostazioni/tema-sistema"
import { useTema } from "../tema"

export default function MenuAccount({ onScorciatoie }: { onScorciatoie: () => void }) {
  const { sessione, chiudi } = useSessione()
  const { ruolo, puo } = usePermessi()
  const { tema, cambia } = useTema()
  const [dalSistema, setDalSistema] = useState(seguiSistema)
  const iniziali = (sessione?.email ?? "?").slice(0, 2).toUpperCase()
  const etichetta = ruolo?.etichetta ?? (sessione?.tipo === "admin" ? "Owner" : sessione?.aziendaNome)
  const scegli = (scelta: "chiaro" | "scuro") => {
    cambia(scelta)
    setDalSistema(false)
  }
  const sistema = () => {
    usaSistema()
    setDalSistema(true)
  }

  return (
    <Tendina etichetta="Your account" classe="avatar-pulsante" chiudiAlClic bottone={<span className="avatar" title={sessione?.email}>{iniziali}</span>}>
      <div className="tendina__testa">
        <strong>{sessione?.email}</strong>
        <small>{etichetta}</small>
      </div>
      <button type="button" data-resta onClick={() => scegli("chiaro")}><Sun size={17} aria-hidden="true" /> Light{!dalSistema && tema === "chiaro" ? " ✓" : ""}</button>
      <button type="button" data-resta onClick={() => scegli("scuro")}><Moon size={17} aria-hidden="true" /> Dark{!dalSistema && tema === "scuro" ? " ✓" : ""}</button>
      <button type="button" data-resta onClick={sistema}><Monitor size={17} aria-hidden="true" /> Match system{dalSistema ? " ✓" : ""}</button>
      <div className="tendina__linea" role="separator" />
      {puo("impostazioni", "view") ? <Link to="/impostazioni/negozio"><Settings size={17} aria-hidden="true" /> Store settings</Link> : null}
      {puo("members", "view") ? <Link to="/team"><UsersRound size={17} aria-hidden="true" /> Team</Link> : null}
      {puo("assistenza", "view") ? <Link to="/assistenza"><CircleHelp size={17} aria-hidden="true" /> Help &amp; support</Link> : null}
      <button type="button" onClick={onScorciatoie}><Keyboard size={17} aria-hidden="true" /> Keyboard shortcuts <kbd className="tasto">?</kbd></button>
      <div className="tendina__linea" role="separator" />
      <button type="button" className="pericolo" onClick={chiudi}><LogOut size={17} aria-hidden="true" /> Sign out</button>
    </Tendina>
  )
}
