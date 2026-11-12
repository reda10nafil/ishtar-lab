import { Check, MoreHorizontal, type LucideIcon } from "lucide-react"
import { Tendina } from "../../componenti"
import { FASI } from "./testi"
import type { Fase } from "./tipi"

/** I puntini della carta: l'altro modo per spostarla, da tastiera o quando non si vuole trascinare. */
export function MenuSposta({ titolo, fase, icone, onScegli }: { titolo: string; fase: Fase; icone: Record<Fase, LucideIcon>; onScegli: (fase: Fase) => void }) {
  return (
    <Tendina etichetta={`Move ${titolo}`} classe="ing-menu__apri" bottone={<MoreHorizontal size={17} aria-hidden="true" />}>
      {FASI.map((f) => {
        const Icona = icone[f.id]
        return (
          <button key={f.id} type="button" className="ing-menu__voce" disabled={f.id === fase} onClick={() => onScegli(f.id)}>
            <Icona size={16} aria-hidden="true" />
            <span>{f.titolo}</span>
            {f.id === fase ? <Check size={15} aria-hidden="true" /> : null}
          </button>
        )
      })}
    </Tendina>
  )
}
