import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/** Invia l'email di invito: senza questo passaggio l'invito resta solo nel database. */
export default async function invitoEmail({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const notifications = container.resolve(Modules.NOTIFICATION)
  const { data: invites } = await query.graph({
    entity: "invite",
    fields: ["email", "token"],
    filters: { id: data.id },
  })
  const invite = invites[0]
  if (!invite) return

  const link = `${process.env.CONSOLE_URL}/invito-team?token=${encodeURIComponent(invite.token)}`
  await notifications.createNotifications({
    to: invite.email,
    channel: "email",
    template: "invito-team",
    content: {
      subject: "Invitation to join the Ishtar Lab team",
      text: `You have been invited to join the Ishtar Lab team.\n\nAccept the invitation from this link:\n${link}\n`,
      html: `<p>You have been invited to join the Ishtar Lab team.</p><p><a href="${link}">Accept the invitation</a></p>`,
    },
  })
}

export const config: SubscriberConfig = {
  event: ["invite.created", "invite.resent"],
}
