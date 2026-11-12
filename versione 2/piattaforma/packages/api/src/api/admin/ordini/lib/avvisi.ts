import type { MedusaContainer } from "@medusajs/framework/types"
import { leggiCoda } from "./coda"
import { leggiUnici } from "./unico"

const MASSIMO = 100
const NUOVI_GIORNI = 7

type Gravita = "info" | "attesa" | "errore"
type Avviso = { chiave: string; titolo: string; dettaglio: string | null; a: string; quando: string | null; gravita: Gravita }

const dataBreve = (valore: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(valore))

/** Ordini degli ultimi giorni che nessuno ha ancora iniziato a preparare. */
export async function avvisiNuoviOrdini(scope: MedusaContainer): Promise<Avviso[]> {
  const limite = Date.now() - NUOVI_GIORNI * 86_400_000
  return (await leggiUnici(scope))
    .filter((u) => !u.annullato && u.evasione === "not_fulfilled" && new Date(u.creato_il).getTime() >= limite)
    .slice(0, MASSIMO)
    .map((u) => ({
      chiave: `ordine:${u.id}`,
      titolo: `New order #${u.numero}`,
      dettaglio: [u.cliente.nome, u.aziende.join(", ")].filter(Boolean).join(" · ") || null,
      a: `/ordini/tutti/${u.id}`,
      quando: u.creato_il,
      gravita: "attesa",
    }))
}

export async function avvisiRitardi(scope: MedusaContainer, azienda?: string): Promise<Avviso[]> {
  return (await leggiCoda(scope, azienda))
    .filter((r) => r.in_ritardo)
    .slice(0, MASSIMO)
    .map((r) => ({
      chiave: `ritardo:${r.id}`,
      titolo: `Late fulfilment: order #${r.numero}`,
      dettaglio: [azienda ? null : r.azienda, r.scadenza ? `due ${dataBreve(r.scadenza)}` : null].filter(Boolean).join(", ") || null,
      a: "/evasioni",
      quando: r.scadenza,
      gravita: "errore",
    }))
}

export async function avvisiRichieste(scope: MedusaContainer, azienda: string): Promise<Avviso[]> {
  return (await leggiCoda(scope, azienda))
    .filter((r) => r.stato === "da_confermare")
    .slice(0, MASSIMO)
    .map((r) => ({
      chiave: `richiesta-evasione:${r.id}`,
      titolo: `New order #${r.numero}`,
      dettaglio: "Confirm it in Fulfilment.",
      a: "/evasioni",
      quando: r.creata_il,
      gravita: "attesa",
    }))
}
