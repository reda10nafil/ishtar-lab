import { useEffect, useState } from "react"
import { useSessione } from "../sessione"

const ATTESA_RIPROVA = 3000

/** Apre l'app senza chiedere nulla. Se il backend sta ripartendo, riprova da sola. */
export default function Apertura() {
  const { apri } = useSessione()
  const [inAttesa, setInAttesa] = useState(false)

  useEffect(() => {
    let fermo = false
    let timer: ReturnType<typeof setTimeout>
    const prova = async () => {
      try {
        const risposta = await fetch("/__accesso-locale")
        if (!risposta.ok) throw new Error("non pronto")
        const { token, email } = (await risposta.json()) as { token: string; email: string }
        if (!fermo) apri({ tipo: "admin", token, email })
      } catch {
        if (fermo) return
        setInAttesa(true)
        timer = setTimeout(() => void prova(), ATTESA_RIPROVA)
      }
    }
    void prova()
    return () => {
      fermo = true
      clearTimeout(timer)
    }
  }, [apri])

  return (
    <div className="accesso">
      <div className="aurora" aria-hidden="true" />
      <div className="accesso__scheda vetro">
        <span className="marchio__segno marchio__segno--grande" aria-hidden="true">IL</span>
        <h1>Ishtar Lab</h1>
        <p role="status">{inAttesa ? "The server is restarting: opening as soon as it is ready..." : "Opening..."}</p>
      </div>
    </div>
  )
}
