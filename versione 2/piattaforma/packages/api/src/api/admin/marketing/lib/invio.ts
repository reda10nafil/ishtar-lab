import crypto from "node:crypto"
import type { Logger, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import type MarketingModuleService from "../../../../modules/marketing/service"
import { leggiStore } from "../../impostazioni/lettura"
import { destinatariDi, leggiIscritti } from "./pubblico"

export const EVENTO_CAMPAGNA = "marketing.campagna.da_inviare"

/** Tolleranza prima di ritentare un invio programmato il cui evento non è mai arrivato. */
const RITARDO_RIPRESA = 2 * 60_000

const servizioDi = (scope: MedusaContainer) => scope.resolve<MarketingModuleService>(MARKETING_MODULE)

const segreto = (scope: MedusaContainer) => {
  const { projectConfig } = scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE)
  return String(projectConfig.http.jwtSecret)
}

export const firma = (scope: MedusaContainer, clienteId: string) => crypto.createHmac("sha256", segreto(scope)).update(clienteId).digest("base64url")

export function firmaValida(scope: MedusaContainer, clienteId: string, valore: string) {
  const attesa = Buffer.from(firma(scope, clienteId))
  const data = Buffer.from(valore)
  return attesa.length === data.length && crypto.timingSafeEqual(attesa, data)
}

const urlDisiscrizione = (scope: MedusaContainer, clienteId: string) => {
  const base = process.env.PUBLIC_BACKEND_URL ?? "http://localhost:9100"
  return `${base}/admin/marketing/disiscrizione?cliente=${encodeURIComponent(clienteId)}&firma=${firma(scope, clienteId)}`
}

const sicuro = (testo: string) => testo.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

export function componi(testo: string, negozio: string, disiscrizione: string) {
  const paragrafi = testo.split(/\n{2,}/).map((p) => `<p>${sicuro(p).replace(/\n/g, "<br>")}</p>`)
  return {
    text: `${testo}\n\n--\n${negozio}\nStop these emails: ${disiscrizione}\n`,
    html: `${paragrafi.join("")}<hr><p style="font-size:12px;color:#777">${sicuro(negozio)} · <a href="${sicuro(disiscrizione)}">Unsubscribe</a></p>`,
  }
}

type Messaggio = { origine: string; cliente_id: string; email: string; oggetto: string; testo: string; modello: string }

/** Un invio vero: la riga di consegna dice com'è andato e l'indice unico blocca i doppioni. */
async function consegna(scope: MedusaContainer, negozio: string, m: Messaggio) {
  const servizio = servizioDi(scope)
  const inviata_il = new Date()
  const base = { origine: m.origine, cliente_id: m.cliente_id, email: m.email, inviata_il }
  try {
    await scope.resolve(Modules.NOTIFICATION).createNotifications({
      to: m.email,
      channel: "email",
      template: m.modello,
      idempotency_key: `${m.origine}:${m.cliente_id}`,
      content: { subject: m.oggetto, ...componi(m.testo, negozio, urlDisiscrizione(scope, m.cliente_id)) },
    })
    await servizio.createConsegnas({ ...base, stato: "inviato" })
    return true
  } catch (errore) {
    scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER).warn(`Invio non riuscito (${m.origine}): ${(errore as Error).message}`)
    await servizio.createConsegnas({ ...base, stato: "fallito", errore: (errore as Error).message.slice(0, 300) }).catch(() => undefined)
    return false
  }
}

async function ricontaCampagna(scope: MedusaContainer, id: string, destinatari: number) {
  const servizio = servizioDi(scope)
  const consegne = await servizio.listConsegnas({ origine: `campagna:${id}` })
  const inviati = consegne.filter((c) => c.stato === "inviato").length
  const falliti = consegne.length - inviati
  await servizio.updateCampagnas({ id, destinatari, inviati, falliti })
  return { inviati, falliti }
}

/** Parte da un evento: l'invio può riprendere dopo un riavvio senza scrivere due volte alla stessa persona. */
export async function inviaCampagna(scope: MedusaContainer, id: string) {
  const servizio = servizioDi(scope)
  const [campagna] = await servizio.listCampagnas({ id })
  if (!campagna || (campagna.stato !== "programmata" && campagna.stato !== "in_invio")) return
  if (campagna.stato === "programmata" && campagna.programmata_il && new Date(campagna.programmata_il) > new Date()) return

  await servizio.updateCampagnas({ id, stato: "in_invio", avviata_il: campagna.avviata_il ?? new Date() })
  const destinatari = destinatariDi(await leggiIscritti(scope), campagna.pubblico)
  const gia = new Set((await servizio.listConsegnas({ origine: `campagna:${id}` })).map((c) => c.cliente_id))
  const { name: negozio } = await leggiStore(scope)
  await servizio.updateCampagnas({ id, destinatari: Math.max(destinatari.length, gia.size) })

  for (const cliente of destinatari.filter((c) => !gia.has(c.id))) {
    await consegna(scope, negozio, {
      origine: `campagna:${id}`,
      cliente_id: cliente.id,
      email: cliente.email as string,
      oggetto: campagna.oggetto,
      testo: campagna.testo,
      modello: "marketing-campagna",
    })
    await ricontaCampagna(scope, id, Math.max(destinatari.length, gia.size))
  }
  const { inviati } = await ricontaCampagna(scope, id, Math.max(destinatari.length, gia.size))
  await servizio.updateCampagnas({ id, stato: inviati ? "inviata" : "fallita", conclusa_il: new Date() })
}

export const accoda = (scope: MedusaContainer, id: string, ritardo = 0) =>
  scope.resolve(Modules.EVENT_BUS).emit({ name: EVENTO_CAMPAGNA, data: { id }, options: ritardo > 0 ? { delay: ritardo } : undefined })

/** L'attesa vive in Redis: se si perde, chi apre la pagina fa ripartire gli invii scaduti o interrotti. */
export async function riprendiSospese(scope: MedusaContainer) {
  const servizio = servizioDi(scope)
  const limite = Date.now() - RITARDO_RIPRESA
  const aperte = await servizio.listCampagnas({ stato: ["programmata", "in_invio"] })
  const ferme = aperte.filter((c) => new Date(c.stato === "programmata" ? (c.programmata_il ?? 0) : c.updated_at).getTime() < limite)
  await Promise.all(ferme.map((c) => accoda(scope, c.id)))
}

/** Benvenuto: una sola volta per cliente, solo con il consenso, solo se la regola è accesa. */
export async function inviaBenvenuto(scope: MedusaContainer, clienteId: string) {
  const servizio = servizioDi(scope)
  const regola = await servizio.automazione("benvenuto")
  if (!regola?.attiva) return
  const cliente = (await leggiIscritti(scope)).find((c) => c.id === clienteId)
  if (!cliente) return
  const origine = "automazione:benvenuto"
  const [gia] = await servizio.listConsegnas({ origine, cliente_id: clienteId }, { take: 1 })
  if (gia) return
  const { name: negozio } = await leggiStore(scope)
  await consegna(scope, negozio, { origine, cliente_id: clienteId, email: cliente.email as string, oggetto: regola.oggetto, testo: regola.testo, modello: "marketing-benvenuto" })
}
