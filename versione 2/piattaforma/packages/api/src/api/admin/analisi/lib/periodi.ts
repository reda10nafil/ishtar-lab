/** Finestre di tempo nel fuso del negozio. Funzioni pure: si provano senza database. */
const GIORNO = 86_400_000
const SETTIMANA = 7 * GIORNO

export const PERIODI_PANORAMICA = ["oggi", "7g", "30g", "12m"] as const
export const PERIODI_REPORT = ["7g", "14g", "30g", "90g", "12m"] as const
export type Periodo = (typeof PERIODI_PANORAMICA)[number] | (typeof PERIODI_REPORT)[number]

export type Secchio = { chiave: string; etichetta: string; dettaglio: string; inizio: Date; fine: Date; futuro: boolean }
export type Intervallo = { inizio: Date; fine: Date }
export type Finestra = Intervallo & { periodo: Periodo; secchi: Secchio[]; precedente: Intervallo }

type Parti = { anno: number; mese: number; giorno: number; ora: number; minuto: number }

export function partiNelFuso(data: Date, fuso: string): Parti {
  const parti = new Intl.DateTimeFormat("en-GB", {
    timeZone: fuso,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(data)
  const leggi = (tipo: string) => Number(parti.find((p) => p.type === tipo)?.value ?? 0)
  return { anno: leggi("year"), mese: leggi("month"), giorno: leggi("day"), ora: leggi("hour"), minuto: leggi("minute") }
}

const scarto = (data: Date, fuso: string) => {
  const p = partiNelFuso(data, fuso)
  return Date.UTC(p.anno, p.mese - 1, p.giorno, p.ora, p.minuto) - Math.floor(data.getTime() / 60_000) * 60_000
}

/** Istante in cui inizia quell'ora locale: il secondo passaggio corregge il cambio dell'ora legale. */
export function istante(anno: number, mese: number, giorno: number, ora: number, fuso: string): Date {
  const stima = Date.UTC(anno, mese - 1, giorno, ora)
  const prima = stima - scarto(new Date(stima), fuso)
  return new Date(stima - scarto(new Date(prima), fuso))
}

const formato = (fuso: string, opzioni: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: fuso, ...opzioni })

function secchiOrari(adesso: Date, fuso: string): Secchio[] {
  const { anno, mese, giorno } = partiNelFuso(adesso, fuso)
  return Array.from({ length: 24 }, (_, ora) => {
    const inizio = istante(anno, mese, giorno, ora, fuso)
    const dodici = ora % 12 === 0 ? 12 : ora % 12
    return {
      chiave: `${anno}-${mese}-${giorno}T${ora}`,
      etichetta: `${dodici}${ora < 12 ? "am" : "pm"}`,
      dettaglio: `${String(ora).padStart(2, "0")}:00`,
      inizio,
      fine: istante(anno, mese, giorno, ora + 1, fuso),
      futuro: inizio > adesso,
    }
  })
}

function secchiGiornalieri(quanti: number, adesso: Date, fuso: string, etichetta: Intl.DateTimeFormatOptions): Secchio[] {
  const { anno, mese, giorno } = partiNelFuso(adesso, fuso)
  const breve = formato(fuso, etichetta)
  const lungo = formato(fuso, { weekday: "long", day: "numeric", month: "long" })
  return Array.from({ length: quanti }, (_, i) => {
    const scostamento = i - quanti + 1
    const inizio = istante(anno, mese, giorno + scostamento, 0, fuso)
    return {
      chiave: inizio.toISOString(),
      etichetta: breve.format(inizio).replace(",", ""),
      dettaglio: lungo.format(inizio).replace(",", ""),
      inizio,
      fine: istante(anno, mese, giorno + scostamento + 1, 0, fuso),
      futuro: false,
    }
  })
}

function secchiMensili(adesso: Date, fuso: string): Secchio[] {
  const { anno, mese } = partiNelFuso(adesso, fuso)
  const breve = formato(fuso, { month: "short" })
  const lungo = formato(fuso, { month: "long", year: "numeric" })
  return Array.from({ length: 12 }, (_, i) => {
    const scostamento = i - 11
    const inizio = istante(anno, mese + scostamento, 1, 0, fuso)
    return {
      chiave: inizio.toISOString(),
      etichetta: breve.format(inizio),
      dettaglio: lungo.format(inizio),
      inizio,
      fine: istante(anno, mese + scostamento + 1, 1, 0, fuso),
      futuro: false,
    }
  })
}

const GIORNI: Partial<Record<Periodo, number>> = { "7g": 7, "14g": 14, "30g": 30, "90g": 90 }

/**
 * La finestra arriva fino ad adesso e si confronta con il periodo subito prima, lungo uguale.
 * «Oggi» si confronta con lo stesso giorno della settimana scorsa alla stessa ora.
 */
export function finestra(periodo: Periodo, adesso: Date, fuso: string): Finestra {
  if (periodo === "oggi") {
    const secchi = secchiOrari(adesso, fuso)
    const inizio = secchi[0].inizio
    return {
      periodo,
      secchi,
      inizio,
      fine: adesso,
      precedente: { inizio: new Date(inizio.getTime() - SETTIMANA), fine: new Date(adesso.getTime() - SETTIMANA) },
    }
  }
  if (periodo === "12m") {
    const secchi = secchiMensili(adesso, fuso)
    const { anno, mese } = partiNelFuso(adesso, fuso)
    const inizio = secchi[0].inizio
    return { periodo, secchi, inizio, fine: adesso, precedente: { inizio: istante(anno - 1, mese - 11, 1, 0, fuso), fine: inizio } }
  }
  const quanti = GIORNI[periodo] ?? 7
  const etichetta: Intl.DateTimeFormatOptions = quanti === 7 ? { weekday: "short", day: "numeric" } : { day: "numeric", month: "short" }
  const secchi = secchiGiornalieri(quanti, adesso, fuso, etichetta)
  const inizio = secchi[0].inizio
  const { anno, mese, giorno } = partiNelFuso(adesso, fuso)
  return {
    periodo,
    secchi,
    inizio,
    fine: adesso,
    precedente: { inizio: istante(anno, mese, giorno - 2 * quanti + 1, 0, fuso), fine: inizio },
  }
}

export const dentro = (data: Date, { inizio, fine }: Intervallo) => data >= inizio && data < fine
