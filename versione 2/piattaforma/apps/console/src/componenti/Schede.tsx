import { NavLink } from "react-router-dom"

export type VoceScheda = { a: string; etichetta: string; conteggio?: number }

/** Sotto-sezioni di una pagina: ogni scheda è una rotta, quindi si può aprire e condividere. */
export function Schede({ voci, etichetta = "Sections" }: { voci: VoceScheda[]; etichetta?: string }) {
  return (
    <nav className="schede" aria-label={etichetta}>
      {voci.map((voce) => (
        <NavLink key={voce.a} to={voce.a}>
          {voce.etichetta}
          {voce.conteggio ? <em>{voce.conteggio}</em> : null}
        </NavLink>
      ))}
    </nav>
  )
}
