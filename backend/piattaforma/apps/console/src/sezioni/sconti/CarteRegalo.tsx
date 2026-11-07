import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Gift } from "lucide-react"
import { useState, type FormEvent } from "react"
import { useSearchParams } from "react-router-dom"
import { api } from "../../api/client"
import { CampoRicerca, Paginazione, Vuoto, useAvvisi } from "../../componenti"
import { numero } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Campo, Etichetta, Modale, Stato, dataBreve, euro } from "../../ui"
import { Guscio } from "./Guscio"
import { ModaleCarta } from "./ModaleCarta"
import { STATI_CARTA, conteggioDi, fineGiorno, numeroDa } from "./testi"
import type { Carta, ElencoCarte, StatoCarta } from "./tipi"
import { useRitardato } from "./useRitardato"

const PER_PAGINA = 18

const FILTRI: { id: "" | StatoCarta; testo: string }[] = [
  { id: "", testo: "All" },
  { id: "attiva", testo: "Active" },
  { id: "esaurita", testo: "Used up" },
  { id: "scaduta", testo: "Expired" },
  { id: "annullata", testo: "Cancelled" },
]

function NuovaCarta({ onChiudi, onCreata }: { onChiudi: () => void; onCreata: (id: string) => void }) {
  const client = useQueryClient()
  const { avvisa } = useAvvisi()
  const [dati, setDati] = useState({ importo: "", scadenza: "", nome: "", email: "", nota: "" })
  const aggiorna = (chiave: keyof typeof dati) => (e: { target: { value: string } }) => setDati({ ...dati, [chiave]: e.target.value })

  const emetti = useMutation({
    mutationFn: () =>
      api<{ carta: Carta }>("/admin/carte-regalo", {
        corpo: {
          importo: numeroDa(dati.importo),
          scadenza: fineGiorno(dati.scadenza),
          destinatario_nome: dati.nome || null,
          destinatario_email: dati.email || null,
          nota: dati.nota || null,
        },
      }),
    onSuccess: ({ carta }) => {
      void client.invalidateQueries({ queryKey: ["sconti"] })
      avvisa("Gift card issued")
      onCreata(carta.id)
    },
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    emetti.mutate()
  }

  return (
    <Modale titolo="Issue a gift card" sottotitolo="The code is generated for you. No email goes out from here: you hand it over yourself." onChiudi={onChiudi}>
      <form className="modulo" onSubmit={invia}>
        <div className="griglia-due sc-griglia">
          <Campo etichetta="Amount"><input type="number" required min="0.01" step="0.01" inputMode="decimal" value={dati.importo} onChange={aggiorna("importo")} /></Campo>
          <Campo etichetta="Expires (optional)"><input type="date" value={dati.scadenza} onChange={aggiorna("scadenza")} /></Campo>
        </div>
        <div className="griglia-due sc-griglia">
          <Campo etichetta="Recipient (optional)"><input maxLength={120} value={dati.nome} onChange={aggiorna("nome")} /></Campo>
          <Campo etichetta="Recipient email (optional)"><input type="email" value={dati.email} onChange={aggiorna("email")} /></Campo>
        </div>
        <Campo etichetta="Internal note (optional)"><input maxLength={500} value={dati.nota} onChange={aggiorna("nota")} /></Campo>
        {emetti.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{emetti.error.message}</p> : null}
        <div className="riga__azioni sc-piede">
          <button type="button" onClick={onChiudi}>Cancel</button>
          <button className="primario" type="submit" disabled={emetti.isPending}>{emetti.isPending ? "Issuing..." : "Issue card"}</button>
        </div>
      </form>
    </Modale>
  )
}

function CartaInGriglia({ carta, onApri }: { carta: Carta; onApri: () => void }) {
  const stato = STATI_CARTA[carta.stato]
  const quota = carta.importo_iniziale ? Math.min(100, (carta.saldo / carta.importo_iniziale) * 100) : 0
  return (
    <button type="button" className={`sc-carta sc-carta--${carta.stato}`} aria-label={`Open gift card ending ${carta.codice.slice(-4)}`} onClick={onApri}>
      <span className="sc-carta__testa">
        <span className="marchio__segno" aria-hidden="true">IL</span>
        <span className="sc-carta__marchio"><strong>Ishtar Lab</strong><small>Gift card</small></span>
        <strong className="sc-carta__saldo">{euro(carta.saldo)}</strong>
      </span>
      <span className="sc-carta__codice">···· ···· ···· {carta.codice.slice(-4)}</span>
      <span className="sc-barra-uso"><i style={{ width: `${quota}%` }} /></span>
      <span className="sc-carta__riga">
        <span>{carta.destinatario_nome ?? carta.destinatario_email ?? "Unassigned"}</span>
        <small>of {euro(carta.importo_iniziale)} · {dataBreve(carta.creata_il)}</small>
      </span>
      <span className="sc-carta__piede">
        <Etichetta tono={stato.tono}>{stato.testo}</Etichetta>
        <small>{carta.scadenza ? `Expires ${dataBreve(carta.scadenza)}` : "Never expires"}</small>
      </span>
    </button>
  )
}

export default function CarteRegalo() {
  const { puo } = usePermessi()
  const [parametri, setParametri] = useSearchParams()
  const [testo, setTesto] = useState("")
  const ricerca = useRitardato(testo)
  const [stato, setStato] = useState<"" | StatoCarta>("")
  const [pagina, setPagina] = useState(1)
  const [aperta, setAperta] = useState<string | null>(null)
  const emette = puo("sconti", "edit")
  const nuova = parametri.get("nuovo") === "1" && emette

  const filtri = new URLSearchParams({ limit: String(PER_PAGINA), offset: String((pagina - 1) * PER_PAGINA) })
  if (ricerca) filtri.set("q", ricerca)
  if (stato) filtri.set("stato", stato)

  const query = useQuery({
    queryKey: ["sconti", "carte", filtri.toString()],
    queryFn: () => api<ElencoCarte>(`/admin/carte-regalo?${filtri.toString()}`),
    placeholderData: keepPreviousData,
  })
  const carte = query.data?.carte ?? []
  const conteggi = query.data?.conteggi
  const chiudiNuova = () => {
    parametri.delete("nuovo")
    setParametri(parametri, { replace: true })
  }
  const creaAzione = <button type="button" className="primario" onClick={() => setParametri({ nuovo: "1" })}><Gift size={17} aria-hidden="true" /> Issue gift card</button>
  const senzaFiltri = !ricerca && !stato

  return (
    <Guscio sottotitolo="What each gift card still holds." azioni={emette ? creaAzione : undefined}>
      <p className="avviso-stato avviso-stato--attesa" role="note">
        Gift cards can't be redeemed at checkout yet: the shop doesn't accept them. For now you can issue them, follow their balance and record changes by hand.
      </p>

      {conteggi?.tutte ? (
        <p className="sc-fascia vetro">
          <Gift size={18} aria-hidden="true" />
          <span><strong>{euro(query.data?.saldo_attivo)}</strong> unspent across {conteggioDi(conteggi.attiva, "active card")}.</span>
        </p>
      ) : null}

      <div className="barra-strumenti sc-barra">
        <CampoRicerca valore={testo} etichetta="Search by code or recipient" onCambia={(valore) => { setTesto(valore); setPagina(1) }} />
        <span className="spazio" />
        <div className="selettore" role="group" aria-label="Filter by status">
          {FILTRI.map((f) => (
            <button key={f.id} type="button" className={stato === f.id ? "attivo" : undefined} aria-pressed={stato === f.id} onClick={() => { setStato(f.id); setPagina(1) }}>
              {f.testo}{conteggi ? <em>{numero(f.id ? conteggi[f.id] : conteggi.tutte)}</em> : null}
            </button>
          ))}
        </div>
      </div>

      <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
      {query.isSuccess && !carte.length ? (
        senzaFiltri ? (
          <Vuoto icona={Gift} titolo="No gift cards issued" testo="Once you issue one, its code, balance, expiry date and activity show up here." azione={emette ? creaAzione : undefined} />
        ) : (
          <Vuoto icona={Gift} titolo="No gift cards match these filters" testo="Change your search or pick another status." />
        )
      ) : null}
      {carte.length ? (
        <div className="sc-griglia-carte">
          {carte.map((c) => <CartaInGriglia key={c.id} carta={c} onApri={() => setAperta(c.id)} />)}
        </div>
      ) : null}
      <Paginazione pagina={pagina} perPagina={PER_PAGINA} totale={query.data?.conteggio ?? 0} onCambia={setPagina} />

      {nuova ? <NuovaCarta onChiudi={chiudiNuova} onCreata={(id) => { chiudiNuova(); setAperta(id) }} /> : null}
      {aperta ? <ModaleCarta id={aperta} onChiudi={() => setAperta(null)} /> : null}
    </Guscio>
  )
}
