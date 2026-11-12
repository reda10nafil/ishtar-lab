import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { NEGOZIO_ONLINE_MODULE } from "../../../modules/negozio-online"
import type NegozioOnlineModuleService from "../../../modules/negozio-online/service"
import { invalido } from "../../utili"

export const servizioNegozio = (req: AuthenticatedMedusaRequest) => req.scope.resolve<NegozioOnlineModuleService>(NEGOZIO_ONLINE_MODULE)

export const MASSIMO_ANNUNCIO = 80

export const DatiVetrina = z.object({
  testata: z.string({ error: "Enter the shop name for the header" }).trim().min(1, "Enter the shop name for the header").max(60, "The shop name is too long").optional(),
  annuncio: z.string({ error: "The announcement must be text" }).trim().max(MASSIMO_ANNUNCIO, `The announcement can be up to ${MASSIMO_ANNUNCIO} characters`).optional(),
  accento: z.enum(["rosa", "mare", "sabbia"], { error: "Choose an accent colour" }).optional(),
  messaggio: z.string({ error: "The message must be text" }).trim().max(120, "The message is too long").optional(),
})

const Percorso = z
  .string({ error: "Enter the page address" })
  .trim()
  .toLowerCase()
  .regex(/^\/[a-z0-9]*(-[a-z0-9]+)*$/, "Addresses start with / and use letters, numbers and hyphens")
  .max(80, "The address is too long")

export const DatiPagina = z.object({
  titolo: z.string({ error: "Enter a title" }).trim().min(1, "Enter a title").max(80, "The title is too long"),
  percorso: Percorso,
  testo: z.string({ error: "The page text must be text" }).max(20000, "The text is too long").default(""),
  visibile: z.boolean({ error: "Say whether the page is showing" }).default(true),
})

export const ModificaPagina = z.object({
  titolo: DatiPagina.shape.titolo.optional(),
  percorso: Percorso.optional(),
  testo: z.string({ error: "The page text must be text" }).max(20000, "The text is too long").optional(),
  visibile: z.boolean({ error: "Say whether the page is showing" }).optional(),
})

export async function controllaPercorso(req: AuthenticatedMedusaRequest, percorso: string | undefined, tranne?: string) {
  if (!percorso) return
  const trovate = await servizioNegozio(req).listPaginas({ percorso })
  if (trovate.some((p) => p.id !== tranne)) throw invalido("Another page already uses this address")
}
