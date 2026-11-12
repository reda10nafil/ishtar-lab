import type { ReactNode } from "react"
import { Iniziali } from "./Iniziali"

/** Una persona del team: iniziali, nome e dettaglio, poi ruolo e comandi a destra. */
export function Persona({ nome, io, dettaglio, spenta, children }: { nome: string; io?: boolean; dettaglio: string; spenta?: boolean; children?: ReactNode }) {
  return (
    <li data-riga className={`persona${spenta ? " persona--spenta" : ""}`}>
      <Iniziali nome={nome} tonda punto={!spenta} />
      <div className="persona__testo">
        <strong>{nome}{io ? <small> · you</small> : null}</strong>
        <small>{dettaglio}</small>
      </div>
      {children}
    </li>
  )
}
