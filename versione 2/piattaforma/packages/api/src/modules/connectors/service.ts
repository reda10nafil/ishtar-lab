import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import { ConnectorAccount } from "./models/connector-account"
import { OauthState } from "./models/oauth-state"
import { catalogoAttivo, trovaServizio, valoriValidi, type Servizio, type Token, type Valori } from "./catalogo"
import { cifra, decifra } from "./crypto"
import { eseguiProva } from "./prova"
import { creaPkce, creaStato, improntaStato, rinnovaToken, scambiaCodice, urlAutorizzazione } from "./oauth"

type Segreti = { valori: Valori; token?: Token }

const DURATA_LOGIN_MS = 10 * 60 * 1000
const MARGINE_RINNOVO_MS = 24 * 60 * 60 * 1000

function chiave(): string {
  const valore = process.env.CONNECTORS_KEY
  if (!valore) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "CONNECTORS_KEY is not configured")
  return valore
}

function indirizzoRitorno(): string {
  return `${process.env.PUBLIC_BACKEND_URL}/connectors/oauth/callback`
}

function servizioOErrore(id: string): Servizio {
  const servizio = trovaServizio(id)
  if (!servizio) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Unknown service")
  return servizio
}

export default class ConnectorsModuleService extends MedusaService({ ConnectorAccount, OauthState }) {
  private leggiSegreti(cifrato: string): Segreti {
    return JSON.parse(decifra(cifrato, chiave())) as Segreti
  }

  private scriviSegreti(segreti: Segreti): string {
    return cifra(JSON.stringify(segreti), chiave())
  }

  private async conto(provider: string) {
    const [conto] = await this.listConnectorAccounts({ provider })
    return conto
  }

  /** Vista per l'interfaccia: i valori segreti non escono mai dal server. */
  async elenco() {
    const conti = await this.listConnectorAccounts({})
    const perServizio = new Map(conti.map((c) => [c.provider, c]))
    const ritorno = indirizzoRitorno()
    return catalogoAttivo().map((s) => {
      const conto = perServizio.get(s.id)
      const valori = conto ? this.leggiSegreti(conto.secret).valori : {}
      return {
        id: s.id,
        nome: s.nome,
        fornitore: s.fornitore,
        categoria: s.categoria,
        descrizione: s.descrizione,
        accesso: s.accesso,
        documentazione: s.documentazione,
        iscrizione: s.iscrizione ?? null,
        fase: s.fase ?? null,
        confermato: s.confermato,
        ambiti: s.oauth?.ambiti ?? [],
        indirizzo_ritorno: s.accesso === "login" ? ritorno : null,
        richiede_dominio: Boolean(s.oauth?.richiedeHttps && !ritorno.startsWith("https://")),
        campi: s.campi.map((c) => ({
          chiave: c.chiave,
          etichetta: c.etichetta,
          segreto: c.segreto,
          segnaposto: c.segnaposto ?? null,
          aiuto: c.aiuto ?? null,
          facoltativo: Boolean(c.facoltativo),
          impostato: Boolean(valori[c.chiave]),
          valore: c.segreto ? null : valori[c.chiave] ?? null,
        })),
        stato: conto?.status ?? "non_collegato",
        account: conto?.account_label ?? null,
        ultimo_controllo: conto?.last_checked_at ?? null,
        scadenza: conto?.expires_at ?? null,
        errore: conto?.last_error ?? null,
      }
    })
  }

  /** Salva i dati inseriti. Un campo segreto lasciato vuoto conserva il valore già salvato. */
  async salva(id: string, inseriti: Valori) {
    const servizio = servizioOErrore(id)
    const conto = await this.conto(id)
    const precedenti = conto ? this.leggiSegreti(conto.secret) : { valori: {} as Valori }
    const noti = new Set(servizio.campi.map((c) => c.chiave))
    const pulito: Valori = { ...precedenti.valori }
    for (const [k, v] of Object.entries(inseriti)) {
      if (noti.has(k) && typeof v === "string" && v.trim()) pulito[k] = v.trim()
    }
    const problema = valoriValidi(servizio, pulito)
    if (problema) throw new MedusaError(MedusaError.Types.INVALID_DATA, problema)

    const secret = this.scriviSegreti({ valori: pulito, token: precedenti.token })
    const dati = { secret, status: "da_collegare" as const, last_error: null }
    if (conto) await this.updateConnectorAccounts({ id: conto.id, ...dati })
    else await this.createConnectorAccounts({ provider: id, ...dati })
    return servizio.accesso === "chiave" ? this.verifica(id) : { ok: true as const }
  }

  /** Prova reale sul servizio e aggiornamento dello stato. */
  async verifica(id: string) {
    const servizio = servizioOErrore(id)
    const conto = await this.conto(id)
    if (!conto) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Service not set up yet")
    const { valori, token } = this.leggiSegreti(conto.secret)
    if (servizio.accesso === "login" && !token) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Sign in to the service first")
    }
    const esito = await eseguiProva(servizio, valori, token)
    await this.updateConnectorAccounts({
      id: conto.id,
      status: esito.ok ? "collegato" : "errore",
      account_label: esito.ok ? esito.account ?? conto.account_label : conto.account_label,
      last_error: esito.ok ? null : esito.errore,
      last_checked_at: new Date(),
    })
    return esito
  }

  async scollega(id: string) {
    servizioOErrore(id)
    const conto = await this.conto(id)
    if (conto) await this.deleteConnectorAccounts(conto.id)
  }

  /** Prepara il login: restituisce l'indirizzo del servizio a cui mandare l'utente. */
  async avviaLogin(id: string) {
    const servizio = servizioOErrore(id)
    if (servizio.accesso !== "login") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This service uses an API key")
    const ritorno = indirizzoRitorno()
    if (servizio.oauth?.richiedeHttps && !ritorno.startsWith("https://")) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `${servizio.nome} requires a public HTTPS address`)
    }
    const conto = await this.conto(id)
    if (!conto) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Enter the application details first")
    const { valori } = this.leggiSegreti(conto.secret)

    const scaduti = await this.listOauthStates({ expires_at: { $lt: new Date() } })
    if (scaduti.length) await this.deleteOauthStates(scaduti.map((s) => s.id))

    const stato = creaStato()
    const { verifier, challenge } = creaPkce()
    await this.createOauthStates({
      provider: id,
      state_hash: improntaStato(stato),
      verifier: cifra(verifier, chiave()),
      expires_at: new Date(Date.now() + DURATA_LOGIN_MS),
    })
    return urlAutorizzazione(servizio, { clientId: valori.client_id, redirectUri: ritorno, state: stato, challenge })
  }

  /** Conclude il login. Lo stato vale una sola volta e scade dopo pochi minuti. */
  async completaLogin(stato: string, codice: string) {
    const [salvato] = await this.listOauthStates({ state_hash: improntaStato(stato) })
    if (!salvato) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Sign-in not valid or already used")
    await this.deleteOauthStates(salvato.id)
    if (new Date(salvato.expires_at).getTime() < Date.now()) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Sign-in expired: try again")
    }
    const servizio = servizioOErrore(salvato.provider)
    const conto = await this.conto(salvato.provider)
    if (!conto) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Connection removed during sign-in")
    const { valori } = this.leggiSegreti(conto.secret)
    const token = await scambiaCodice(servizio, {
      clientId: valori.client_id,
      clientSecret: valori.client_secret,
      code: codice,
      redirectUri: indirizzoRitorno(),
      verifier: decifra(salvato.verifier, chiave()),
    })
    await this.updateConnectorAccounts({
      id: conto.id,
      secret: this.scriviSegreti({ valori, token }),
      expires_at: token.expires_at ? new Date(token.expires_at) : null,
    })
    await this.verifica(salvato.provider)
    return servizio
  }

  /** Rinnova i token in scadenza; se non riesce segnala l'errore nella pagina Connettori. */
  async rinnovaScadenze() {
    const limite = new Date(Date.now() + MARGINE_RINNOVO_MS)
    const conti = await this.listConnectorAccounts({ status: "collegato", expires_at: { $lt: limite } })
    let rinnovati = 0
    for (const conto of conti) {
      const servizio = trovaServizio(conto.provider)
      if (!servizio?.oauth) continue
      const { valori, token } = this.leggiSegreti(conto.secret)
      if (!token) continue
      try {
        const nuovo = await rinnovaToken(servizio, valori.client_id, valori.client_secret, token)
        await this.updateConnectorAccounts({
          id: conto.id,
          secret: this.scriviSegreti({ valori, token: nuovo }),
          expires_at: nuovo.expires_at ? new Date(nuovo.expires_at) : null,
          last_error: null,
        })
        rinnovati += 1
      } catch {
        await this.updateConnectorAccounts({ id: conto.id, status: "errore", last_error: "Renewal failed: sign in again" })
      }
    }
    return rinnovati
  }
}
