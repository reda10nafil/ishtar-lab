import { memo } from "react"

/**
 * Titolo diviso in parole e lettere; il testo per gli screen reader sta in `aria-label`.
 * Il movimento lo fa la sequenza di entrata della vista: un aggiornamento dei dati non lo ripete.
 */
export const Titolo = memo(function Titolo({ testo }: { testo: string }) {
  const parole = testo.split(" ")
  return (
    <h1 className="titolo-lettere" aria-label={testo}>
      {parole.map((parola, p) => (
        <span key={`${parola}-${p}`} aria-hidden="true">
          <span className="parola">
            {Array.from(parola).map((lettera, l) => (
              <span key={l} className="lettera">{lettera}</span>
            ))}
          </span>
          {p < parole.length - 1 ? " " : null}
        </span>
      ))}
    </h1>
  )
})
