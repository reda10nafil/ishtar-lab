import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { enrichProductChangeRequests } from "@mercurjs/core/api/vendor/products/helpers"
import { productEditUpdateProductWorkflow, productEditUpdateVariantsWorkflow } from "@mercurjs/core/workflows"
import { aggiornaOfferta, creaOfferte, leggiOfferte } from "../../../../admin/catalogo/comune/offerte"
import { leggiScheda, schedaPerAzienda, type Scheda } from "../../../../admin/catalogo/comune/prodotti"
import { CampiScheda, ean, versoMedusa } from "../../../../admin/catalogo/comune/scheda"
import { assente } from "../../../../admin/catalogo/comune/permessi"
import { aziendaDi, interroga, rifiutato, valida } from "../../../../utili"
import { prodottiAzienda } from "../../comune"

const Corpo = CampiScheda.partial().extend({
  varianti: z.array(z.object({ id: z.string(), ean: ean.nullish() })).optional(),
})

type Dati = z.infer<typeof Corpo>

const uguali = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

async function schedaPropria(req: AuthenticatedMedusaRequest) {
  const id = req.params.id
  const azienda = aziendaDi(req)
  if (!(await prodottiAzienda(req.scope, azienda)).includes(id)) throw assente("Product")
  const scheda = await leggiScheda(req.scope, id)
  if (!scheda) throw assente("Product")
  return { id, azienda, scheda }
}

/** Il flusso nativo crea una richiesta anche senza differenze: qui passa solo ciò che è cambiato. */
function cambiamenti(scheda: Scheda, dati: Dati, metadatiAttuali: Record<string, unknown>) {
  const { metadata, ...campi } = versoMedusa(dati)
  const attuale: Record<string, unknown> = {
    title: scheda.titolo,
    description: scheda.descrizione,
    categories: scheda.categorie.map((c) => ({ id: c.id })),
    images: scheda.foto.map((f) => ({ url: f.url })),
    thumbnail: scheda.copertina,
    weight: scheda.peso,
    material: scheda.composizione,
  }
  const diversi = Object.entries(campi).filter(([chiave, valore]) => valore !== undefined && !uguali(valore, attuale[chiave]))
  const nuoviMetadati = Object.entries(metadata).filter(([chiave, valore]) => !uguali(valore, metadatiAttuali[chiave]))
  return {
    ...Object.fromEntries(diversi),
    ...(nuoviMetadati.length ? { metadata: { ...metadatiAttuali, ...Object.fromEntries(nuoviMetadati) } } : {}),
  }
}

async function metadatiProdotto(req: AuthenticatedMedusaRequest, id: string) {
  const { data } = await interroga(req).graph({ entity: "product", fields: ["metadata"], filters: { id } })
  return ((data[0] as { metadata?: Record<string, unknown> | null } | undefined)?.metadata ?? {}) as Record<string, unknown>
}

/** I prodotti caricati prima di questa scheda non hanno offerte: si recuperano alla prima modifica. */
async function offertePer(req: AuthenticatedMedusaRequest, scheda: Scheda, azienda: string) {
  const proprie = await leggiOfferte(req.scope, { product_id: scheda.id, seller_id: azienda })
  const mancanti = scheda.varianti.filter((v) => !proprie.some((o) => o.variante_id === v.id))
  if (!mancanti.length) return proprie
  await creaOfferte(
    req.scope,
    azienda,
    req.auth_context.actor_id,
    mancanti.map((v) => ({ variante_id: v.id, sku: v.sku ?? v.id, ean: v.ean }))
  )
  return leggiOfferte(req.scope, { product_id: scheda.id, seller_id: azienda })
}

/** Restituisce `true` se i prezzi sono rimasti in attesa di approvazione. */
async function scriviPrezzi(req: AuthenticatedMedusaRequest, scheda: Scheda, azienda: string, dati: Dati) {
  if (dati.prezzo_cessione === undefined && dati.prezzo_consigliato === undefined) return false
  const offerte = await offertePer(req, scheda, azienda)
  const [prima] = offerte
  const prezzi = {
    prezzo_cessione: dati.prezzo_cessione === undefined ? prima?.prezzo_cessione ?? null : dati.prezzo_cessione,
    prezzo_consigliato: dati.prezzo_consigliato === undefined ? prima?.prezzo_consigliato ?? null : dati.prezzo_consigliato,
  }
  if (uguali(prezzi.prezzo_cessione, prima?.prezzo_cessione) && uguali(prezzi.prezzo_consigliato, prima?.prezzo_consigliato)) return false

  const inRevisione = scheda.stato === "published"
  for (const offerta of offerte) {
    const metadata = inRevisione ? { ...offerta.metadata, proposta_prezzi: { ...prezzi, proposta_il: new Date().toISOString() } } : { ...offerta.metadata, ...prezzi, proposta_prezzi: null }
    await aggiornaOfferta(req.scope, offerta, { metadata }, req.auth_context.actor_id)
  }
  return inRevisione
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { id, azienda, scheda } = await schedaPropria(req)
  const riga: { id: string; change_request?: { message: string | null } | null }[] = [{ id }]
  await enrichProductChangeRequests(req.scope, riga as never)
  res.json({ prodotto: schedaPerAzienda(scheda, azienda, riga[0].change_request?.message ?? null) })
}

/**
 * Finché il prodotto non è online i campi si applicano subito. Dopo, testi e prezzi
 * tornano in revisione: i testi con il flusso di Mercur, i prezzi con una proposta sull'offerta.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { id, azienda, scheda } = await schedaPropria(req)
  const dati = valida(Corpo, req.body)
  const online = scheda.stato === "published"

  const update = cambiamenti(scheda, dati, await metadatiProdotto(req, id))
  const testi = Object.keys(update).length > 0
  const eanCambiati = (dati.varianti ?? []).filter((v) => {
    const attuale = scheda.varianti.find((x) => x.id === v.id)
    return attuale && v.ean !== undefined && (v.ean || null) !== attuale.ean
  })
  if (online && eanCambiati.length) throw rifiutato("While a product is live, ask Ishtar Lab to change its EAN")
  if (online && testi && scheda.modifiche_in_attesa) throw rifiutato("This product already has a change waiting for approval")

  if (testi) await productEditUpdateProductWorkflow(req.scope).run({ input: { product_id: id, created_by: azienda, update } as never })
  if (eanCambiati.length) {
    await productEditUpdateVariantsWorkflow(req.scope).run({
      input: {
        product_id: id,
        created_by: azienda,
        operations: eanCambiati.map((v) => ({ type: "update", variant_id: v.id, fields: { ean: v.ean || null } })),
      } as never,
    })
  }
  const prezziInRevisione = await scriviPrezzi(req, scheda, azienda, dati)
  res.json({ in_revisione: online && (testi || prezziInRevisione) })
}
