import { useState, type FormEvent } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { accedi } from "../api/client"
import { useSessione } from "../sessione"
import { Campo } from "../ui"

/** Solo per gli account delle aziende. L'amministratore entra direttamente: vedi `layout/Apertura.tsx`. */
export default function Accesso() {
  const { sessione, apri } = useSessione()
  const naviga = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errore, setErrore] = useState("")
  const [attesa, setAttesa] = useState(false)

  if (sessione) return <Navigate to="/" replace />

  const invia = async (e: FormEvent) => {
    e.preventDefault()
    setErrore("")
    setAttesa(true)
    try {
      apri(await accedi("azienda", email.trim(), password))
      naviga("/", { replace: true })
    } catch (motivo) {
      setErrore((motivo as Error).message)
    } finally {
      setAttesa(false)
    }
  }

  return (
    <div className="accesso">
      <div className="aurora" aria-hidden="true" />
      <form className="accesso__scheda vetro" onSubmit={invia}>
        <span className="marchio__segno marchio__segno--grande" aria-hidden="true">IL</span>
        <h1>Ishtar Lab</h1>
        <p>Sign in for partner companies.</p>
        <Campo etichetta="Email">
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Campo>
        <Campo etichetta="Password">
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Campo>
        {errore ? <p className="avviso-stato avviso-stato--errore" role="alert">{errore}</p> : null}
        <button type="submit" className="primario" disabled={attesa}>{attesa ? "Signing in..." : "Sign in"}</button>
      </form>
    </div>
  )
}
