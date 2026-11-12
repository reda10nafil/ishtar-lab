import { numero } from "../lingua"

export function Paginazione({ pagina, perPagina, totale, onCambia }: { pagina: number; perPagina: number; totale: number; onCambia: (pagina: number) => void }) {
  const ultima = Math.max(1, Math.ceil(totale / perPagina))
  if (ultima <= 1) return null
  return (
    <nav className="paginazione" aria-label="Pages">
      <span>Page {numero(pagina)} of {numero(ultima)}</span>
      <button type="button" disabled={pagina <= 1} onClick={() => onCambia(pagina - 1)}>Previous</button>
      <button type="button" disabled={pagina >= ultima} onClick={() => onCambia(pagina + 1)}>Next</button>
    </nav>
  )
}
