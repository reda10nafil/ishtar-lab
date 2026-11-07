import { Search } from "lucide-react"

export function CampoRicerca({ valore, etichetta, onCambia }: { valore: string; etichetta: string; onCambia: (valore: string) => void }) {
  return (
    <label className="cerca">
      <Search size={17} aria-hidden="true" />
      <input type="search" value={valore} placeholder={etichetta} aria-label={etichetta} onChange={(e) => onCambia(e.target.value)} />
    </label>
  )
}
