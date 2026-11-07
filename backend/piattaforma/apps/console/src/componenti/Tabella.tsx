import type { ReactNode } from "react"

export type Colonna<T> = { titolo: string; cella: (riga: T) => ReactNode; destra?: boolean }

type Proprieta<T> = {
  colonne: Colonna<T>[]
  righe: T[]
  chiave: (riga: T) => string
  onApri?: (riga: T) => void
  etichetta: string
}

/** Tabella del pannello. Su telefono ogni riga diventa una scheda, via CSS. */
export function Tabella<T>({ colonne, righe, chiave, onApri, etichetta }: Proprieta<T>) {
  return (
    <div className="tabella-guscio vetro">
      <table className="tabella" aria-label={etichetta}>
        <thead>
          <tr>
            {colonne.map((colonna) => (
              <th key={colonna.titolo} scope="col" className={colonna.destra ? "a-destra" : undefined}>{colonna.titolo}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {righe.map((riga) => (
            <tr
              key={chiave(riga)}
              className={onApri ? "tabella__riga--apribile" : undefined}
              tabIndex={onApri ? 0 : undefined}
              onClick={onApri ? () => onApri(riga) : undefined}
              onKeyDown={onApri ? (e) => e.key === "Enter" && onApri(riga) : undefined}
            >
              {colonne.map((colonna) => (
                <td key={colonna.titolo} data-titolo={colonna.titolo} className={colonna.destra ? "a-destra" : undefined}>{colonna.cella(riga)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
