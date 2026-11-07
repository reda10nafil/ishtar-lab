import type { CreatePromotionDTO, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  createCampaignsWorkflow,
  createPromotionsWorkflow,
  deleteCampaignsWorkflow,
  deletePromotionsWorkflow,
  updateCampaignsWorkflow,
  updatePromotionsWorkflow,
} from "@medusajs/medusa/core-flows"
import crypto from "node:crypto"
import { invalido, nonTrovato } from "../../utili"

export type TipoSconto = "percentuale" | "importo" | "spedizione"
export type StatoSconto = "attivo" | "programmato" | "in_pausa" | "terminato"

const VALUTA = "eur"
/** Le campagne create qui appartengono a un solo sconto: quando lo sconto se ne va, se ne va anche la campagna. */
const PREFISSO_CAMPAGNA = "ishtar-"
const MASSIMO = 1000

const CAMPI = [
  "id",
  "code",
  "status",
  "limit",
  "used",
  "metadata",
  "created_at",
  "campaign.id",
  "campaign.campaign_identifier",
  "campaign.starts_at",
  "campaign.ends_at",
  "application_method.type",
  "application_method.target_type",
  "application_method.value",
  "application_method.description",
  "application_method.target_rules.attribute",
  "application_method.target_rules.operator",
  "application_method.target_rules.values.value",
]

export type Promozione = {
  id: string
  code: string
  status: string
  limit: number | null
  used: number
  metadata: Record<string, unknown> | null
  created_at: string | Date
  campaign?: { id: string; campaign_identifier: string; starts_at: string | Date | null; ends_at: string | Date | null } | null
  application_method?: {
    type: string
    target_type: string
    value: unknown
    description: string | null
    target_rules?: { attribute: string; operator: string; values: { value: string }[] }[]
  } | null
}

const Data = z
  .string()
  .refine((valore) => !Number.isNaN(Date.parse(valore)), "That date isn't valid")
  .nullable()
  .optional()

export const DatiCodice = z.object({
  codice: z
    .string({ error: "Enter the discount code" })
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9_-]{2,39}$/, "Codes need 3 to 40 characters: letters, numbers and hyphens"),
  descrizione: z.string().trim().max(200, "That description is too long").nullable().optional(),
  tipo: z.enum(["percentuale", "importo", "spedizione"], { error: "Choose a discount type" }),
  valore: z.number({ error: "Enter the discount value" }).nullable().optional(),
  limite_usi: z.number({ error: "The use limit must be a number" }).int("The use limit must be a whole number").min(1, "The use limit must be at least 1").nullable().optional(),
  inizio: Data,
  fine: Data,
  attivo: z.boolean({ error: "Say whether the discount is live" }).optional(),
})

type Dati = z.infer<typeof DatiCodice>

/** Controlli che legano più campi. Medusa accetta anche una fine precedente all'inizio: il limite va messo qui. */
export function controllaCodice(dati: Dati) {
  if (dati.tipo !== "spedizione") {
    if (!dati.valore || dati.valore <= 0) throw invalido("The discount value must be more than zero")
    if (dati.tipo === "percentuale" && dati.valore > 100) throw invalido("The percentage can't go above 100")
  }
  if (dati.inizio && dati.fine && Date.parse(dati.fine) <= Date.parse(dati.inizio)) throw invalido("The end date must be after the start date")
}

export function statoDi(p: Promozione, ora = Date.now()): StatoSconto {
  const inizio = p.campaign?.starts_at ? new Date(p.campaign.starts_at).getTime() : null
  const fine = p.campaign?.ends_at ? new Date(p.campaign.ends_at).getTime() : null
  const esaurito = typeof p.limit === "number" && p.used >= p.limit
  if ((fine !== null && fine <= ora) || esaurito) return "terminato"
  if (p.status !== "active") return "in_pausa"
  return inizio !== null && inizio > ora ? "programmato" : "attivo"
}

export const tipoDi = (p: Promozione): TipoSconto => {
  if (p.application_method?.target_type === "shipping_methods") return "spedizione"
  return p.application_method?.type === "fixed" ? "importo" : "percentuale"
}

const prodottiDi = (p: Promozione) =>
  p.application_method?.target_rules?.find((r) => r.attribute === "items.product.id")?.values.map((v) => v.value) ?? []

export function scheda(p: Promozione) {
  const tipo = tipoDi(p)
  return {
    id: p.id,
    codice: p.code,
    descrizione: p.application_method?.description ?? null,
    tipo,
    valore: tipo === "spedizione" ? null : Number(p.application_method?.value),
    limite_usi: p.limit,
    usi: p.used,
    inizio: p.campaign?.starts_at ?? null,
    fine: p.campaign?.ends_at ?? null,
    stato: statoDi(p),
    prodotti: prodottiDi(p).length,
    azienda: (p.metadata?.azienda_nome as string | undefined) ?? null,
    proposta_id: (p.metadata?.proposta_id as string | undefined) ?? null,
    creato_il: p.created_at,
  }
}

const interroga = (scope: MedusaContainer) => scope.resolve(ContainerRegistrationKeys.QUERY)

export async function leggiPromozioni(scope: MedusaContainer, filtri: Record<string, unknown> = {}): Promise<Promozione[]> {
  const { data } = await interroga(scope).graph({
    entity: "promotion",
    fields: CAMPI,
    filters: filtri,
    pagination: { order: { created_at: "DESC" }, take: MASSIMO },
  })
  return data as unknown as Promozione[]
}

export async function leggiPromozione(scope: MedusaContainer, id: string): Promise<Promozione> {
  const [promozione] = await leggiPromozioni(scope, { id })
  if (!promozione) throw nonTrovato("Discount")
  return promozione
}

export async function codiceOccupato(scope: MedusaContainer, codice: string, tranne?: string): Promise<boolean> {
  const trovate = await leggiPromozioni(scope, { code: codice })
  return trovate.some((p) => p.id !== tranne)
}

type Metodo = { tipo: TipoSconto; valore?: number | null; descrizione?: string | null; suProdotti?: boolean }

function metodoDi({ tipo, valore, descrizione, suProdotti }: Metodo) {
  const descrizioneMetodo = descrizione || null
  if (tipo === "spedizione") {
    return { type: "percentage", target_type: "shipping_methods", allocation: "across", value: 100, currency_code: null, description: descrizioneMetodo } as const
  }
  return {
    type: tipo === "importo" ? "fixed" : "percentage",
    target_type: suProdotti ? "items" : "order",
    allocation: "across",
    value: valore as number,
    currency_code: tipo === "importo" ? VALUTA : null,
    description: descrizioneMetodo,
  } as const
}

const campagna = (codice: string, inizio: Date | null, fine: Date | null) => ({
  name: `Discount ${codice}`,
  campaign_identifier: `${PREFISSO_CAMPAGNA}${crypto.randomUUID()}`,
  starts_at: inizio,
  ends_at: fine,
})

const dataDi = (valore: string | Date | null | undefined) => (valore ? new Date(valore) : null)

/** Medusa risponde in inglese: la frase che vede l'utente si decide qui. */
async function conMessaggio<T>(lavoro: () => Promise<T>): Promise<T> {
  try {
    return await lavoro()
  } catch (errore) {
    const testo = (errore as Error).message ?? ""
    if (/already exists/i.test(testo)) throw invalido("A discount with this code already exists")
    if (/cannot be less than current usage/i.test(testo)) throw invalido("The use limit can't be lower than the uses already recorded")
    if (errore instanceof MedusaError && errore.type === MedusaError.Types.INVALID_DATA) throw invalido("The discount wasn't saved: check the details")
    throw errore
  }
}

type NuovaPromozione = Metodo & {
  codice: string
  limite_usi?: number | null
  inizio?: string | Date | null
  fine?: string | Date | null
  attivo: boolean
  prodotti?: string[]
  metadata?: Record<string, unknown>
}

export async function creaPromozione(scope: MedusaContainer, dati: NuovaPromozione): Promise<string> {
  const inizio = dataDi(dati.inizio)
  const fine = dataDi(dati.fine)
  const prodotti = dati.prodotti ?? []
  const { currency_code, ...metodo } = metodoDi({ ...dati, suProdotti: prodotti.length > 0 })
  const promozione = {
    code: dati.codice,
    type: "standard",
    is_automatic: false,
    status: dati.attivo ? "active" : "inactive",
    limit: dati.limite_usi ?? null,
    metadata: dati.metadata ?? null,
    campaign: inizio || fine ? campagna(dati.codice, inizio, fine) : undefined,
    application_method: {
      ...metodo,
      ...(currency_code ? { currency_code } : {}),
      target_rules: prodotti.length ? [{ attribute: "items.product.id", operator: "in", values: prodotti }] : undefined,
    },
  } as unknown as CreatePromotionDTO
  const { result } = await conMessaggio(() => createPromotionsWorkflow(scope).run({ input: { promotionsData: [promozione] } }))
  return result[0].id
}

export async function aggiornaPromozione(scope: MedusaContainer, attuale: Promozione, dati: Dati) {
  const inizio = dataDi(dati.inizio)
  const fine = dataDi(dati.fine)
  let campaign_id = attuale.campaign?.id
  if (attuale.campaign) {
    await conMessaggio(() => updateCampaignsWorkflow(scope).run({ input: { campaignsData: [{ id: attuale.campaign!.id, starts_at: inizio, ends_at: fine }] } }))
  } else if (inizio || fine) {
    const { result } = await conMessaggio(() => createCampaignsWorkflow(scope).run({ input: { campaignsData: [campagna(dati.codice, inizio, fine)] } }))
    campaign_id = result[0].id
  }
  await conMessaggio(() =>
    updatePromotionsWorkflow(scope).run({
      input: {
        promotionsData: [
          {
            id: attuale.id,
            code: dati.codice,
            limit: dati.limite_usi ?? null,
            campaign_id,
            application_method: metodoDi({ ...dati, suProdotti: prodottiDi(attuale).length > 0 }),
          },
        ],
      } as never,
    })
  )
}

export const cambiaStato = (scope: MedusaContainer, id: string, attivo: boolean) =>
  updatePromotionsWorkflow(scope).run({ input: { promotionsData: [{ id, status: attivo ? "active" : "inactive" }] } as never })

export async function eliminaPromozione(scope: MedusaContainer, promozione: Promozione) {
  await deletePromotionsWorkflow(scope).run({ input: { ids: [promozione.id] } })
  const propria = promozione.campaign?.campaign_identifier.startsWith(PREFISSO_CAMPAGNA)
  if (propria) await deleteCampaignsWorkflow(scope).run({ input: { ids: [promozione.campaign!.id] } })
}

/** La copia nasce in pausa: un doppione non deve andare online da solo. */
export async function duplicaPromozione(scope: MedusaContainer, originale: Promozione): Promise<string> {
  const base = `${originale.code.slice(0, 33)}-COPY`
  let codice = base
  for (let n = 2; await codiceOccupato(scope, codice); n += 1) codice = `${base}${n}`
  const { azienda_nome, azienda_id } = originale.metadata ?? {}
  return creaPromozione(scope, {
    codice,
    tipo: tipoDi(originale),
    valore: Number(originale.application_method?.value),
    descrizione: originale.application_method?.description,
    limite_usi: originale.limit,
    inizio: originale.campaign?.starts_at,
    fine: originale.campaign?.ends_at,
    attivo: false,
    prodotti: prodottiDi(originale),
    metadata: azienda_id ? { azienda_id, azienda_nome } : undefined,
  })
}
