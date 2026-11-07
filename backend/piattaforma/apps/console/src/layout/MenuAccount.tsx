import { LogOut, Moon, Settings, Sun } from "lucide-react"
import { Link } from "react-router-dom"
import { Tendina } from "../componenti"
import { usePermessi } from "../permessi"
import { useSessione } from "../sessione"
import { useTema } from "../tema"

export default function MenuAccount() {
  const { sessione, chiudi } = useSessione()
  const { ruolo, puo } = usePermessi()
  const { tema, alterna } = useTema()
  const iniziali = (sessione?.email ?? "?").slice(0, 2).toUpperCase()
  const chiaro = tema === "chiaro"
  return (
    <Tendina etichetta="Your account" classe="avatar-pulsante" bottone={<span className="avatar" title={sessione?.email}>{iniziali}</span>}>
      <div className="tendina__testa">
        <strong>{sessione?.email}</strong>
        <small>{ruolo?.etichetta ?? (sessione?.tipo === "admin" ? "Admin" : sessione?.aziendaNome)}</small>
      </div>
      <button type="button" onClick={alterna}>
        {chiaro ? <Moon size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />} {chiaro ? "Dark theme" : "Light theme"}
      </button>
      {puo("impostazioni", "view") ? <Link to="/impostazioni"><Settings size={17} aria-hidden="true" /> Settings</Link> : null}
      {sessione?.tipo === "azienda" ? <button type="button" onClick={chiudi}><LogOut size={17} aria-hidden="true" /> Sign out</button> : null}
    </Tendina>
  )
}
