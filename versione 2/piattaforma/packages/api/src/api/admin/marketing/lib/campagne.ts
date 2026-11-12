import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import type MarketingModuleService from "../../../../modules/marketing/service"
import { invalido, nonTrovato, rifiutato } from "../../../utili"
import { pubblicoValido } from "./pubblico"

export const servizioMarketing = (req: AuthenticatedMedusaRequest) => req.scope.resolve<MarketingModuleService>(MARKETING_MODULE)

const testo = (obbligo: string, massimo: number) => z.string({ error: obbligo }).trim().min(1, obbligo).max(massimo, "That text is too long")

export const DatiCampagna = z.object({
  nome: testo("Give the campaign a name", 120),
  oggetto: testo("Write a subject line", 180),
  testo: testo("Write the message", 20_000),
  pubblico: z.string().refine(pubblicoValido, "Choose an audience").default("tutti"),
})

export const Programmazione = z.object({
  quando: z.string({ error: "Choose a date and time" }).refine((v) => !Number.isNaN(Date.parse(v)), "Choose a date and time"),
})

export async function campagnaDi(req: AuthenticatedMedusaRequest) {
  const [campagna] = await servizioMarketing(req).listCampagnas({ id: req.params.id })
  if (!campagna) throw nonTrovato("Campaign")
  return campagna
}

export function soloDaInviare(stato: string) {
  if (stato !== "bozza" && stato !== "programmata") throw rifiutato("This campaign has already gone out")
}

export function nelFuturo(quando: string) {
  const data = new Date(quando)
  if (data.getTime() <= Date.now()) throw invalido("Choose a time in the future")
  return data
}
