import { lazy, Suspense } from "react"
import { Route, Routes, useSearchParams } from "react-router-dom"

// La scheda è quella di Orders, con il suo cassetto e le sue azioni: qui cambia solo cosa resta sotto.
const Scheda = lazy(async () => {
  await import("../../ordini/ordini.css")
  return import("../../ordini/Scheda")
})

/** Pack e le ultime vendite aprono l'ordine sopra Overview; chiudendo si torna qui. */
export default function SchedaOrdine() {
  const [cerca] = useSearchParams()
  const id = cerca.get("ordine")
  if (!id) return null
  const posizione = { pathname: `/ordini/tutti/${id}`, search: "", hash: "", key: id, state: { da: "/" } }
  return (
    <Suspense fallback={null}>
      <Routes location={posizione}>
        <Route path="/ordini/tutti/:id" element={<Scheda />} />
      </Routes>
    </Suspense>
  )
}
