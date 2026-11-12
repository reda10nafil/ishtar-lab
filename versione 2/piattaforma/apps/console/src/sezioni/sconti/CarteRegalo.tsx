import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Gift } from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react"
import { useSearchParams } from "react-router-dom"
import { api, ErroreApi } from "../../api/client"
import { Interruttore, Paginazione, Vuoto, useAvvisi } from "../../componenti"
import { Cifra } from "../../movimenti"
import { usePermessi } from "../../permessi"
import { Campo, Modale, Stato, euro } from "../../ui"
import { Guscio } from "./Guscio"
import { ModaleCarta } from "./ModaleCarta"
import { entraCarte, riempiBarre } from "./movimenti"
import { STATI_CARTA, conteggioDi, fineGiorno, giornoMese, importoTondo, numeroDa } from "./testi"
import type { Carta, Cliente, ElencoCarte } from "./tipi"

const PER_PAGINA = 60
const IMPORTI = [25, 50, 75, 100, 150]
const NESSUNO = ""
const ALTRO = "altro"

function NuovaCarta({ onChiudi }: { onChiudi: () => void }) {
  const client = useQueryClient()
  const { avvisa } = useAvvisi()
  const [importo, setImporto] = useState<number | "altro">(50)
  const [libero, setLibero] = useState("")
  const [per, setPer] = useState(NESSUNO)
  const [dati, setDati] = useState({ scadenza: "", nome: "", email: "" })
  const primaCifra = useRef<HTMLButtonElement>(null)

  // Gira dopo l'effetto di Modale, che darebbe il fuoco alla tendina.
  useEffect(() => primaCifra.current?.focus({ preventScroll: true }), [])

  const aggiorna = (chiave: keyof typeof dati) => (e: { target: { value: string } }) => setDati({ ...dati, [chiave]: e.target.value })

  const clienti = useQuery({ queryKey: ["sconti", "clienti"], queryFn: () => api<{ clienti: Cliente[] }>("/admin/carte-regalo/clienti"), retry: false })
  const scelto = clienti.data?.clienti.find((c) => c.id === per)
  const valore = importo === "altro" ? numeroDa(libero) : importo

  const emetti = useMutation({
    mutationFn: () =>
      api<{ carta: Carta }>("/admin/carte-regalo", {
        corpo: {
          importo: valore,
          scadenza: fineGiorno(dati.scadenza),
          destinatario_nome: (scelto?.nome ?? dati.nome) || null,
          destinatario_email: (scelto?.email ?? dati.email) || null,
        },
      }),
    onSuccess: ({ carta }) => {
      void client.invalidateQueries({ queryKey: ["sconti"] })
      avvisa(`${euro(carta.importo_iniziale)} gift card ••${carta.codice.slice(-4)} issued`)
      onChiudi()
    },
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    emetti.mutate()
  }

  return (
    <Modale titolo="Issue a gift card" sottotitolo="The code is generated for you. Nothing is sent from here: you hand it over." onChiudi={onChiudi}>
      <form className="modulo sc-modulo" onSubmit={invia}>
        <div className="campo">
          <span id="sc-importo">Amount</span>
          <div className="sc-importi" role="group" aria-labelledby="sc-importo">
            {IMPORTI.map((voce, posto) => (
              <button key={voce} ref={posto === 0 ? primaCifra : undefined} type="button" className={importo === voce ? "attivo" : undefined} aria-pressed={importo === voce} onClick={() => setImporto(voce)}>{importoTondo(voce)}</button>
            ))}
            <button type="button" className={importo === "altro" ? "attivo" : undefined} aria-pressed={importo === "altro"} onClick={() => setImporto("altro")}>Other</button>
          </div>
        </div>
        {importo === "altro" ? (
          <Campo etichetta="Other amount"><input type="number" required min="0.01" step="0.01" inputMode="decimal" value={libero} onChange={(e) => setLibero(e.target.value)} /></Campo>
        ) : null}
        <Campo etichetta="For">
          <select value={per} onChange={(e) => setPer(e.target.value)}>
            <option value={NESSUNO}>Nobody yet</option>
            {clienti.data?.clienti.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            <option value={ALTRO}>Someone else</option>
          </select>
        </Campo>
        {per === ALTRO ? (
          <div className="griglia-due sc-griglia">
            <Campo etichetta="Name"><input maxLength={120} value={dati.nome} onChange={aggiorna("nome")} /></Campo>
            <Campo etichetta="Email (optional)"><input type="email" value={dati.email} onChange={aggiorna("email")} /></Campo>
          </div>
        ) : null}
        <Campo etichetta="Expires (optional)"><input type="date" value={dati.scadenza} onChange={aggiorna("scadenza")} /></Campo>
        {clienti.error instanceof ErroreApi && clienti.error.stato === 403 ? <p className="sc-spiega">Your role can't list customers: choose Someone else to name the recipient.</p> : null}
        {emetti.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{emetti.error.message}</p> : null}
        <div className="sc-piede">
          <span className="spazio" />
          <button type="button" onClick={onChiudi}>Cancel</button>
          <button className="primario" type="submit" disabled={emetti.isPending || !valore}>
            <Gift size={16} aria-hidden="true" /> {emetti.isPending ? "Issuing..." : `Issue ${valore ? importoTondo(valore) : ""}`.trim()}
          </button>
        </div>
      </form>
    </Modale>
  )
}

const inizialiDi = (nome: string) => nome.trim().split(/\s+/).slice(0, 2).map((parola) => parola[0]?.toUpperCase()).join("")

function CartaInGriglia({ carta, posto, scrive, onApri, onCongela }: { carta: Carta; posto: number; scrive: boolean; onApri: () => void; onCongela: (congelata: boolean) => void }) {
  const stato = STATI_CARTA[carta.stato]
  const quota = carta.importo_iniziale ? Math.min(100, (carta.saldo / carta.importo_iniziale) * 100) : 0
  const destinatario = carta.destinatario_nome ?? carta.destinatario_email
  const spenta = carta.stato === "congelata" || carta.stato === "annullata" || carta.stato === "scaduta"
  return (
    <article className={`sc-carta sc-carta--tinta${(posto % 3) + 1}${spenta ? " sc-carta--spenta" : ""}`}>
      <button type="button" className="sc-carta__apri" aria-label={`Open gift card ${carta.codice.slice(-4)}`} onClick={onApri} />
      <div className="sc-carta__testa">
        <span className="sc-carta__segno" aria-hidden="true">IL</span>
        <span className="sc-carta__marchio"><strong>Ishtar Lab</strong><small>Gift card</small></span>
        <strong className="sc-carta__saldo">{euro(carta.saldo)}</strong>
      </div>
      <div className="sc-carta__codice">···· ···· {carta.codice.slice(-4)}</div>
      <span className="sc-carta__misura"><i style={{ width: `${quota}%` }} /></span>
      <div className="sc-carta__riga">
        <span className="sc-carta__persona">
          {destinatario ? <span className="sc-carta__sigla" aria-hidden="true">{inizialiDi(destinatario)}</span> : null}
          <small>{destinatario ?? "Unassigned"}</small>
        </span>
        <small>of {euro(carta.importo_iniziale)} · {giornoMese(carta.creata_il)}</small>
      </div>
      <div className="sc-carta__azioni">
        <Interruttore acceso={carta.stato !== "congelata" && carta.stato !== "annullata"} etichetta={`Gift card ${carta.codice.slice(-4)} active`} disattivo={!scrive || carta.stato === "annullata"} onCambia={(attiva) => onCongela(!attiva)} />
        <span>{stato.testo}</span>
      </div>
    </article>
  )
}

export default function CarteRegalo() {
  const client = useQueryClient()
  const { avvisa, segnalaErrore } = useAvvisi()
  const { puo } = usePermessi()
  const [parametri, setParametri] = useSearchParams()
  const [pagina, setPagina] = useState(1)
  const [aperta, setAperta] = useState<string | null>(null)
  const griglia = useRef<HTMLDivElement>(null)
  const entrata = useRef(false)
  const emette = puo("sconti", "edit")
  const nuova = parametri.get("nuovo") === "1" && emette

  const query = useQuery({
    queryKey: ["sconti", "carte", pagina],
    queryFn: () => api<ElencoCarte>(`/admin/carte-regalo?limit=${PER_PAGINA}&offset=${(pagina - 1) * PER_PAGINA}`),
    placeholderData: keepPreviousData,
  })
  const carte = query.data?.carte ?? []
  const conteggi = query.data?.conteggi

  useLayoutEffect(() => {
    if (entrata.current || !griglia.current || !carte.length) return
    entrata.current = true
    entraCarte(griglia.current.querySelectorAll(".sc-carta"))
    riempiBarre(griglia.current.querySelectorAll(".sc-carta__misura i"), 260)
  }, [carte.length])

  const congela = useMutation({
    mutationFn: ({ carta, congelata }: { carta: Carta; congelata: boolean }) => api(`/admin/carte-regalo/${carta.id}/blocco`, { corpo: { congelata } }),
    onSuccess: (_, { carta, congelata }) => {
      void client.invalidateQueries({ queryKey: ["sconti"] })
      avvisa(`••${carta.codice.slice(-4)} ${congelata ? "frozen" : "re-activated"}`)
    },
    onError: segnalaErrore,
  })

  const chiudiNuova = () => {
    parametri.delete("nuovo")
    setParametri(parametri, { replace: true })
  }
  const creaAzione = <button type="button" className="primario" onClick={() => setParametri({ nuovo: "1" })}><Gift size={17} aria-hidden="true" /> Issue gift card</button>

  return (
    <Guscio sottotitolo="What each gift card still holds." azioni={emette ? creaAzione : undefined}>
      <p className="sc-fascia vetro" role="note" data-fermo>
        <Gift size={18} aria-hidden="true" />
        <span>
          <strong><Cifra valore={query.data?.saldo_attivo ?? 0} formato={euro} /></strong> unspent across {conteggioDi(conteggi?.attiva ?? 0, "active card")}. Gift cards can't be redeemed at checkout yet: the shop doesn't accept them, so balances change only from here.
        </span>
      </p>

      <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
      {query.isSuccess && !carte.length ? (
        <Vuoto icona={Gift} titolo="No gift cards issued" testo="Once you issue one, its code, balance, expiry date and activity show up here." azione={emette ? creaAzione : undefined} />
      ) : null}
      {carte.length ? (
        <div className="sc-griglia-carte" ref={griglia}>
          {carte.map((c, posto) => (
            <CartaInGriglia key={c.id} carta={c} posto={posto} scrive={emette} onApri={() => setAperta(c.id)} onCongela={(congelata) => congela.mutate({ carta: c, congelata })} />
          ))}
        </div>
      ) : null}
      <Paginazione pagina={pagina} perPagina={PER_PAGINA} totale={query.data?.conteggio ?? 0} onCambia={setPagina} />

      {nuova ? <NuovaCarta onChiudi={chiudiNuova} /> : null}
      {aperta ? <ModaleCarta id={aperta} onChiudi={() => setAperta(null)} /> : null}
    </Guscio>
  )
}
