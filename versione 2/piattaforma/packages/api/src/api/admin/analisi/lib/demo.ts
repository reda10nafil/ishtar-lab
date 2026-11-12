import type { MedusaContainer } from "@medusajs/framework/types"
import { leggiStore } from "../../impostazioni/lettura"

export type CampagnaDemo = {
  nome: string
  canale?: "email" | "instagram" | "sms"
  oggetto?: string
  stato?: "bozza" | "programmata" | "in_invio" | "inviata"
  quando?: string
  destinatari?: number
  inviati?: number
  aperture?: number
  clic?: number
  incasso?: number
  ordini?: number
}

type GiornoDemo = { data: string; visite: number; precedenti?: number }

/** Visitatori, conversione, aperture e clic non hanno una fonte vera: arrivano da qui. Forma in `.scratch/ishtar-lab/DEMO-METADATA.md`. */
export type Demo = {
  adesso?: { visitatori: number; carrello: number; cassa: number; andamento?: number[] }
  conversione?: { valore: number; precedente?: number | null; serie?: number[] }
  spunto?: { titolo: string; testo: string }
  traffico?: {
    giorni: GiornoDemo[]
    carrello?: { valore: number; precedente?: number | null }
    ore?: number[][]
    fonti?: { nome: string; visite: number }[]
    pagine?: { titolo: string; percorso: string; visite: number }[]
  }
  campagne?: CampagnaDemo[]
  automazioni?: Record<string, { inviate?: number; incasso?: number }>
}

/** Senza dati dimostrativi ogni blocco torna al suo stato vuoto. */
export async function leggiDemo(scope: MedusaContainer): Promise<Demo | null> {
  const { metadata } = await leggiStore(scope)
  const demo = metadata?.demo
  return demo && typeof demo === "object" ? (demo as Demo) : null
}

const GIORNI = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const ORE = ["8am", "10am", "12pm", "2pm", "4pm", "6pm", "8pm", "10pm"]

const breve = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
const lungo = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })

const somma = (valori: number[]) => valori.reduce((a, b) => a + b, 0)
const variazione = (attuale: number, precedente?: number | null) => (precedente ? (attuale - precedente) / precedente : null)

export const giornoVisite = (g: GiornoDemo) => {
  const data = new Date(`${g.data}T12:00:00Z`)
  return { chiave: g.data, etichetta: breve.format(data), dettaglio: lungo.format(data).replace(",", ""), visite: g.visite, precedenti: g.precedenti ?? 0 }
}

function finestraVisite(giorni: ReturnType<typeof giornoVisite>[], quanti: number) {
  const parte = giorni.slice(-quanti)
  const visite = somma(parte.map((g) => g.visite))
  return { giorni: parte, visite, variazione: variazione(visite, somma(parte.map((g) => g.precedenti))) }
}

function oraMigliore(ore: number[][]) {
  let massimo = -1
  let migliore = null as { giorno: string; ora: string } | null
  ore.forEach((riga, g) =>
    riga.forEach((valore, o) => {
      if (valore <= massimo) return
      massimo = valore
      migliore = { giorno: GIORNI[g], ora: ORE[o] }
    })
  )
  return migliore
}

/** La pagina Traffic pronta da disegnare, per le finestre di 14 e 30 giorni. */
export function trafficoDi(demo: Demo | null) {
  const t = demo?.traffico
  if (!t?.giorni?.length) return null
  const giorni = t.giorni.map(giornoVisite)
  const fonti = t.fonti ?? []
  const totaleFonti = somma(fonti.map((f) => f.visite))
  return {
    finestre: { "14": finestraVisite(giorni, 14), "30": finestraVisite(giorni, 30) },
    conversione: demo?.conversione?.valore ?? null,
    carrello: t.carrello ? { valore: t.carrello.valore, variazione: variazione(t.carrello.valore, t.carrello.precedente) } : null,
    ora: t.ore ? oraMigliore(t.ore) : null,
    ore: t.ore ?? null,
    fonti: fonti.map((f) => ({ ...f, quota: totaleFonti ? f.visite / totaleFonti : 0 })),
    pagine: t.pagine ?? [],
  }
}

export const conversioneDi = (demo: Demo | null) => {
  const c = demo?.conversione
  return c ? { valore: c.valore, precedente: c.precedente ?? null, variazione: variazione(c.valore, c.precedente), serie: c.serie ?? [] } : null
}
