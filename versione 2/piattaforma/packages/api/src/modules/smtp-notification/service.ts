import { AbstractNotificationProviderService, MedusaError } from "@medusajs/framework/utils"
import type { Logger, NotificationTypes } from "@medusajs/framework/types"
import nodemailer, { type Transporter } from "nodemailer"

type Options = {
  host: string
  port: number
  from: string
  user?: string
  pass?: string
  secure?: boolean
}

type Injected = { logger: Logger }

/**
 * Invio email via SMTP. In locale punta a Mailpit: nessun messaggio esce dal PC.
 * In produzione basta indicare l'SMTP del provider scelto, senza cambiare codice.
 */
export default class SmtpNotificationService extends AbstractNotificationProviderService {
  static identifier = "smtp"

  private readonly transport: Transporter
  private readonly from: string
  private readonly logger: Logger

  constructor({ logger }: Injected, options: Options) {
    super()
    this.logger = logger
    this.from = options.from
    this.transport = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure ?? false,
      auth: options.user ? { user: options.user, pass: options.pass } : undefined,
    })
  }

  static validateOptions(options: Record<string, unknown>) {
    if (!options.host || !options.port || !options.from) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "SMTP: host, port and from are required")
    }
  }

  async send(
    notification: NotificationTypes.ProviderSendNotificationDTO
  ): Promise<NotificationTypes.ProviderSendNotificationResultsDTO> {
    const data = (notification.data ?? {}) as Record<string, unknown>
    const content = notification.content
    const subject = content?.subject ?? (data.subject as string) ?? notification.template
    const text = content?.text ?? (data.text as string) ?? JSON.stringify(data, null, 2)
    const html = content?.html ?? (data.html as string | undefined)

    const info = await this.transport.sendMail({
      from: notification.from ?? this.from,
      to: notification.to,
      subject,
      text,
      html,
    })
    this.logger.info(`Email sent: ${notification.template}`)
    return { id: info.messageId }
  }
}
