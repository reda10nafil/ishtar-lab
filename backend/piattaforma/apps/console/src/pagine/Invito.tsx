import { useState, type FormEvent } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { API_URL, accedi } from "../api/client"
import { useSessione } from "../sessione"
import { Campo } from "../ui"

/** Pagina di attivazione per chi riceve l'invito di un'azienda. */
export default function Invito() {
  const [parametri] = useSearchParams()
  const token = parametri.get("token") ?? ""
  const { apri } = useSessione()
  const naviga = useNavigate()
  const [dati, setDati] = useState({ nome: "", cognome: "", email: "", password: "" })
  const [errore, setErrore] = useState("")
  const [attesa, setAttesa] = useState(false)
  const aggiorna = (k: keyof typeof dati) => (e: { target: { value: string } }) => setDati({ ...dati, [k]: e.target.value })

  const invia = async (e: FormEvent) => {
    e.preventDefault()
    setErrore("")
    setAttesa(true)
    try {
      const registra = await fetch(`${API_URL}/auth/member/emailpass/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: dati.email.trim(), password: dati.password }),
      })
      if (!registra.ok) throw new Error("The account could not be created: it may already exist")
      const { token: accesso } = (await registra.json()) as { token: string }
      const accetta = await fetch(`${API_URL}/vendor/members/invites/accept`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accesso}` },
        body: JSON.stringify({ invite_token: token, first_name: dati.nome, last_name: dati.cognome }),
      })
      if (!accetta.ok) throw new Error("This invitation is not valid or has expired")
      apri(await accedi("azienda", dati.email.trim(), dati.password))
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
        <p>Activate your company access.</p>
        {!token ? <p className="avviso-stato avviso-stato--errore" role="alert">The invitation link is incomplete.</p> : null}
        <div className="griglia-due">
          <Campo etichetta="First name"><input required autoComplete="given-name" value={dati.nome} onChange={aggiorna("nome")} /></Campo>
          <Campo etichetta="Last name"><input required autoComplete="family-name" value={dati.cognome} onChange={aggiorna("cognome")} /></Campo>
        </div>
        <Campo etichetta="Email" aiuto="Use the address that received the invitation">
          <input type="email" required autoComplete="username" value={dati.email} onChange={aggiorna("email")} />
        </Campo>
        <Campo etichetta="Password" aiuto="At least 12 characters">
          <input type="password" required minLength={12} autoComplete="new-password" value={dati.password} onChange={aggiorna("password")} />
        </Campo>
        {errore ? <p className="avviso-stato avviso-stato--errore" role="alert">{errore}</p> : null}
        <button type="submit" className="primario" disabled={attesa || !token}>{attesa ? "Activating..." : "Activate access"}</button>
      </form>
    </div>
  )
}
