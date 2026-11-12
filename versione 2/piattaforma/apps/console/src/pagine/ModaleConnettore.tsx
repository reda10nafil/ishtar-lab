import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Copy, ExternalLink, LogIn } from "lucide-react"
import { useState, type FormEvent } from "react"
import { api } from "../api/client"
import type { Connettore, EsitoProva } from "../api/tipi"
import { Campo, dataOra, Etichetta, Modale } from "../ui"

const STATI = {
  non_collegato: { testo: "Not connected", tono: "neutro" },
  da_collegare: { testo: "To finish", tono: "attesa" },
  collegato: { testo: "Connected", tono: "ok" },
  errore: { testo: "Needs fixing", tono: "errore" },
} as const

export default function ModaleConnettore({ connettore, onChiudi }: { connettore: Connettore; onChiudi: () => void }) {
  const client = useQueryClient()
  const [valori, setValori] = useState<Record<string, string>>(() =>
    Object.fromEntries(connettore.campi.map((c) => [c.chiave, c.valore ?? ""]))
  )
  const [esito, setEsito] = useState<EsitoProva | null>(null)
  const aggiorna = () => client.invalidateQueries({ queryKey: ["connettori"] })
  const id = encodeURIComponent(connettore.id)
  const login = connettore.accesso === "login"
  const stato = STATI[connettore.stato]

  const salva = useMutation({
    mutationFn: () => api<{ esito: EsitoProva }>(`/admin/connectors/${id}`, { corpo: { valori } }),
    onSuccess: (r) => {
      setEsito(login ? null : r.esito)
      setValori((v) => Object.fromEntries(connettore.campi.map((c) => [c.chiave, c.segreto ? "" : v[c.chiave]])))
      void aggiorna()
    },
  })
  const prova = useMutation({
    mutationFn: () => api<{ esito: EsitoProva }>(`/admin/connectors/${id}/test`, { metodo: "POST" }),
    onSuccess: (r) => {
      setEsito(r.esito)
      void aggiorna()
    },
  })
  const accedi = useMutation({
    mutationFn: () => api<{ indirizzo: string }>(`/admin/connectors/${id}/login`, { metodo: "POST" }),
    onSuccess: (r) => {
      window.location.href = r.indirizzo
    },
  })
  const scollega = useMutation({
    mutationFn: () => api(`/admin/connectors/${id}`, { metodo: "DELETE" }),
    onSuccess: () => {
      void aggiorna()
      onChiudi()
    },
  })

  const errore = salva.error ?? prova.error ?? accedi.error ?? scollega.error
  const inAttesa = salva.isPending || prova.isPending || accedi.isPending || scollega.isPending
  const salvato = connettore.stato !== "non_collegato"
  const invia = (e: FormEvent) => {
    e.preventDefault()
    setEsito(null)
    salva.mutate()
  }

  return (
    <Modale titolo={connettore.nome} sottotitolo={connettore.descrizione} onChiudi={onChiudi}>
      <div className="connettore-stato">
        <Etichetta tono={stato.tono}>{stato.testo}</Etichetta>
        {connettore.account ? <span>Account: <strong>{connettore.account}</strong></span> : null}
        {connettore.ultimo_controllo ? <span>Last checked: {dataOra(connettore.ultimo_controllo)}</span> : null}
        {connettore.scadenza ? <span>Access expires: {dataOra(connettore.scadenza)}</span> : null}
      </div>

      {connettore.errore ? <p className="avviso-stato avviso-stato--errore" role="alert">{connettore.errore}</p> : null}
      {connettore.richiede_dominio ? (
        <p className="avviso-stato avviso-stato--attesa">This service only accepts a public HTTPS address: signing in will be available once the app is online.</p>
      ) : null}
      {connettore.fase === "vendite" ? <p className="avviso-stato">It will be used once sales are switched on. You can save the details now.</p> : null}
      {!connettore.confermato ? <p className="avviso-stato">To be checked on the first connection with a real account.</p> : null}

      <form className="modulo" onSubmit={invia}>
        {connettore.campi.map((c) => (
          <Campo key={c.chiave} etichetta={c.etichetta} aiuto={c.aiuto}>
            <input
              type={c.segreto ? "password" : "text"}
              autoComplete="off"
              spellCheck={false}
              required={!c.facoltativo && !c.impostato}
              placeholder={c.segreto && c.impostato ? "Saved: leave empty to keep it" : c.segnaposto ?? undefined}
              value={valori[c.chiave] ?? ""}
              onChange={(e) => setValori({ ...valori, [c.chiave]: e.target.value })}
            />
          </Campo>
        ))}

        {connettore.indirizzo_ritorno ? (
          <div className="campo">
            <span>Redirect address to register with the service</span>
            <div className="copia">
              <code>{connettore.indirizzo_ritorno}</code>
              <button type="button" className="icona-pulsante" aria-label="Copy address" onClick={() => void navigator.clipboard.writeText(connettore.indirizzo_ritorno!)}>
                <Copy size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}

        <button type="submit" className={login && salvato ? "" : "primario"} disabled={inAttesa}>
          {salva.isPending ? "Saving..." : login ? "Save app details" : "Save and test"}
        </button>
      </form>

      {login ? (
        <button type="button" className="primario larga" disabled={inAttesa || !salvato || connettore.richiede_dominio} onClick={() => accedi.mutate()}>
          <LogIn size={17} aria-hidden="true" /> Sign in to {connettore.nome}
        </button>
      ) : null}

      {esito ? (
        <p className={`avviso-stato ${esito.ok ? "avviso-stato--ok" : "avviso-stato--errore"}`} role="status">
          {esito.ok ? `Connection successful${esito.account ? `: ${esito.account}` : ""}.` : esito.errore}
        </p>
      ) : null}
      {errore ? <p className="avviso-stato avviso-stato--errore" role="alert">{errore.message}</p> : null}

      <div className="modale__piede">
        <a href={connettore.documentazione} target="_blank" rel="noreferrer">Guide <ExternalLink size={13} aria-hidden="true" /></a>
        {connettore.iscrizione ? <a href={connettore.iscrizione} target="_blank" rel="noreferrer">Create account <ExternalLink size={13} aria-hidden="true" /></a> : null}
        <span className="spazio" />
        {connettore.stato === "collegato" || connettore.stato === "errore" ? (
          <button type="button" disabled={inAttesa} onClick={() => prova.mutate()}>Test</button>
        ) : null}
        {salvato ? <button type="button" className="pericolo" disabled={inAttesa} onClick={() => scollega.mutate()}>Disconnect</button> : null}
      </div>
    </Modale>
  )
}
