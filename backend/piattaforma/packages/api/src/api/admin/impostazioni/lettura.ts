import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

export const VALUTE = [
  { codice: "EUR", nome: "Euro" },
  { codice: "GBP", nome: "Pound sterling" },
  { codice: "USD", nome: "US dollar" },
] as const

export type CodiceValuta = (typeof VALUTE)[number]["codice"]

export type Indirizzo = { via: string; cap: string; citta: string; provincia: string; paese: string }
export type DatiNegozio = {
  email: string
  telefono: string
  indirizzo: Indirizzo
  partita_iva: string
  /** Valuta mostrata negli importi: i prezzi non vengono convertiti. */
  valuta: CodiceValuta
  fuso: string
  obiettivo_giornaliero: number | null
}
export type RegoleSpedizione = { giorni_max_evasione: number | null }
export type Impostazioni = { negozio: DatiNegozio; spedizioni: RegoleSpedizione }

type ValutaStore = { currency_code: string; is_default: boolean }
export type Store = { id: string; name: string; metadata: Record<string, unknown> | null; supported_currencies: ValutaStore[] }

const PREDEFINITE: Impostazioni = {
  negozio: {
    email: "",
    telefono: "",
    indirizzo: { via: "", cap: "", citta: "", provincia: "", paese: "Italy" },
    partita_iva: "",
    valuta: "EUR",
    fuso: "Europe/Rome",
    obiettivo_giornaliero: null,
  },
  spedizioni: { giorni_max_evasione: null },
}

export async function leggiStore(scope: MedusaContainer): Promise<Store> {
  const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "store",
    fields: ["id", "name", "metadata", "supported_currencies.*"],
    pagination: { take: 1 },
  })
  const store = data[0] as unknown as Store | undefined
  if (!store) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Store not configured")
  return store
}

/** Valuta in cui Medusa tiene i prezzi. Non cambia con la valuta scelta nelle impostazioni. */
export const valutaBase = (store: Store) =>
  store.supported_currencies.find((v) => v.is_default)?.currency_code ?? store.supported_currencies[0]?.currency_code ?? "eur"

export function impostazioniDi(store: Store): Impostazioni {
  const salvate = (store.metadata?.impostazioni ?? {}) as Partial<Impostazioni>
  return {
    negozio: {
      ...PREDEFINITE.negozio,
      ...salvate.negozio,
      indirizzo: { ...PREDEFINITE.negozio.indirizzo, ...salvate.negozio?.indirizzo },
    },
    spedizioni: { ...PREDEFINITE.spedizioni, ...salvate.spedizioni },
  }
}

/**
 * Impostazioni del negozio per il codice del server: valuta, obiettivo del giorno,
 * tempo massimo di evasione e dati di contatto.
 */
export const leggiImpostazioni = async (scope: MedusaContainer) => impostazioniDi(await leggiStore(scope))

/** Medusa sostituisce i metadati interi: si conservano le altre chiavi e cambia solo la parte indicata. */
export const metadatiCon = (store: Store, parte: Partial<Impostazioni>) => ({
  ...store.metadata,
  impostazioni: { ...impostazioniDi(store), ...parte },
})
