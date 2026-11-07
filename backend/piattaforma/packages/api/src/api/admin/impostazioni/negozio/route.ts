import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { updateRegionsWorkflow, updateStoresWorkflow } from "@medusajs/medusa/core-flows"
import { interroga, valida } from "../../../utili"
import { leggiStore, metadatiCon, valutaBase, VALUTE } from "../lettura"

const MASSIMO_OBIETTIVO = 100_000_000
const CODICI = VALUTE.map((v) => v.codice) as [string, ...string[]]

const fusoValido = (fuso: string) => {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: fuso })
    return true
  } catch {
    return false
  }
}

const breve = (messaggio: string, massimo: number) => z.string({ error: messaggio }).trim().max(massimo, messaggio)

const Negozio = z.object({
  nome: z.string({ error: "Enter the store name" }).trim().min(1, "Enter the store name").max(120, "Store name is too long"),
  email: z.union([z.literal(""), z.string({ error: "Invalid email" }).trim().email("Invalid email")], { error: "Invalid email" }),
  telefono: breve("Invalid phone number", 40).regex(/^[+\d\s()./-]*$/, "Invalid phone number"),
  indirizzo: z.object(
    {
      via: breve("Invalid street address", 160),
      cap: breve("Invalid postcode", 12),
      citta: breve("Invalid city", 80),
      provincia: breve("Invalid county", 80),
      paese: breve("Invalid country", 80),
    },
    { error: "Invalid address" }
  ),
  partita_iva: breve("Invalid VAT number", 30),
  valuta: z.enum(CODICI, { error: "Choose EUR, GBP or USD" }),
  fuso: z.string({ error: "Choose a time zone" }).refine(fusoValido, "Invalid time zone"),
  prezzi_con_iva: z.boolean({ error: "Say whether prices include VAT" }),
  obiettivo_giornaliero: z
    .number({ error: "The goal must be an amount" })
    .min(0, "The goal cannot be negative")
    .max(MASSIMO_OBIETTIVO, "The goal is too high")
    .nullable(),
})

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { nome, prezzi_con_iva, ...dati } = valida(Negozio, req.body)
  const store = await leggiStore(req.scope)
  const attive = store.supported_currencies
  // La valuta scelta cambia solo come si mostrano gli importi: l'IVA segue la valuta in cui Medusa tiene i prezzi.
  const base = valutaBase(store)

  const query = interroga(req)
  const [{ data: preferenze }, { data: regioni }] = await Promise.all([
    query.graph({ entity: "price_preference", fields: ["value", "is_tax_inclusive"], filters: { attribute: "currency_code", value: attive.map((v) => v.currency_code) } }),
    query.graph({ entity: "region", fields: ["id"], filters: { currency_code: base } }),
  ])
  const conIva = new Map(preferenze.map((p) => [p.value, Boolean(p.is_tax_inclusive)]))

  await updateStoresWorkflow(req.scope).run({
    input: {
      selector: { id: store.id },
      update: {
        name: nome,
        metadata: metadatiCon(store, { negozio: dati as Parameters<typeof metadatiCon>[1]["negozio"] }),
        supported_currencies: attive.map((v) => ({
          currency_code: v.currency_code,
          is_default: v.is_default,
          is_tax_inclusive: v.currency_code === base ? prezzi_con_iva : conIva.get(v.currency_code) ?? false,
        })),
      },
    },
  })
  // La preferenza della regione prevale su quella della valuta: vanno tenute uguali.
  for (const { id } of regioni) {
    await updateRegionsWorkflow(req.scope).run({ input: { selector: { id }, update: { is_tax_inclusive: prezzi_con_iva } } })
  }
  res.json({ ok: true })
}
