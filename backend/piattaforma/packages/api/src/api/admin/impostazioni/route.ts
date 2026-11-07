import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { interroga } from "../../utili"
import { impostazioniDi, leggiStore, valutaBase, VALUTE } from "./lettura"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const store = await leggiStore(req.scope)
  const { data: preferenza } = await interroga(req).graph({
    entity: "price_preference",
    fields: ["is_tax_inclusive"],
    filters: { attribute: "currency_code", value: valutaBase(store) },
  })
  res.json({
    negozio: {
      nome: store.name,
      ...impostazioniDi(store).negozio,
      prezzi_con_iva: Boolean(preferenza[0]?.is_tax_inclusive),
    },
    valute: VALUTE,
  })
}
