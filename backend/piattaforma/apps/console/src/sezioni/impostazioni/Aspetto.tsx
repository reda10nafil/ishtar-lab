import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react"
import { useReducer } from "react"
import { Riquadro } from "../../componenti"
import { useTema } from "../../tema"
import { seguiSistema, usaSistema } from "./tema-sistema"

type Scelta = "chiaro" | "scuro" | "sistema"

const SCELTE: { valore: Scelta; nome: string; testo: string; icona: LucideIcon }[] = [
  { valore: "chiaro", nome: "Light", testo: "A light background, always.", icona: Sun },
  { valore: "scuro", nome: "Dark", testo: "A dark background, always.", icona: Moon },
  { valore: "sistema", nome: "Match system", testo: "Follows your computer or phone.", icona: Monitor },
]

export default function Aspetto() {
  const { tema, cambia } = useTema()
  // Passare al sistema può lasciare uguale il tema: la pagina si aggiorna lo stesso.
  const [, aggiorna] = useReducer((n: number) => n + 1, 0)
  const scelta: Scelta = seguiSistema() ? "sistema" : tema

  const scegli = (valore: Scelta) => {
    if (valore === "sistema") usaSistema()
    else cambia(valore)
    aggiorna()
  }

  return (
    <div className="impostazioni__moduli">
      <Riquadro titolo="Appearance" testo="Your choice applies to this browser only.">
        <div className="impostazioni__temi" role="radiogroup" aria-label="Theme">
          {SCELTE.map(({ valore, nome, testo, icona: Icona }) => (
            <button key={valore} type="button" role="radio" aria-checked={scelta === valore} onClick={() => scegli(valore)}>
              <Icona size={20} aria-hidden="true" />
              <strong>{nome}</strong>
              <small>{testo}</small>
            </button>
          ))}
        </div>
      </Riquadro>
    </div>
  )
}
