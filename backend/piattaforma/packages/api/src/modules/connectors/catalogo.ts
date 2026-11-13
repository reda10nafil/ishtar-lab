import type { EsitoProva } from "./prova"
import { provaCasella } from "../conversazioni/canali/email-connessioni"

/**
 * Catalogo dei servizi collegabili. Ogni voce descrive come si accede e come provare il collegamento.
 * `confermato: false` indica che indirizzi o metodo non sono stati riscontrati nella documentazione
 * ufficiale: vanno ricontrollati al primo collegamento con un account reale.
 */
export type Categoria = "social" | "messaggi" | "spedizioni" | "pagamenti" | "contabilita" | "email" | "negozi" | "ai" | "analisi"

export type Campo = {
  chiave: string
  etichetta: string
  segreto: boolean
  segnaposto?: string
  aiuto?: string
  facoltativo?: boolean
  /** Server o account a cui vanno i campi segreti: cambiarlo richiede di riscriverli (non vanno a un server nuovo da soli). */
  legatoAlSegreto?: boolean
}

export type Valori = Record<string, string>
export type Token = { access_token: string; refresh_token?: string; expires_at?: number; scope?: string }

export type RichiestaProva = {
  url: string
  headers?: Record<string, string>
  /** Se presente la prova usa POST: i segreti vanno nel corpo, mai nell'indirizzo. */
  corpo?: URLSearchParams
  account?: (dati: any) => string | undefined
}

export type ConfigOAuth = {
  autorizzazione: string
  token: string
  ambiti: string[]
  separatoreAmbiti?: string
  /** Nome del parametro con l'identificativo dell'app (TikTok usa client_key). */
  parametroClient?: string
  pkce: boolean
  /** Credenziali inviate con Basic invece che nel corpo. */
  autenticazioneBasic?: boolean
  /** Richiede un indirizzo di ritorno HTTPS anche in sviluppo. */
  richiedeHttps: boolean
  extra?: Record<string, string>
  scambioLungaDurata?: "instagram"
}

export type Servizio = {
  id: string
  nome: string
  fornitore: string
  categoria: Categoria
  descrizione: string
  accesso: "login" | "chiave"
  campi: Campo[]
  documentazione: string
  iscrizione?: string
  oauth?: ConfigOAuth
  prova?: (valori: Valori, token?: Token) => RichiestaProva
  /** Prova che non è una richiesta HTTP (per esempio login IMAP e SMTP della casella email): ha la precedenza su `prova`. */
  provaPersonalizzata?: (valori: Valori) => Promise<EsitoProva>
  valida?: (valori: Valori) => string | null
  /** Area che verrà usata solo con le vendite, l'ultima fase. */
  fase?: "vendite"
  confermato: boolean
}

/**
 * Indirizzo dell'API Telegram. `TELEGRAM_API_BASE` serve alle prove con un server finto: il token del bot viaggia
 * nell'indirizzo di ogni chiamata, quindi si accetta solo HTTPS oppure un indirizzo di questo computer (l'istanza gira
 * con NODE_ENV=development anche quando è quella vera, quindi NODE_ENV non basta a distinguere).
 */
export function baseTelegram(): string {
  const scelto = process.env.TELEGRAM_API_BASE?.trim() ?? ""
  let valido = false
  try {
    const indirizzo = new URL(scelto)
    valido = indirizzo.protocol === "https:" || (indirizzo.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(indirizzo.hostname))
  } catch {
    valido = false
  }
  return (valido ? scelto : "https://api.telegram.org").replace(/\/+$/, "")
}

const appSviluppatore: Campo[] = [
  { chiave: "client_id", etichetta: "Application ID", segreto: false, aiuto: "From the service's developer dashboard" },
  { chiave: "client_secret", etichetta: "Application secret key", segreto: true },
]

const GRAPH = "v27.0"

export function sitoPubblico(valore: string): string | null {
  let url: URL
  try {
    url = new URL(valore)
  } catch {
    return "Invalid address"
  }
  if (url.protocol !== "https:") return "The site must use https"
  if (url.username || url.password || url.search || url.hash) return "Use a site address without credentials, query or fragment"
  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  const interno =
    host === "localhost" ||
    host.endsWith(".local") ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) ||
    host.startsWith("[")
  return interno ? "A public site is required, not an internal address" : null
}

export const CATALOGO: Servizio[] = [
  {
    id: "instagram",
    nome: "Instagram",
    fornitore: "Meta",
    categoria: "social",
    descrizione: "Publish content and reply to comments and direct messages.",
    accesso: "login",
    campi: appSviluppatore,
    documentazione: "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login",
    iscrizione: "https://developers.facebook.com/apps",
    confermato: true,
    oauth: {
      autorizzazione: "https://www.instagram.com/oauth/authorize",
      token: "https://api.instagram.com/oauth/access_token",
      ambiti: [
        "instagram_business_basic",
        "instagram_business_content_publish",
        "instagram_business_manage_messages",
        "instagram_business_manage_comments",
      ],
      separatoreAmbiti: ",",
      pkce: false,
      richiedeHttps: true,
      scambioLungaDurata: "instagram",
    },
    prova: (_v, token) => ({
      url: `https://graph.instagram.com/me?fields=user_id,username&access_token=${encodeURIComponent(token?.access_token ?? "")}`,
      account: (d) => d.username,
    }),
  },
  {
    id: "facebook",
    nome: "Facebook",
    fornitore: "Meta",
    categoria: "social",
    descrizione: "Manage Pages, Messenger, catalogues and Instagram product tags.",
    accesso: "login",
    campi: appSviluppatore,
    documentazione: "https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow",
    iscrizione: "https://developers.facebook.com/apps",
    confermato: true,
    oauth: {
      autorizzazione: `https://www.facebook.com/${GRAPH}/dialog/oauth`,
      token: `https://graph.facebook.com/${GRAPH}/oauth/access_token`,
      ambiti: ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "business_management", "catalog_management"],
      separatoreAmbiti: ",",
      pkce: false,
      richiedeHttps: true,
    },
    prova: (_v, token) => ({
      url: `https://graph.facebook.com/${GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(token?.access_token ?? "")}`,
      account: (d) => d.name,
    }),
  },
  {
    id: "tiktok",
    nome: "TikTok",
    fornitore: "TikTok",
    categoria: "social",
    descrizione: "Publish videos and read how your content performs.",
    accesso: "login",
    campi: [
      { chiave: "client_id", etichetta: "Client key", segreto: false },
      { chiave: "client_secret", etichetta: "Client secret", segreto: true },
    ],
    documentazione: "https://developers.tiktok.com/doc/login-kit-web",
    iscrizione: "https://developers.tiktok.com/",
    confermato: false,
    oauth: {
      autorizzazione: "https://www.tiktok.com/v2/auth/authorize/",
      token: "https://open.tiktokapis.com/v2/oauth/token/",
      ambiti: ["user.info.basic", "video.publish", "video.list"],
      separatoreAmbiti: ",",
      parametroClient: "client_key",
      pkce: true,
      richiedeHttps: true,
    },
    prova: (_v, token) => ({
      url: "https://open.tiktokapis.com/v2/user/info/?fields=display_name",
      headers: { authorization: `Bearer ${token?.access_token}` },
      account: (d) => d?.data?.user?.display_name,
    }),
  },
  {
    id: "pinterest",
    nome: "Pinterest",
    fornitore: "Pinterest",
    categoria: "social",
    descrizione: "Publish pins and connect your product catalogue.",
    accesso: "login",
    campi: appSviluppatore,
    documentazione: "https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/",
    iscrizione: "https://developers.pinterest.com/",
    confermato: true,
    oauth: {
      autorizzazione: "https://www.pinterest.com/oauth/",
      token: "https://api.pinterest.com/v5/oauth/token",
      ambiti: ["boards:read", "boards:write", "pins:read", "pins:write", "user_accounts:read"],
      separatoreAmbiti: ",",
      pkce: false,
      autenticazioneBasic: true,
      richiedeHttps: false,
    },
    prova: (_v, token) => ({
      url: "https://api.pinterest.com/v5/user_account",
      headers: { authorization: `Bearer ${token?.access_token}` },
      account: (d) => d.username,
    }),
  },
  {
    id: "google",
    nome: "Google and YouTube",
    fornitore: "Google",
    categoria: "social",
    descrizione: "YouTube, Merchant Center and site statistics with a single sign-in.",
    accesso: "login",
    campi: appSviluppatore,
    documentazione: "https://developers.google.com/identity/protocols/oauth2/web-server",
    iscrizione: "https://console.cloud.google.com/apis/credentials",
    confermato: true,
    oauth: {
      autorizzazione: "https://accounts.google.com/o/oauth2/v2/auth",
      token: "https://oauth2.googleapis.com/token",
      ambiti: [
        "openid",
        "email",
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/content",
        "https://www.googleapis.com/auth/analytics.readonly",
      ],
      pkce: true,
      richiedeHttps: false,
      extra: { access_type: "offline", prompt: "consent" },
    },
    prova: (_v, token) => ({
      url: "https://openidconnect.googleapis.com/v1/userinfo",
      headers: { authorization: `Bearer ${token?.access_token}` },
      account: (d) => d.email,
    }),
  },
  {
    id: "linkedin",
    nome: "LinkedIn",
    fornitore: "Microsoft",
    categoria: "social",
    descrizione: "Publish company updates and find new partners.",
    accesso: "login",
    campi: appSviluppatore,
    documentazione: "https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow",
    iscrizione: "https://www.linkedin.com/developers/apps",
    confermato: true,
    oauth: {
      autorizzazione: "https://www.linkedin.com/oauth/v2/authorization",
      token: "https://www.linkedin.com/oauth/v2/accessToken",
      ambiti: ["openid", "profile", "w_member_social"],
      pkce: false,
      richiedeHttps: true,
    },
    prova: (_v, token) => ({
      url: "https://api.linkedin.com/v2/userinfo",
      headers: { authorization: `Bearer ${token?.access_token}` },
      account: (d) => d.name,
    }),
  },
  {
    id: "x",
    nome: "X",
    fornitore: "X Corp",
    categoria: "social",
    descrizione: "Publish posts and read interactions.",
    accesso: "login",
    campi: appSviluppatore,
    documentazione: "https://docs.x.com/resources/fundamentals/authentication/oauth-2-0/authorization-code",
    iscrizione: "https://developer.x.com/",
    confermato: true,
    oauth: {
      autorizzazione: "https://x.com/i/oauth2/authorize",
      token: "https://api.x.com/2/oauth2/token",
      ambiti: ["tweet.read", "tweet.write", "users.read", "offline.access"],
      pkce: true,
      autenticazioneBasic: true,
      richiedeHttps: false,
    },
    prova: (_v, token) => ({
      url: "https://api.x.com/2/users/me",
      headers: { authorization: `Bearer ${token?.access_token}` },
      account: (d) => d?.data?.username,
    }),
  },
  {
    id: "whatsapp",
    nome: "WhatsApp Business",
    fornitore: "Meta",
    categoria: "messaggi",
    descrizione: "Customer conversations and order notifications.",
    accesso: "chiave",
    campi: [
      { chiave: "phone_number_id", etichetta: "Phone number ID", segreto: false },
      { chiave: "access_token", etichetta: "Access token", segreto: true },
    ],
    documentazione: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
    iscrizione: "https://business.facebook.com/",
    confermato: false,
    prova: (v) => ({
      url: `https://graph.facebook.com/${GRAPH}/${encodeURIComponent(v.phone_number_id)}`,
      headers: { authorization: `Bearer ${v.access_token}` },
      account: (d) => d.display_phone_number ?? d.verified_name,
    }),
  },
  {
    id: "telegram",
    nome: "Telegram",
    fornitore: "Telegram",
    categoria: "messaggi",
    descrizione: "Bot for customer messages: its private chats appear in the shop inbox. Use it only for this.",
    accesso: "chiave",
    campi: [{ chiave: "bot_token", etichetta: "Bot token", segreto: true, aiuto: "From @BotFather" }],
    documentazione: "https://core.telegram.org/bots/api#getme",
    confermato: true,
    prova: (v) => ({
      url: `${baseTelegram()}/bot${v.bot_token}/getMe`,
      account: (d) => d?.result?.username,
    }),
  },
  {
    id: "casella_email",
    nome: "Shop mailbox",
    fornitore: "IMAP / SMTP",
    categoria: "email",
    descrizione:
      "The shop's email address: customer emails appear in Chats and replies go out in the same thread. Works with Gmail, Aruba, Libero, Register.it, iCloud and Yahoo; Outlook and Microsoft 365 are not supported yet.",
    accesso: "chiave",
    campi: [
      { chiave: "indirizzo", etichetta: "Email address", segreto: false, segnaposto: "shop@example.com", aiuto: "The address customers write to", legatoAlSegreto: true },
      { chiave: "nome", etichetta: "Sender name", segreto: false, facoltativo: true, segnaposto: "Ishtar Hub", aiuto: "Shown to customers next to the address" },
      { chiave: "utente", etichetta: "Username", segreto: false, facoltativo: true, aiuto: "Leave empty to use the email address", legatoAlSegreto: true },
      {
        chiave: "password",
        etichetta: "Password",
        segreto: true,
        aiuto: "Gmail, iCloud and Yahoo: an app password (needs two-step verification). Aruba, Libero and Register.it: the mailbox password",
      },
      { chiave: "imap_host", etichetta: "IMAP server", segreto: false, segnaposto: "imap.gmail.com", aiuto: "Aruba: imaps.aruba.it · Libero: imapmail.libero.it", legatoAlSegreto: true },
      { chiave: "imap_porta", etichetta: "IMAP port", segreto: false, facoltativo: true, segnaposto: "993", legatoAlSegreto: true },
      { chiave: "smtp_host", etichetta: "SMTP server", segreto: false, segnaposto: "smtp.gmail.com", aiuto: "Aruba: smtps.aruba.it · Libero: smtp.libero.it", legatoAlSegreto: true },
      { chiave: "smtp_porta", etichetta: "SMTP port", segreto: false, facoltativo: true, segnaposto: "465", aiuto: "465 (SSL) or 587 (STARTTLS)", legatoAlSegreto: true },
      {
        chiave: "server_verifica",
        etichetta: "Sender check server",
        segreto: false,
        facoltativo: true,
        segnaposto: "mx.google.com",
        aiuto: "Optional: the name your mail server writes in Authentication-Results, to tell customers' real addresses from forged ones",
      },
    ],
    documentazione: "https://support.google.com/mail/answer/7126229",
    confermato: true,
    valida: (v) => {
      if (!/^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z0-9-]{2,}$/i.test(v.indirizzo?.trim() ?? "")) return "Enter a valid email address"
      for (const campo of ["imap_host", "smtp_host"]) {
        if (!/^[a-z0-9.-]+$/i.test(v[campo]?.trim() ?? "")) return "Enter only the server name, for example imap.gmail.com"
      }
      for (const campo of ["imap_porta", "smtp_porta"]) {
        const porta = v[campo]?.trim()
        if (porta && (!/^\d{1,5}$/.test(porta) || Number(porta) < 1 || Number(porta) > 65535)) return "Ports are numbers, for example 993"
      }
      return null
    },
    provaPersonalizzata: (valori) => provaCasella(valori),
  },
  {
    id: "sendcloud",
    nome: "Sendcloud",
    fornitore: "Sendcloud",
    categoria: "spedizioni",
    descrizione: "Labels, tracking and returns with Poste, BRT, GLS and other couriers.",
    accesso: "chiave",
    campi: [
      { chiave: "public_key", etichetta: "Public key", segreto: false },
      { chiave: "secret_key", etichetta: "Secret key", segreto: true },
    ],
    documentazione: "https://sendcloud.dev/",
    iscrizione: "https://www.sendcloud.com/",
    confermato: false,
    prova: (v) => ({
      url: "https://panel.sendcloud.sc/api/v2/user",
      headers: { authorization: `Basic ${Buffer.from(`${v.public_key}:${v.secret_key}`).toString("base64")}` },
      account: (d) => d?.user?.company_name ?? d?.user?.username,
    }),
  },
  {
    id: "stripe",
    nome: "Stripe",
    fornitore: "Stripe",
    categoria: "pagamenti",
    descrizione: "Online payments, refunds and in-store payments.",
    accesso: "chiave",
    campi: [{ chiave: "secret_key", etichetta: "Secret key", segreto: true, segnaposto: "sk_test_...", aiuto: "Use a test key until sales are ready" }],
    documentazione: "https://docs.stripe.com/keys",
    iscrizione: "https://dashboard.stripe.com/register",
    fase: "vendite",
    confermato: true,
    prova: (v) => ({
      url: "https://api.stripe.com/v1/account",
      headers: { authorization: `Bearer ${v.secret_key}` },
      account: (d) => d?.settings?.dashboard?.display_name ?? d?.email,
    }),
  },
  {
    id: "fatture-in-cloud",
    nome: "Fatture in Cloud",
    fornitore: "TeamSystem",
    categoria: "contabilita",
    descrizione: "Customer invoices and supplier documents.",
    accesso: "login",
    campi: appSviluppatore,
    documentazione: "https://developers.fattureincloud.it/docs/authentication/",
    iscrizione: "https://secure.fattureincloud.it/",
    fase: "vendite",
    confermato: false,
    oauth: {
      autorizzazione: "https://api-v2.fattureincloud.it/oauth/authorize",
      token: "https://api-v2.fattureincloud.it/oauth/token",
      ambiti: ["entity.clients:r", "issued_documents.invoices:a"],
      separatoreAmbiti: " ",
      pkce: true,
      richiedeHttps: false,
    },
    prova: (_v, token) => ({
      url: "https://api-v2.fattureincloud.it/user/info",
      headers: { authorization: `Bearer ${token?.access_token}` },
      account: (d) => d?.data?.email,
    }),
  },
  {
    id: "brevo",
    nome: "Brevo",
    fornitore: "Brevo",
    categoria: "email",
    descrizione: "Transactional email, campaigns and SMS.",
    accesso: "chiave",
    campi: [{ chiave: "api_key", etichetta: "API key", segreto: true }],
    documentazione: "https://developers.brevo.com/",
    iscrizione: "https://www.brevo.com/",
    confermato: true,
    prova: (v) => ({
      url: "https://api.brevo.com/v3/account",
      headers: { "api-key": v.api_key },
      account: (d) => d.email,
    }),
  },
  {
    id: "resend",
    nome: "Resend",
    fornitore: "Resend",
    categoria: "email",
    descrizione: "Transactional email for confirmations, invitations and alerts.",
    accesso: "chiave",
    campi: [{ chiave: "api_key", etichetta: "API key", segreto: true, segnaposto: "re_..." }],
    documentazione: "https://resend.com/docs/api-reference/introduction",
    iscrizione: "https://resend.com/",
    confermato: false,
    prova: (v) => ({
      url: "https://api.resend.com/domains",
      headers: { authorization: `Bearer ${v.api_key}`, "user-agent": "multi-outfit" },
    }),
  },
  {
    id: "shopify",
    nome: "Shopify",
    fornitore: "Shopify",
    categoria: "negozi",
    descrizione: "Import products and orders from a Shopify shop.",
    accesso: "chiave",
    campi: [
      { chiave: "shop", etichetta: "Shop domain", segreto: false, segnaposto: "yourshop.myshopify.com" },
      ...appSviluppatore,
    ],
    documentazione: "https://shopify.dev/apps/build/dev-dashboard/get-api-access-tokens",
    iscrizione: "https://www.shopify.com/",
    fase: "vendite",
    confermato: false,
    valida: (v) => (/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(v.shop ?? "") ? null : "Enter the domain as yourshop.myshopify.com"),
    prova: (v) => ({
      url: `https://${v.shop}/admin/oauth/access_token`,
      corpo: new URLSearchParams({ grant_type: "client_credentials", client_id: v.client_id, client_secret: v.client_secret }),
      account: () => v.shop,
    }),
  },
  {
    id: "woocommerce",
    nome: "WooCommerce",
    fornitore: "Automattic",
    categoria: "negozi",
    descrizione: "Import products and orders from a WordPress site.",
    accesso: "chiave",
    campi: [
      { chiave: "site", etichetta: "Site address", segreto: false, segnaposto: "https://yourshop.com", legatoAlSegreto: true },
      { chiave: "consumer_key", etichetta: "Consumer key", segreto: false },
      { chiave: "consumer_secret", etichetta: "Consumer secret", segreto: true },
    ],
    documentazione: "https://developer.woocommerce.com/docs/apis/rest-api/authentication/",
    fase: "vendite",
    confermato: true,
    valida: (v) => sitoPubblico(v.site ?? ""),
    prova: (v) => ({
      url: (() => { const url = new URL(v.site); url.pathname = `${url.pathname.replace(/\/+$/, '')}/wp-json/wc/v3/system_status`; return url.toString() })(),
      headers: { authorization: `Basic ${Buffer.from(`${v.consumer_key}:${v.consumer_secret}`).toString("base64")}` },
      account: () => new URL(v.site).hostname,
    }),
  },
  {
    id: "anthropic",
    nome: "Claude",
    fornitore: "Anthropic",
    categoria: "ai",
    descrizione: "AI assistant for sales, customers and product copy.",
    accesso: "chiave",
    campi: [{ chiave: "api_key", etichetta: "API key", segreto: true, segnaposto: "sk-ant-..." }],
    documentazione: "https://platform.claude.com/docs/",
    iscrizione: "https://console.anthropic.com/",
    confermato: false,
    prova: (v) => ({
      url: "https://api.anthropic.com/v1/models",
      headers: { "x-api-key": v.api_key, "anthropic-version": "2023-06-01" },
    }),
  },
  {
    id: "plausible",
    nome: "Plausible",
    fornitore: "Plausible",
    categoria: "analisi",
    descrizione: "Privacy-friendly site statistics.",
    accesso: "chiave",
    campi: [
      { chiave: "site_id", etichetta: "Site domain", segreto: false, segnaposto: "yourshop.com" },
      { chiave: "api_key", etichetta: "API key", segreto: true },
    ],
    documentazione: "https://plausible.io/docs/stats-api",
    iscrizione: "https://plausible.io/",
    confermato: false,
    prova: (v) => ({
      url: `https://plausible.io/api/v1/stats/aggregate?site_id=${encodeURIComponent(v.site_id)}&metrics=visitors`,
      headers: { authorization: `Bearer ${v.api_key}` },
      account: () => v.site_id,
    }),
  },
]

/**
 * Servizio fittizio per collaudare i flussi senza account reali.
 * Esiste solo se CONNECTORS_DEMO_URL è impostato, quindi mai in produzione.
 */
function servizioDiProva(base: string): Servizio {
  return {
    id: "demo",
    nome: "Test service",
    fornitore: "Local only",
    categoria: "analisi",
    descrizione: "Try sign-in and keys without real accounts. It never appears in production.",
    accesso: "login",
    campi: [
      { chiave: "client_id", etichetta: "Application ID", segreto: false, segnaposto: "test-app" },
      { chiave: "client_secret", etichetta: "Application secret key", segreto: true, aiuto: "The test value is in the project README" },
    ],
    documentazione: base,
    confermato: true,
    oauth: { autorizzazione: `${base}/authorize`, token: `${base}/token`, ambiti: ["read"], pkce: true, richiedeHttps: false },
    prova: (_v, token) => ({
      url: `${base}/me`,
      headers: { authorization: `Bearer ${token?.access_token}` },
      account: (d) => d.account,
    }),
  }
}

export function catalogoAttivo(): Servizio[] {
  const demo = process.env.NODE_ENV !== 'production' && process.env.CONNECTORS_DEMO_URL
  return demo ? [...CATALOGO, servizioDiProva(demo)] : CATALOGO
}

export function trovaServizio(id: string): Servizio | undefined {
  return catalogoAttivo().find((s) => s.id === id)
}

/** Restituisce il primo problema dei valori inseriti, oppure null se sono validi. */
export function valoriValidi(servizio: Servizio, valori: Valori): string | null {
  for (const campo of servizio.campi) {
    const valore = valori[campo.chiave]
    if (!campo.facoltativo && !valore?.trim()) return `Fill in the ${campo.etichetta} field`
    if (valore && valore.length > 4096) return `${campo.etichetta} is too long`
  }
  return servizio.valida?.(valori) ?? null
}

/**
 * Vero se i valori inseriti cambiano un server o un account legato ai campi segreti senza riscriverli: il segreto salvato
 * andrebbe da solo al server nuovo, scelto da chi modifica (che i segreti non li vede).
 */
export function segretoDaRiscrivere(servizio: Servizio, salvati: Valori | undefined, inseriti: Record<string, unknown>): boolean {
  if (!salvati) return false
  const scritto = (chiave: string) => typeof inseriti[chiave] === "string" && (inseriti[chiave] as string).trim() !== ""
  const cambiato = servizio.campi.some((c) => c.legatoAlSegreto && scritto(c.chiave) && (inseriti[c.chiave] as string).trim() !== (salvati[c.chiave] ?? ""))
  return cambiato && servizio.campi.some((c) => c.segreto && !scritto(c.chiave))
}
