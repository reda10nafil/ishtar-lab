import type { MedusaContainer } from "@medusajs/framework/types"
import { z } from "@medusajs/framework/zod"
import { CANALI, contabili, margine, nelPeriodo, perProdotto, perSecchio, somma, totali } from "./calcoli"
import { costiDi, negozio } from "./contesto"
import { giornoVisite, leggiDemo } from "./demo"
import { finestra, PERIODI_REPORT } from "./periodi"
import { leggiOrdini, type Ordine } from "./ordini"
import { invalido } from "../../../utili"

export const METRICHE = ["vendite", "ordini", "ordine_medio", "unita", "margine", "visite"] as const
export const GRUPPI = ["tempo", "canale", "azienda", "prodotto"] as const

export const ParametriReport = z.object({
  metrica: z.enum(METRICHE, { message: "Choose a measure" }).default("vendite"),
  periodo: z.enum(PERIODI_REPORT, { message: "Choose a window" }).default("30g"),
  raggruppa: z.enum(GRUPPI, { message: "Choose how to group the report" }).default("tempo"),
  canale: z.enum(["online", "cassa", "ingrosso"], { message: "Choose a channel" }).optional(),
})

type Parametri = z.infer<typeof ParametriReport>
type Costi = Map<string, number> | null

function misura(metrica: Parametri["metrica"], gruppo: Ordine[], costi: Costi): number {
  const t = totali(gruppo)
  if (metrica === "ordini") return t.ordini
  if (metrica === "unita") return t.unita
  if (metrica === "ordine_medio") return t.ordine_medio ?? 0
  if (metrica === "margine") return margine(gruppo, costi ?? new Map()).valore
  return t.vendite
}

type RigaReport = { chiave: string; etichetta: string; dettaglio: string; valore: number }

function perGruppo(ordini: Ordine[], chiave: (o: Ordine) => string, etichetta: (o: Ordine) => string, metrica: Parametri["metrica"], costi: Costi): RigaReport[] {
  const gruppi = new Map<string, Ordine[]>()
  for (const o of ordini) gruppi.set(chiave(o), [...(gruppi.get(chiave(o)) ?? []), o])
  return [...gruppi]
    .map(([id, gruppo]) => ({ chiave: id, etichetta: etichetta(gruppo[0]), dettaglio: etichetta(gruppo[0]), valore: misura(metrica, gruppo, costi) }))
    .sort((a, b) => b.valore - a.valore)
}

/** Un ordine con più prodotti si divide: ogni prodotto conta per le sue righe. */
function perArticolo(ordini: Ordine[], metrica: Parametri["metrica"], costi: Costi): RigaReport[] {
  const parti = ordini.flatMap((o) => o.righe.map((r) => ({ ...o, righe: [r], totale: r.importo })))
  return perGruppo(parti, (o) => o.righe[0].prodotto_id ?? o.righe[0].titolo, (o) => o.righe[0].titolo, metrica, costi)
}

const GIORNI_REPORT = { "7g": 7, "14g": 14, "30g": 30, "90g": 90, "12m": 365 }

/** Le visite non vengono dagli ordini: si leggono dai dati dimostrativi, giorno per giorno. */
async function reportVisite(scope: MedusaContainer, p: Parametri) {
  if (p.raggruppa !== "tempo") throw invalido("Visits can only be shown over time")
  const demo = await leggiDemo(scope)
  if (!demo?.traffico?.giorni?.length) throw invalido("Visits aren't measured yet")
  const giorni = demo.traffico.giorni.slice(-GIORNI_REPORT[p.periodo]).map(giornoVisite)
  const righe = giorni.map((g) => ({ chiave: g.chiave, etichetta: g.etichetta, dettaglio: g.dettaglio, valore: g.visite }))
  const totale = somma(righe.map((r) => r.valore))
  const migliore = righe.reduce((a, b) => (b.valore > a.valore ? b : a), righe[0])
  return {
    parametri: p,
    canali: CANALI,
    righe,
    totale,
    media: totale / righe.length,
    migliore: { etichetta: migliore.etichetta, valore: migliore.valore },
    piu_venduto: null,
    senza_costo: null,
    ordini: righe.length,
  }
}

export async function creaReport(scope: MedusaContainer, p: Parametri, vedeMargini: boolean) {
  if (p.metrica === "visite") return reportVisite(scope, p)
  const adesso = new Date()
  const { fuso, valuta } = await negozio(scope)
  const f = finestra(p.periodo, adesso, fuso)
  const validi = contabili(await leggiOrdini(scope, { da: f.inizio }), valuta)
  const scelti = nelPeriodo(validi, f).filter((o) => !p.canale || o.canale === p.canale)
  const costi = p.metrica === "margine" && vedeMargini ? await costiDi(scope, scelti) : null
  const lungoIlTempo = perSecchio(scelti, f.secchi, (g) => misura(p.metrica, g, costi))

  const righe: RigaReport[] =
    p.raggruppa === "tempo"
      ? f.secchi.map((s, i) => ({ chiave: s.chiave, etichetta: s.etichetta, dettaglio: s.dettaglio, valore: lungoIlTempo[i] }))
      : p.raggruppa === "canale"
        ? perGruppo(scelti, (o) => o.canale, (o) => CANALI.find((c) => c.id === o.canale)?.nome ?? o.canale, p.metrica, costi)
        : p.raggruppa === "azienda"
          ? perGruppo(scelti, (o) => o.azienda_id ?? "", (o) => o.azienda ?? "Direct sales", p.metrica, costi)
          : perArticolo(scelti, p.metrica, costi)

  const migliore = righe.reduce<RigaReport | null>((a, b) => (b.valore > (a?.valore ?? 0) ? b : a), null)
  const piuVenduto = perProdotto(scelti)[0] ?? null
  return {
    parametri: p,
    canali: CANALI,
    righe,
    totale: misura(p.metrica, scelti, costi),
    media: f.secchi.length ? somma(lungoIlTempo) / f.secchi.length : null,
    migliore: migliore ? { etichetta: migliore.etichetta, valore: migliore.valore } : null,
    piu_venduto: piuVenduto ? { nome: piuVenduto.nome, unita: piuVenduto.unita } : null,
    senza_costo: costi ? margine(scelti, costi).senza_costo : null,
    ordini: totali(scelti).ordini,
  }
}
