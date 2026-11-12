import type { MedusaContainer } from "@medusajs/framework/types"
import { OUTFIT_MODULE } from "../../../../modules/outfit"
import { CANALI, contabili, margine, nelPeriodo, perProdotto, somma, totali, variazione } from "./calcoli"
import { costiDi, inizioStorico, negozio } from "./contesto"
import { dentro, finestra } from "./periodi"
import { leggiOrdini, type Ordine } from "./ordini"

const QUANTI_PRODOTTI = 6

function perAzienda(ordini: Ordine[], costi: Map<string, number> | null) {
  const gruppi = new Map<string, Ordine[]>()
  for (const o of ordini) gruppi.set(o.azienda_id ?? "", [...(gruppi.get(o.azienda_id ?? "") ?? []), o])
  return [...gruppi.values()]
    .map((gruppo) => {
      const t = totali(gruppo)
      return {
        id: gruppo[0].azienda_id,
        nome: gruppo[0].azienda,
        vendite: t.vendite,
        ordini: t.ordini,
        unita: t.unita,
        ...(costi ? { margine: margine(gruppo, costi) } : {}),
      }
    })
    .sort((a, b) => b.vendite - a.vendite)
}

/** Le righe dicono da quale outfit vengono solo se il negozio lo ha scritto in `metadata.outfit_id`. */
async function perOutfit(scope: MedusaContainer, ordini: Ordine[]) {
  const gruppi = new Map<string, { unita: number; importo: number }>()
  for (const riga of ordini.flatMap((o) => o.righe)) {
    if (!riga.outfit_id) continue
    const voce = gruppi.get(riga.outfit_id) ?? { unita: 0, importo: 0 }
    gruppi.set(riga.outfit_id, { unita: voce.unita + riga.quantita, importo: voce.importo + riga.importo })
  }
  if (!gruppi.size) return []
  const servizio = scope.resolve(OUTFIT_MODULE) as { listOutfits: (f: { id: string[] }) => Promise<{ id: string; nome: string }[]> }
  const nomi = new Map((await servizio.listOutfits({ id: [...gruppi.keys()] })).map((o) => [o.id, o.nome]))
  return [...gruppi].map(([id, v]) => ({ id, nome: nomi.get(id) ?? null, ...v })).sort((a, b) => b.importo - a.importo)
}

export async function analisiVendite(scope: MedusaContainer, vedeMargini: boolean) {
  const adesso = new Date()
  const { fuso, valuta } = await negozio(scope)
  const ordini = await leggiOrdini(scope, { da: inizioStorico(adesso, fuso) })
  const validi = contabili(ordini, valuta)
  const anno = finestra("12m", adesso, fuso)
  const mese = finestra("30g", adesso, fuso)
  const dellAnno = nelPeriodo(validi, anno)
  const costi = vedeMargini ? await costiDi(scope, dellAnno) : null

  const mesi = anno.secchi.map((s, indice) => {
    const gruppo = dellAnno.filter((o) => dentro(o.creato_il, s))
    const t = totali(gruppo)
    return {
      chiave: s.chiave,
      etichetta: s.etichetta,
      dettaglio: s.dettaglio,
      in_corso: indice === anno.secchi.length - 1,
      totale: t.vendite,
      ordini: t.ordini,
      unita: t.unita,
      canali: CANALI.map((c) => totali(gruppo.filter((o) => o.canale === c.id)).vendite),
      ...(costi ? { margine: margine(gruppo, costi).valore } : {}),
    }
  })

  const totale = somma(mesi.map((m) => m.totale))
  const corrente = mesi[mesi.length - 1]
  const scorso = mesi[mesi.length - 2]
  const migliore = mesi.reduce((a, b) => (b.totale > a.totale ? b : a), mesi[0])
  const conVendite = mesi.filter((m) => m.totale > 0)

  return {
    valuta,
    anno: { da: anno.secchi[0].dettaglio, a: corrente.dettaglio },
    riepilogo: {
      totale,
      corrente: { etichetta: corrente.dettaglio, totale: corrente.totale, variazione: variazione(corrente.totale, scorso.totale), rispetto_a: scorso.dettaglio },
      migliore: migliore.totale > 0 ? { etichetta: migliore.etichetta, dettaglio: migliore.dettaglio, totale: migliore.totale } : null,
      media: conVendite.length ? totale / conVendite.length : null,
      mesi_con_vendite: conVendite.length,
    },
    canali: CANALI.map((c, i) => {
      const valore = somma(mesi.map((m) => m.canali[i]))
      return { ...c, totale: valore, quota: totale ? valore / totale : 0 }
    }),
    mesi,
    aziende: perAzienda(dellAnno, costi),
    outfit: await perOutfit(scope, dellAnno),
    prodotti: perProdotto(nelPeriodo(validi, mese)).sort((a, b) => b.importo - a.importo).slice(0, QUANTI_PRODOTTI),
    vede_margini: vedeMargini,
    margine: costi ? margine(dellAnno, costi) : null,
    altre_valute: ordini.filter((o) => o.valido).length - validi.length,
  }
}
