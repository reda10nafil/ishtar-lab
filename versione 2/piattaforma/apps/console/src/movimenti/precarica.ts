const ATTESA = 1500

/**
 * Scarica le sezioni quando l'app è ferma: così il primo cambio di pagina è pronto
 * nel momento in cui finisce l'uscita, e la nuova pagina entra senza vuoti.
 */
export function precaricaSezioni() {
  const sezioni = import.meta.glob("../sezioni/*/index.tsx")
  const carica = () => {
    for (const importa of Object.values(sezioni)) void importa().catch(() => undefined)
  }
  const attesa = window.setTimeout(() => {
    if ("requestIdleCallback" in window) window.requestIdleCallback(carica)
    else carica()
  }, ATTESA)
  return () => clearTimeout(attesa)
}
