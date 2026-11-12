import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { CARTE_REGALO_MODULE } from "../../../modules/carte-regalo"
import type CarteRegaloModuleService from "../../../modules/carte-regalo/service"
import { interroga } from "../../utili"

export const servizioCarte = (req: AuthenticatedMedusaRequest) => req.scope.resolve<CarteRegaloModuleService>(CARTE_REGALO_MODULE)

/** Più richieste sulla stessa risorsa passano una alla volta: il saldo e le decisioni non si sovrappongono. */
export const inFila = <T>(req: AuthenticatedMedusaRequest, chiave: string, lavoro: () => Promise<T>): Promise<T> =>
  req.scope.resolve(Modules.LOCKING).execute(chiave, lavoro)

/** L'email resta nei movimenti anche se la persona lascia il team. */
export async function chi(req: AuthenticatedMedusaRequest): Promise<string> {
  const { data } = await interroga(req).graph({ entity: "user", fields: ["email"], filters: { id: req.auth_context.actor_id } })
  return data[0]?.email ?? req.auth_context.actor_id
}

type Carta = {
  id: string
  codice: string
  importo_iniziale: unknown
  saldo: unknown
  valuta: string
  scadenza: Date | string | null
  stato: string
  destinatario_nome: string | null
  destinatario_email: string | null
  nota: string | null
  annullata_il: Date | string | null
  motivo_annullamento: string | null
  created_at: Date | string
}

export type StatoCarta = "attiva" | "esaurita" | "scaduta" | "annullata"

export function statoCarta(carta: Pick<Carta, "stato" | "saldo" | "scadenza">): StatoCarta {
  if (carta.stato === "annullata") return "annullata"
  if (carta.scadenza && new Date(carta.scadenza).getTime() <= Date.now()) return "scaduta"
  return Number(carta.saldo) > 0 ? "attiva" : "esaurita"
}

/** Il codice vale come denaro: chi ha solo la lettura ne vede le ultime quattro cifre. */
export const puoVedereCodice = (req: AuthenticatedMedusaRequest) => {
  const diritto = (req as unknown as { permissions?: Record<string, string> }).permissions?.sconti
  return diritto === "edit" || diritto === "manage"
}

export function schedaCarta(req: AuthenticatedMedusaRequest, carta: Carta) {
  return {
    id: carta.id,
    codice: puoVedereCodice(req) ? carta.codice : `••••-••••-••••-${carta.codice.slice(-4)}`,
    importo_iniziale: Number(carta.importo_iniziale),
    saldo: Number(carta.saldo),
    valuta: carta.valuta,
    scadenza: carta.scadenza,
    stato: statoCarta(carta),
    destinatario_nome: carta.destinatario_nome,
    destinatario_email: carta.destinatario_email,
    nota: carta.nota,
    annullata_il: carta.annullata_il,
    motivo_annullamento: carta.motivo_annullamento,
    creata_il: carta.created_at,
  }
}

export async function cartaConMovimenti(req: AuthenticatedMedusaRequest, id: string) {
  const carta = await servizioCarte(req).retrieveCarta(id, { relations: ["movimenti"] })
  const movimenti = [...carta.movimenti]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((m) => ({
      id: m.id,
      tipo: m.tipo,
      importo: Number(m.importo),
      saldo_dopo: Number(m.saldo_dopo),
      nota: m.nota,
      attore: m.attore,
      quando: m.created_at,
    }))
  return { ...schedaCarta(req, carta), movimenti }
}
