import { lazy, Suspense } from "react"
import { useNavigate } from "react-router-dom"

// I moduli sono quelli di Orders e Marketing: si aprono sopra Overview, come nel pannello.
const ModuloBozza = lazy(async () => {
  await import("../../ordini/ordini.css")
  return import("../../ordini/ModuloBozza")
})

const ModuloCampagna = lazy(async () => {
  await import("../../marketing/marketing.css")
  return import("../../marketing/ModuloCampagna")
})

export function NuovoOrdine({ onChiudi }: { onChiudi: () => void }) {
  const naviga = useNavigate()
  return (
    <Suspense fallback={null}>
      <ModuloBozza onChiudi={onChiudi} onCreata={(destinazione) => naviga(destinazione)} />
    </Suspense>
  )
}

export function NuovaCampagna({ onChiudi }: { onChiudi: () => void }) {
  return (
    <Suspense fallback={null}>
      <ModuloCampagna onChiudi={onChiudi} onFatto={onChiudi} />
    </Suspense>
  )
}
