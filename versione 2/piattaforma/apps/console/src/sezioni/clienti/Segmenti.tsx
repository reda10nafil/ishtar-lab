import { useMutation, useQuery } from "@tanstack/react-query"
import { Heart, Hourglass, Mail, MapPin, Send, Sparkles, Star, UsersRound, type LucideIcon } from "lucide-react"
import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { api } from "../../api/client"
import { Riquadro, Tabella, Vuoto, useAvvisi, type Colonna } from "../../componenti"
import { Cifra } from "../../movimenti"
import { numero, percentuale } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Campo, Conferma, Modale, Stato, euro } from "../../ui"
import "../marketing/marketing.css"
import ModuloCampagna from "../marketing/ModuloCampagna"
import { iniziali, regolaSegmento, tonoIniziali, useAggiornaClienti } from "./dati"
import type { DatiSegmenti } from "./tipi"

type RigaGruppo = DatiSegmenti["gruppi"][number]
type Carta = DatiSegmenti["segmenti"][number]

const ASPETTO: Record<string, { icona: LucideIcon; tono: string }> = {
  abituali: { icona: Heart, tono: "accento" },
  grandi: { icona: Star, tono: "blu" },
  nuovi: { icona: Sparkles, tono: "attesa" },
  newsletter: { icona: Mail, tono: "accento-2" },
  locali: { icona: MapPin, tono: "accento" },
  inattivi: { icona: Hourglass, tono: "testo-3" },
}

/** Ogni carta porta all'elenco già ristretto a quel gruppo di persone. */
const destinazione = (chiave: string, casa: string | null) => {
  if (chiave === "newsletter") return "/clienti/persone?filtro=newsletter"
  if (chiave === "locali") return casa ? `/clienti/persone?citta=${encodeURIComponent(casa)}` : "/clienti/persone"
  return `/clienti/persone?segmento=${chiave}`
}

function CartaSegmento({ carta, dati, massimo, onInvia }: { carta: Carta; dati: DatiSegmenti; massimo: number; onInvia?: () => void }) {
  const { icona: Icona, tono } = ASPETTO[carta.chiave] ?? ASPETTO.abituali
  const a = destinazione(carta.chiave, dati.casa)
  return (
    <article className={`cli-segmento vetro cli-segmento--${tono}`}>
      <div className="cli-segmento__testa">
        <span className="cli-segmento__icona"><Icona size={18} aria-hidden="true" /></span>
        <span>
          <Link to={a}>{carta.nome}</Link>
          <small>{regolaSegmento(carta.chiave, dati.regole, dati.casa)}</small>
        </span>
      </div>
      <div className="cli-segmento__numero">
        <strong><Cifra valore={carta.conteggio} formato={numero} /></strong>
        <small>{percentuale(dati.totale ? carta.conteggio / dati.totale : 0)} of customers</small>
      </div>
      <span className="cli-segmento__barra" aria-hidden="true"><i style={{ transform: `scaleX(${carta.conteggio / massimo})` }} /></span>
      <div className="cli-segmento__piede">
        {carta.anteprima.length ? (
          <span className="cli-pila" aria-hidden="true">
            {carta.anteprima.map((c) => <span key={c.id} className={`cli-iniziali cli-iniziali--${tonoIniziali(c.id)}`}>{iniziali(c)}</span>)}
          </span>
        ) : null}
        <small>{carta.media === null ? "No spend yet" : `avg ${euro(carta.media)}`}</small>
        <span className="spazio" />
        {onInvia ? (
          <button type="button" className="cli-piccolo" onClick={onInvia}>
            <Send size={16} aria-hidden="true" /> Send
          </button>
        ) : null}
      </div>
    </article>
  )
}

const PASSI = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]

/** Scala dell'asse: sempre quattro intervalli, con un passo tondo. */
function scala(massimo: number) {
  const passo = PASSI.find((p) => p * 4 >= massimo) ?? Math.ceil(massimo / 4)
  return { passo, cima: passo * 4 }
}

function GraficoCitta({ citta }: { citta: DatiSegmenti["citta"] }) {
  const voci = citta.slice(0, 8)
  const { passo, cima } = scala(Math.max(1, ...voci.map((c) => c.conteggio)))
  return (
    <div className="cli-grafico">
      <div className="cli-grafico__assi" aria-hidden="true">
        {[4, 3, 2, 1, 0].map((n) => <span key={n}><small>{numero(n * passo)}</small><i /></span>)}
      </div>
      <ul className="cli-grafico__colonne">
        {voci.map((c, i) => (
          <li key={c.nome} className={i === 0 ? "cli-grafico__prima" : undefined} style={{ animationDelay: `${i * 50}ms` }}>
            <span className="cli-grafico__spazio">
              <i style={{ height: `${(c.conteggio / cima) * 100}%` }} title={`${c.nome}: ${numero(c.conteggio)}`} />
            </span>
            <Link to={`/clienti/persone?citta=${encodeURIComponent(c.nome)}`}>{c.nome}</Link>
          </li>
        ))}
      </ul>
      {voci.length ? null : <p className="cli-grafico__vuoto">No customer has a town yet.</p>}
    </div>
  )
}

function ModuloGruppo({ gruppo, onChiudi }: { gruppo?: RigaGruppo; onChiudi: () => void }) {
  const aggiorna = useAggiornaClienti()
  const { avvisa } = useAvvisi()
  const [nome, setNome] = useState(gruppo?.nome ?? "")
  const salva = useMutation({
    mutationFn: () => api(gruppo ? `/admin/clienti/gruppi/${gruppo.id}` : "/admin/clienti/gruppi", { corpo: { nome } }),
    onSuccess: () => {
      void aggiorna()
      avvisa(gruppo ? "Group renamed" : "Group created")
      onChiudi()
    },
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    salva.mutate()
  }
  return (
    <Modale titolo={gruppo ? "Rename group" : "New group"} sottotitolo="Add customers from their own page." onChiudi={onChiudi}>
      <form className="modulo cli-modale" onSubmit={invia}>
        <Campo etichetta="Group name">
          <input required maxLength={100} value={nome} onChange={(e) => setNome(e.target.value)} />
        </Campo>
        {salva.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{salva.error.message}</p> : null}
        <button className="primario" type="submit" disabled={salva.isPending}>{salva.isPending ? "Saving..." : "Save group"}</button>
      </form>
    </Modale>
  )
}

export default function Segmenti() {
  const { puo } = usePermessi()
  const naviga = useNavigate()
  const aggiorna = useAggiornaClienti()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [modulo, setModulo] = useState<RigaGruppo | "nuovo" | null>(null)
  const [daEliminare, setDaEliminare] = useState<RigaGruppo | null>(null)
  const [invio, setInvio] = useState(false)
  const query = useQuery({ queryKey: ["clienti", "segmenti"], queryFn: () => api<DatiSegmenti>("/admin/clienti/segmenti") })
  const elimina = useMutation({
    mutationFn: (gruppo: RigaGruppo) => api(`/admin/clienti/gruppi/${gruppo.id}`, { metodo: "DELETE" }),
    onSuccess: () => {
      void aggiorna()
      setDaEliminare(null)
      avvisa("Group deleted")
    },
    onError: (errore) => {
      setDaEliminare(null)
      segnalaErrore(errore)
    },
  })

  const dati = query.data
  const puoCreare = puo("customer_groups", "edit")
  const puoEliminare = puo("customer_groups", "manage")
  const massimo = Math.max(1, ...(dati?.segmenti.map((s) => s.conteggio) ?? []))

  const colonne: Colonna<RigaGruppo>[] = [
    { titolo: "Group", cella: (g) => <strong>{g.nome}</strong> },
    { titolo: "Customers", destra: true, cella: (g) => numero(g.conteggio) },
    ...(puoCreare || puoEliminare
      ? [
          {
            titolo: "Actions",
            cella: (g: RigaGruppo) => (
              <span className="riga__azioni">
                {puoCreare ? <button type="button" className="cli-piccolo" onClick={(e) => { e.stopPropagation(); setModulo(g) }}>Rename</button> : null}
                {puoEliminare ? <button type="button" className="cli-piccolo" onClick={(e) => { e.stopPropagation(); setDaEliminare(g) }}>Delete</button> : null}
              </span>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
      {dati ? (
        <>
          <div className="cli-segmenti">
            {dati.segmenti.map((s) => <CartaSegmento key={s.chiave} carta={s} dati={dati} massimo={massimo} onInvia={puo("marketing", "edit") ? () => setInvio(true) : undefined} />)}
          </div>
          <section className="cli-citta vetro">
            <header>
              <h2>Where they live</h2>
              <p>{dati.casa ? `Customers by town · most live in ${dati.casa}` : "Customers by town"}</p>
            </header>
            <GraficoCitta citta={dati.citta} />
          </section>
          {puo("customer_groups", "view") ? (
            <Riquadro
              titolo="Customer groups"
              testo="Hand-picked groups for discounts and price lists."
              azioni={puoCreare ? <button type="button" className="primario" onClick={() => setModulo("nuovo")}>New group</button> : undefined}
            >
              {dati.gruppi.length ? (
                <Tabella etichetta="Customer groups" colonne={colonne} righe={dati.gruppi} chiave={(g) => g.id} onApri={(g) => naviga(`/clienti/persone?gruppo=${g.id}`)} />
              ) : (
                <Vuoto icona={UsersRound} titolo="No groups yet" testo="Create a group to bring together customers you treat the same way." />
              )}
            </Riquadro>
          ) : null}
        </>
      ) : null}
      {modulo ? <ModuloGruppo gruppo={modulo === "nuovo" ? undefined : modulo} onChiudi={() => setModulo(null)} /> : null}
      {invio ? <ModuloCampagna onChiudi={() => setInvio(false)} onFatto={() => setInvio(false)} /> : null}
      {daEliminare ? (
        <Conferma
          titolo={`Delete the group ${daEliminare.nome}?`}
          testo="The customers stay: only the group goes."
          azione="Yes, delete group"
          attesa={elimina.isPending}
          onConferma={() => elimina.mutate(daEliminare)}
          onChiudi={() => setDaEliminare(null)}
        />
      ) : null}
    </>
  )
}
