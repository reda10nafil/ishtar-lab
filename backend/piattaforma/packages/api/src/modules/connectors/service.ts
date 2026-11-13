import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import { ConnectorAccount } from "./models/connector-account"
import { OauthState } from "./models/oauth-state"
import { catalogoAttivo, trovaServizio, valoriValidi, type Servizio, type Token, type Valori } from "./catalogo"
import { cifra, controllaChiave, decifra } from "./crypto"
import { eseguiProva } from "./prova"
import { creaPkce, creaStato, improntaStato, rinnovaToken, scambiaCodice, urlAutorizzazione } from "./oauth"

type Segreti = { valori: Valori; token?: Token }

const DURATA_LOGIN_MS = 10 * 60 * 1000
const CREDENZIALI_ILLEGGIBILI = "Saved credentials can't be read (the encryption key changed or the data is damaged): enter them again"
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

  /**
   * Credenziali che non si decifrano più (chiave cambiata, dato danneggiato): null invece di un errore che fermerebbe
   * l'intero elenco. Una chiave mancante o scritta male resta un errore immediato: «scollega» cancellerebbe dati che
   * con la chiave giusta si leggono ancora.
   */
  private leggiSegretiSicuri(cifrato: string): Segreti | null {
    controllaChiave(chiave())
    try {
      return this.leggiSegreti(cifrato)
    } catch {
      return null
    }
  }

  /** Come leggiSegreti, ma con un messaggio chiaro quando le credenziali salvate non si leggono più. */
  private leggiSegretiOErrore(cifrato: string): Segreti {
    const segreti = this.leggiSegretiSicuri(cifrato)
    if (!segreti) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, CREDENZIALI_ILLEGGIBILI)
    return segreti
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
      const letti = conto ? this.leggiSegretiSicuri(conto.secret) : null
      const illeggibile = Boolean(conto) && !letti
      const valori = letti?.valori ?? {}
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
        stato: illeggibile ? "errore" : conto?.status ?? "non_collegato",
        account: conto?.account_label ?? null,
        ultimo_controllo: conto?.last_checked_at ?? null,
        scadenza: conto?.expires_at ?? null,
        errore: illeggibile ? CREDENZIALI_ILLEGGIBILI : conto?.last_error ?? null,
      }
    })
  }

  /** Salva i dati inseriti. Un campo segreto lasciato vuoto conserva il valore già salvato. */
  async salva(id: string, inseriti: Valori) {
    const servizio = servizioOErrore(id)
    const conto = await this.conto(id)
    // Credenziali illeggibili: si riparte dai valori inseriti ora (per i servizi con login serve un nuovo accesso).
    const precedenti = (conto ? this.leggiSegretiSicuri(conto.secret) : null) ?? { valori: {} as Valori }
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
    const { valori, token } = this.leggiSegretiOErrore(conto.secret)
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

  /**
   * Credenziali di un servizio collegato, per i canali della casella dei clienti (lettura dei messaggi e invio delle
   * risposte). Solo lato server: nessuna rotta le restituisce. Null se il servizio non è collegato, è in errore (fino a
   * una nuova prova dalla console) o le credenziali non si leggono più.
   */
  async credenzialiCollegate(id: string): Promise<{ valori: Valori; token?: Token; account: string | null } | null> {
    servizioOErrore(id)
    const conto = await this.conto(id)
    if (!conto || conto.status !== "collegato") return null
    const segreti = this.leggiSegretiSicuri(conto.secret)
    return segreti ? { valori: segreti.valori, token: segreti.token, account: conto.account_label ?? null } : null
  }

  /** Un canale che ha trovato il servizio inutilizzabile (token rifiutato, webhook di un altro sistema): si vede nella console. */
  async segnaErrore(id: string, messaggio: string) {
    servizioOErrore(id)
    const conto = await this.conto(id)
    if (conto) await this.updateConnectorAccounts({ id: conto.id, status: "errore", last_error: messaggio, last_checked_at: new Date() })
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
    const { valori } = this.leggiSegretiOErrore(conto.secret)

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
    const { valori } = this.leggiSegretiOErrore(conto.secret)
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
      // Una credenziale illeggibile non deve fermare il rinnovo degli altri connettori: si segnala e si prosegue.
      const segreti = this.leggiSegretiSicuri(conto.secret)
      if (!segreti) {
        await this.updateConnectorAccounts({ id: conto.id, status: "errore", last_error: CREDENZIALI_ILLEGGIBILI })
        continue
      }
      const { valori, token } = segreti
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
