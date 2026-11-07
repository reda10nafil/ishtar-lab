import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { z } from "@medusajs/framework/zod"
import type { Scheda } from "../../../../modules/outfit/calcolo"
import { interroga, invalido, rifiutato, valida } from "../../../utili"
import { caricaOutfit, chiaveCoppia, coppieDi, leggiSchede, puoVedereMargini, schedeDi, servizioOutfit, vistaOutfit, type Coppia } from "../lettura"
import { ModificaOutfit } from "../schemi"

type CapoInviato = NonNullable<z.infer<typeof ModificaOutfit>["capi"]>[number]

const alternativaInviata = (capo: CapoInviato): Coppia | null =>
  capo.alternativa_product_id && capo.alternativa_azienda_id
    ? { product_id: capo.alternativa_product_id, azienda_id: capo.alternativa_azienda_id }
    : null

function controllaForma(capi: CapoInviato[]) {
  const viste = new Set<string>()
  for (const capo of capi) {
    const chiave = chiaveCoppia(capo)
    if (viste.has(chiave)) throw invalido("This piece is already in the outfit")
    viste.add(chiave)
    if (Boolean(capo.alternativa_product_id) !== Boolean(capo.alternativa_azienda_id)) throw invalido("An alternative needs both a product and a company")
    const alternativa = alternativaInviata(capo)
    if (alternativa && chiaveCoppia(alternativa) === chiave) throw invalido("The alternative must be a different piece")
  }
}

/**
 * Un capo nuovo deve esistere davvero: prodotto in vendita e offerta di quell'azienda.
 * I capi già nell'outfit non si ricontrollano, altrimenti un prodotto ritirato bloccherebbe ogni salvataggio.
 */
function controllaCatalogo(nuove: Coppia[], schede: Map<string, Scheda>) {
  for (const coppia of nuove) {
    const scheda = schede.get(chiaveCoppia(coppia))
    if (!scheda?.in_vendita) throw invalido("The chosen piece is not a product on sale in the catalogue")
    if (!scheda.con_offerta) throw invalido("This company has no offer for the chosen piece")
  }
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const outfit = await caricaOutfit(req, req.params.id)
  const schede = await schedeDi(interroga(req), [outfit])
  res.json({ outfit: vistaOutfit(outfit, schede, puoVedereMargini(req)) })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { capi, ...campi } = valida(ModificaOutfit, req.body)
  const attuale = await caricaOutfit(req, req.params.id)
  if (attuale.stato !== "bozza") throw rifiutato("Move the outfit back to draft to edit it")

  const query = interroga(req)
  if (capi) {
    controllaForma(capi)
    const note = new Set(attuale.capi.flatMap(coppieDi).map(chiaveCoppia))
    const inviate = capi.flatMap((capo) => {
      const alternativa = alternativaInviata(capo)
      return alternativa ? [capo, alternativa] : [capo]
    })
    const nuove = inviate.filter((coppia) => !note.has(chiaveCoppia(coppia)))
    if (nuove.length) controllaCatalogo(nuove, await leggiSchede(query, nuove))
  }

  await servizioOutfit(req).salvaComposizione(req.params.id, campi, capi)
  const outfit = await caricaOutfit(req, req.params.id)
  const schede = await schedeDi(query, [outfit])
  res.json({ outfit: vistaOutfit(outfit, schede, puoVedereMargini(req)) })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const outfit = await caricaOutfit(req, req.params.id)
  if (outfit.stato === "pubblicato") throw rifiutato("Archive the outfit first: a published outfit cannot be deleted")
  await servizioOutfit(req).deleteOutfits(outfit.id)
  res.json({ id: outfit.id, eliminato: true })
}
