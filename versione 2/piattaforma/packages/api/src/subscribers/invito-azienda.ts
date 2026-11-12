import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

type EventoInvito = { id: string; token?: string }

/**
 * Invia l'invito alle aziende. Il codice originale esiste solo in questo evento:
 * nel database Mercur conserva unicamente la sua impronta.
 */
export default async function invitoAzienda({ event: { data }, container }: SubscriberArgs<EventoInvito | EventoInvito[]>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const notifications = container.resolve(Modules.NOTIFICATION)

  for (const invito of Array.isArray(data) ? data : [data]) {
    if (!invito.token) {
      logger.warn("Company invitation without a token: email not sent")
      continue
    }
    const { data: trovati } = await query.graph({
      entity: "member_invite",
      fields: ["email", "seller.name"],
      filters: { id: invito.id },
    })
    const dettaglio = trovati[0]
    if (!dettaglio) continue

    const azienda = dettaglio.seller?.name ?? "your company"
    const link = `${process.env.CONSOLE_URL}/invito?token=${encodeURIComponent(invito.token)}`
    await notifications.createNotifications({
      to: dettaglio.email,
      channel: "email",
      template: "invito-azienda",
      content: {
        subject: "Activate your Ishtar Lab access",
        text: `Ishtar Lab has invited you to manage ${azienda}.\n\nActivate your access from this link:\n${link}\n`,
        html: `<p>Ishtar Lab has invited you to manage <strong>${azienda.replace(/[<>&]/g, "")}</strong>.</p><p><a href="${link}">Activate your access</a></p>`,
      },
    })
  }
}

export const config: SubscriberConfig = { event: "member_invite.created" }
