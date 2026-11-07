import type { ReactNode } from "react"

/** Una persona del team: iniziali, nome e dettaglio, poi ruolo e azioni a destra. */
export function Persona({ nome, io, dettaglio, children }: { nome: string; io?: boolean; dettaglio: string; children?: ReactNode }) {
  return (
    <li className="persona">
      <span className="anteprima anteprima--vuota" aria-hidden="true">{nome.slice(0, 2).toUpperCase()}</span>
      <div className="riga__testo">
        <strong>{nome}{io ? " (you)" : ""}</strong>
        <small>{dettaglio}</small>
      </div>
      {children}
    </li>
  )
}
