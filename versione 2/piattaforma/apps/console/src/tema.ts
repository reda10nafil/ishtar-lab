import { useSyncExternalStore } from "react"

export type Tema = "chiaro" | "scuro"

const CHIAVE = "ishtar-tema"

function salvato(): Tema | null {
  try {
    const valore = localStorage.getItem(CHIAVE)
    return valore === "chiaro" || valore === "scuro" ? valore : null
  } catch {
    return null
  }
}

let corrente: Tema = salvato() ?? (window.matchMedia("(prefers-color-scheme: light)").matches ? "chiaro" : "scuro")
const ascolti = new Set<() => void>()

function applica(tema: Tema) {
  document.documentElement.dataset.tema = tema
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", tema === "chiaro" ? "#fbf6f3" : "#120d14")
}

applica(corrente)

export function impostaTema(tema: Tema) {
  corrente = tema
  applica(tema)
  try {
    localStorage.setItem(CHIAVE, tema)
  } catch {
    // Senza memoria del browser il tema vale solo per questa visita.
  }
  ascolti.forEach((ascolto) => ascolto())
}

const iscrivi = (ascolto: () => void) => {
  ascolti.add(ascolto)
  return () => void ascolti.delete(ascolto)
}

export function useTema() {
  const tema = useSyncExternalStore(iscrivi, () => corrente)
  return { tema, cambia: impostaTema, alterna: () => impostaTema(tema === "chiaro" ? "scuro" : "chiaro") }
}
