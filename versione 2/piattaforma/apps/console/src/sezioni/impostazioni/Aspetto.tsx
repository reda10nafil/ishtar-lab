import { useEffect, useReducer, useState } from "react"
import { Riquadro } from "../../componenti"
import { useTema } from "../../tema"
import { seguiSistema, usaSistema } from "./tema-sistema"

type Scelta = "chiaro" | "scuro" | "sistema"

const SCELTE: { valore: Scelta; nome: string }[] = [
  { valore: "chiaro", nome: "Light" },
  { valore: "scuro", nome: "Dark" },
  { valore: "sistema", nome: "Match system" },
]

/** Il menu laterale è del guscio: il pulsante della testata resta l'unico che lo cambia. */
const pulsanteMenu = () => document.querySelector<HTMLButtonElement>(".riduci-menu")
const menuStretto = () => pulsanteMenu()?.getAttribute("aria-label") === "Expand sidebar"

export default function Aspetto() {
  const { tema, cambia } = useTema()
  // Passare al sistema può lasciare uguale il tema: la pagina si aggiorna lo stesso.
  const [, aggiorna] = useReducer((n: number) => n + 1, 0)
  const [stretto, setStretto] = useState(false)
  const scelta: Scelta = seguiSistema() ? "sistema" : tema

  useEffect(() => setStretto(menuStretto()), [])

  const scegli = (valore: Scelta) => {
    if (valore === "sistema") usaSistema()
    else cambia(valore)
    aggiorna()
  }
  const larghezzaMenu = (voluto: boolean) => {
    if (menuStretto() !== voluto) pulsanteMenu()?.click()
    setStretto(voluto)
  }

  return (
    <div className="impostazioni__moduli">
      <Riquadro titolo="Appearance" testo="Only for you, on this browser">
        <div className="impostazioni__temi" role="radiogroup" aria-label="Theme">
          {SCELTE.map(({ valore, nome }) => (
            <button key={valore} type="button" role="radio" aria-checked={scelta === valore} aria-label={nome} onClick={() => scegli(valore)}>
              <span className={`tema-anteprima tema-anteprima--${valore}`} aria-hidden="true"><i /><i /><i /></span>
              <strong>{nome}</strong>
            </button>
          ))}
        </div>
        <div className="impostazione impostazione--menu">
          <div>
            <strong>Sidebar</strong>
            <p>Fold it down to icons for more room · shortcut [</p>
          </div>
          <div className="segmento" role="group" aria-label="Sidebar">
            <button type="button" aria-pressed={!stretto} onClick={() => larghezzaMenu(false)}>Full</button>
            <button type="button" aria-pressed={stretto} onClick={() => larghezzaMenu(true)}>Icons</button>
          </div>
        </div>
      </Riquadro>
    </div>
  )
}
