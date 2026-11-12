/**
 * Curve e durate misurate a schermo sul pannello di riferimento. Le curve non esprimibili
 * con un cubic-bezier diventano una funzione `linear()` campionata: stessa forma, nessuna libreria.
 */
type Curva = (u: number) => number

const tabella = (curva: Curva, passi = 48) =>
  `linear(${Array.from({ length: passi + 1 }, (_, i) => Number(curva(i / passi).toFixed(4))).join(", ")})`

const fuori = (grado: number): Curva => (u) => 1 - (1 - u) ** grado
const dentro = (grado: number): Curva => (u) => u ** grado
/** Supera l'arrivo e torna indietro: `c` decide quanto. */
const rimbalzo = (c: number): Curva => (u) => {
  const v = u - 1
  return v * v * ((c + 1) * v + c) + 1
}

export const CURVE = {
  /** Vista e blocchi al cambio di pagina. */
  entrata: "cubic-bezier(0.16, 1, 0.3, 1)",
  /** Blocchi alla prima apertura dell'app. */
  apertura: "cubic-bezier(0.22, 1, 0.36, 1)",
  fuori1: tabella(fuori(2)),
  fuori3: tabella(fuori(4)),
  fuori4: tabella(fuori(5)),
  dentro1: tabella(dentro(2)),
  dentro2: tabella(dentro(3)),
  modale: tabella(rimbalzo(1.5)),
  ricerca: tabella(rimbalzo(1.6)),
  avviso: tabella(rimbalzo(1.8)),
  tendina: tabella(rimbalzo(2)),
} as const

/** Funzioni usate dalle animazioni guidate da JavaScript (cifre e pillole). */
export const FUNZIONI = {
  fuori3: fuori(4),
  dentroFuori3: (u: number) => (u < 0.5 ? 8 * u ** 4 : 1 - 8 * (1 - u) ** 4),
}

export const TEMPI = {
  uscitaVista: 180,
  uscitaTesta: 140,
  entrataVista: 700,
  entrataBlocco: 800,
  entrataRiga: 550,
  passoBlocco: 60,
  passoRiga: 20,
  lettera: 850,
  passoLettera: 22,
  cifra: 900,
  aperturaBlocco: 740,
  passoAperturaBlocco: 50,
} as const
