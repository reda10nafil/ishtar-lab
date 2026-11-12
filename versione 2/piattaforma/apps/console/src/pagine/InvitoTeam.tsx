import { useState, type FormEvent } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { API_URL, accedi } from "../api/client"
import { useSessione } from "../sessione"
import { Campo } from "../ui"

function emailDalCodice(token: string): string {
  try {
    const dati = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { email?: string }
    return dati.email ?? ""
  } catch {
    return ""
  }
}

/** Pagina di attivazione per chi riceve l'invito a collaborare in Ishtar Lab. */
export default function InvitoTeam() {
  const [parametri] = useSearchParams()
  const token = parametri.get("token") ?? ""
  const email = emailDalCodice(token)
  const { apri } = useSessione()
  const naviga = useNavigate()
  const [dati, setDati] = useState({ nome: "", cognome: "", password: "" })
  const [errore, setErrore] = useState("")
  const [attesa, setAttesa] = useState(false)
  const aggiorna = (k: keyof typeof dati) => (e: { target: { value: string } }) => setDati({ ...dati, [k]: e.target.value })

  const invia = async (e: FormEvent) => {
    e.preventDefault()
    setErrore("")
    setAttesa(true)
    try {
      const registra = await fetch(`${API_URL}/auth/user/emailpass/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: dati.password }),
      })
      if (!registra.ok) throw new Error("The account could not be created: it may already exist")
      const { token: accesso } = (await registra.json()) as { token: string }
      const accetta = await fetch(`${API_URL}/admin/invites/accept?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accesso}` },
        body: JSON.stringify({ first_name: dati.nome.trim(), last_name: dati.cognome.trim() }),
      })
      if (!accetta.ok) throw new Error("This invitation is not valid or has expired")
      apri(await accedi("admin", email, dati.password))
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
        <h1>Welcome to Ishtar Lab</h1>
        <p>Activate your team member access.</p>
        {!email ? <p className="avviso-stato avviso-stato--errore" role="alert">The invitation link is not valid.</p> : null}
        <div className="griglia-due">
          <Campo etichetta="First name"><input required autoComplete="given-name" value={dati.nome} onChange={aggiorna("nome")} /></Campo>
          <Campo etichetta="Last name"><input required autoComplete="family-name" value={dati.cognome} onChange={aggiorna("cognome")} /></Campo>
        </div>
        <Campo etichetta="Email"><input type="email" readOnly value={email} /></Campo>
        <Campo etichetta="Password" aiuto="At least 12 characters">
          <input type="password" required minLength={12} autoComplete="new-password" value={dati.password} onChange={aggiorna("password")} />
        </Campo>
        {errore ? <p className="avviso-stato avviso-stato--errore" role="alert">{errore}</p> : null}
        <button type="submit" className="primario" disabled={attesa || !email}>{attesa ? "Activating..." : "Activate access"}</button>
      </form>
    </div>
  )
}
