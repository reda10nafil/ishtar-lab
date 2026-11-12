import { impostaTema, type Tema } from "../../tema"

/** Stessa chiave di `src/tema.ts`: senza valore salvato il tema segue il sistema. */
const CHIAVE = "ishtar-tema"
const PREFERENZA = "(prefers-color-scheme: light)"

const delSistema = (): Tema => (window.matchMedia(PREFERENZA).matches ? "chiaro" : "scuro")

export function seguiSistema() {
  try {
    return localStorage.getItem(CHIAVE) === null
  } catch {
    return true
  }
}

function dimenticaScelta() {
  try {
    localStorage.removeItem(CHIAVE)
  } catch {
    // Senza memoria del browser non c'è nulla da togliere.
  }
}

/** `impostaTema` salva sempre la scelta: qui il valore va applicato e poi dimenticato. */
export function usaSistema() {
  impostaTema(delSistema())
  dimenticaScelta()
}

window.matchMedia(PREFERENZA).addEventListener("change", () => {
  if (seguiSistema()) usaSistema()
})
