import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const VALUTA = "eur"
const REGOLA_TOTALE = "item_total"
const REGOLA_REGIONE = "region_id"
const REGOLA_ATTIVA = "enabled_in_store"

type RegolaPrezzo = { attribute: string; operator: string; value: string }
type Prezzo = { id: string; currency_code: string; amount: number; price_rules?: RegolaPrezzo[] }
type RegolaOpzione = { id: string; attribute: string; operator: string; value: string }

export type Opzione = {
  id: string
  name: string
  provider_id: string
  type?: { code?: string; label?: string } | null
  service_zone?: { name?: string } | null
  seller?: { name?: string } | null
  rules?: RegolaOpzione[]
  prices?: Prezzo[]
}

const TIPI: Record<string, string> = { standard: "Standard", express: "Express" }

const CAMPI = ["id", "name", "provider_id", "type.code", "type.label", "service_zone.name", "seller.name", "rules.*", "prices.*", "prices.price_rules.*"]

const regola = (prezzo: Prezzo, attributo: string) => prezzo.price_rules?.find((r) => r.attribute === attributo)
const reso = (opzione: Opzione) => opzione.rules?.some((r) => r.attribute === "is_return" && r.value === "true")

export async function leggiOpzioni(scope: MedusaContainer, id?: string) {
  const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "shipping_option",
    fields: CAMPI,
    filters: id ? { id } : {},
  })
  return (data as unknown as Opzione[]).filter((o) => !reso(o))
}

/** Le spedizioni gratis sopra una soglia sono prezzi Medusa a zero con la regola sul totale degli articoli. */
export function vistaOpzione(opzione: Opzione) {
  const inEuro = (opzione.prices ?? []).filter((p) => p.currency_code === VALUTA)
  const base = inEuro.find((p) => !regola(p, REGOLA_TOTALE))
  const gratuita = inEuro.find((p) => regola(p, REGOLA_TOTALE))
  const soglia = gratuita ? Number(regola(gratuita, REGOLA_TOTALE)?.value) : null
  return {
    id: opzione.id,
    nome: opzione.name,
    azienda: opzione.seller?.name ?? null,
    zona: opzione.service_zone?.name ?? null,
    tipo: TIPI[opzione.type?.code ?? ""] ?? opzione.type?.label ?? null,
    tariffa: base?.amount ?? null,
    soglia_gratuita: soglia,
    attiva: !opzione.rules?.some((r) => r.attribute === REGOLA_ATTIVA && r.value === "false"),
  }
}

type RegolaTotale = { attribute: "item_total"; operator: "gte" | "gt" | "lt" | "lte" | "eq"; value: number }

/** Chiave che lega il prezzo alla sua regione o alla sua valuta: senza, Medusa la perderebbe. */
const legame = (prezzo: Prezzo) => {
  const regione = regola(prezzo, REGOLA_REGIONE)?.value
  return regione ? { region_id: regione } : { currency_code: prezzo.currency_code }
}

const regoleTotale = (prezzo: Prezzo): RegolaTotale[] =>
  (prezzo.price_rules ?? [])
    .filter((r) => r.attribute === REGOLA_TOTALE)
    .map((r) => ({ attribute: "item_total", operator: r.operator as RegolaTotale["operator"], value: Number(r.value) }))

/**
 * Medusa sostituisce tutti i prezzi: quelli non elencati vengono cancellati.
 * Cambiano solo gli euro, comprese le righe legate alla regione; le altre valute restano uguali.
 */
export function prezziAggiornati(opzione: Opzione, tariffa: number, soglia: number | null) {
  const prezzi = opzione.prices ?? []
  const altri = prezzi.filter((p) => p.currency_code !== VALUTA)
  const base = prezzi.filter((p) => p.currency_code === VALUTA && !regola(p, REGOLA_TOTALE))

  const conservati = altri.map((p) => ({ id: p.id, amount: p.amount, rules: regoleTotale(p), ...legame(p) }))
  const tariffe = base.length
    ? base.map((p) => ({ id: p.id, amount: tariffa, ...legame(p) }))
    : [{ amount: tariffa, currency_code: VALUTA }]
  const gratuite = soglia === null
    ? []
    : (base.length ? base.map(legame) : [{ currency_code: VALUTA }]).map((l) => ({
        amount: 0,
        rules: [{ attribute: "item_total" as const, operator: "gte" as const, value: soglia }],
        ...l,
      }))
  return [...conservati, ...tariffe, ...gratuite]
}

/** `enabled_in_store` è la regola che Medusa usa per mostrare l'opzione al checkout. */
export function regoleAggiornate(opzione: Opzione, attiva: boolean) {
  const regole = (opzione.rules ?? []).map(({ id, attribute, operator, value }) => ({
    id,
    attribute,
    operator,
    value: attribute === REGOLA_ATTIVA ? String(attiva) : value,
  }))
  return regole.some((r) => r.attribute === REGOLA_ATTIVA)
    ? regole
    : [...regole, { attribute: REGOLA_ATTIVA, operator: "eq", value: String(attiva) }]
}
