import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowRight, Check, Search, Store, Tag, type LucideIcon } from "lucide-react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import { api } from "../api/client"
import { useAvvisi } from "../componenti"
import { numero, STATI_EVASIONE, stato } from "../lingua"
import { anima, CURVE, useUscita } from "../movimenti"
import { usePermessi } from "../permessi"
import { useSessione } from "../sessione"
import { euro } from "../ui"
import type { Creazione } from "./Crea"
import { AZIONI_RICERCA, ICONA_ORDINI } from "./azioniRicerca"
import type { Voce } from "./voci"

type OrdineRiga = { id: string; numero: number; evasione: string }

type Riga = {
  id: string
  gruppo: string
  titolo: string
  dettaglio?: string
  a?: string
  crea?: Creazione
  icona?: LucideIcon
  sigla?: string
  foto?: string | null
  ordine?: OrdineRiga
}

type RispostaOrdini = { ordini: { id: string; numero: number; creato_il: string; cliente: { nome: string }; evasione: string; totale: number; annullato: boolean }[] }
type RispostaProdotti = { prodotti: { id: string; titolo: string; foto: string | null; categorie: { nome: string }[]; prezzo_min: number | null; scorte: number }[] }
type RispostaClienti = { clienti: { id: string; email: string | null; nome: string | null; cognome: string | null; azienda: string | null; citta: string | null }[] }
type RispostaCodici = { codici: { id: string; codice: string; descrizione: string | null; usi: number }[] }

const ATTESA_DIGITAZIONE = 160
const PER_GRUPPO = 5
const ORDINI_CERCATI = 6
const ORDINI_RECENTI = 3
const PRODOTTI_RECENTI = 2
const GIORNO = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" })

const testoEvasione = (valore: string) => (valore === "collected" ? "Collected" : stato(STATI_EVASIONE, valore).testo)
const siglaDi = (testo: string) => testo.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")

/** Il prossimo passo di un ordine che si può fare dalla ricerca. */
const passoOrdine = (evasione: string) => {
  if (evasione === "not_fulfilled" || evasione === "partially_fulfilled") return { testo: "Mark packed", fatto: "packed", annullabile: true }
  if (evasione === "fulfilled") return { testo: "Mark shipped", fatto: "shipped", annullabile: false }
  return null
}

function useTestoCalmo(testo: string) {
  const [calmo, setCalmo] = useState(testo)
  useEffect(() => {
    const attesa = setTimeout(() => setCalmo(testo), ATTESA_DIGITAZIONE)
    return () => clearTimeout(attesa)
  }, [testo])
  return calmo
}

/** Cerca sul server in ciò che il profilo può vedere; una fonte che fallisce non blocca le altre. */
function useRisultati(testo: string) {
  const { sessione } = useSessione()
  const { puo } = usePermessi()
  const admin = sessione?.tipo === "admin"
  const q = encodeURIComponent(testo)
  const conTesto = testo.length >= 2

  return useQuery({
    queryKey: ["ricerca", sessione?.tipo, testo],
    enabled: conTesto || !testo,
    refetchInterval: false,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const fonti: Promise<Riga[]>[] = []
      if (admin && puo("orders", "view")) {
        const filtro = conTesto ? `&q=${q}` : ""
        fonti.push(
          api<RispostaOrdini>(`/admin/ordini?limit=${conTesto ? ORDINI_CERCATI : ORDINI_RECENTI}${filtro}`).then(({ ordini }) =>
            ordini.map((o) => ({
              id: o.id,
              gruppo: "Orders",
              titolo: `#${o.numero} · ${o.cliente.nome}`,
              dettaglio: `${euro(o.totale)} · ${testoEvasione(o.evasione)} · ${GIORNO.format(new Date(o.creato_il))}`,
              a: `/ordini/tutti/${o.id}`,
              icona: ICONA_ORDINI,
              ordine: o.annullato ? undefined : { id: o.id, numero: o.numero, evasione: o.evasione },
            }))
          )
        )
      }
      if (admin && puo("products", "view")) {
        const filtro = conTesto ? `&q=${q}` : ""
        fonti.push(
          api<RispostaProdotti>(`/admin/catalogo/prodotti?limit=${conTesto ? PER_GRUPPO : PRODOTTI_RECENTI}${filtro}`).then(({ prodotti }) =>
            prodotti.map((p) => ({
              id: p.id,
              gruppo: "Products",
              titolo: p.titolo,
              dettaglio: [p.categorie[0]?.nome, p.prezzo_min === null ? null : euro(p.prezzo_min), `${numero(p.scorte)} in stock`].filter(Boolean).join(" · "),
              a: `/prodotti/catalogo/${p.id}`,
              foto: p.foto,
              sigla: siglaDi(p.titolo),
            }))
          )
        )
      }
      if (!admin && conTesto && puo("products", "view")) {
        fonti.push(
          api<{ products: { id: string; title: string }[] }>(`/vendor/products?q=${q}&limit=${PER_GRUPPO}&fields=id,title`).then(({ products }) =>
            products.map((p) => ({ id: p.id, gruppo: "Products", titolo: p.title, a: "/prodotti", sigla: siglaDi(p.title) }))
          )
        )
      }
      if (!admin && conTesto && puo("orders", "view")) {
        fonti.push(
          api<{ orders: { id: string; display_id: number; email: string | null }[] }>(`/vendor/orders?q=${q}&limit=${PER_GRUPPO}&fields=id,display_id,email`).then(({ orders }) =>
            orders.map((o) => ({ id: o.id, gruppo: "Orders", titolo: `#${o.display_id}`, dettaglio: o.email ?? undefined, a: "/ordini", icona: ICONA_ORDINI }))
          )
        )
      }
      if (admin && conTesto && puo("customers", "view")) {
        fonti.push(
          api<RispostaClienti>(`/admin/clienti?q=${q}&limit=${PER_GRUPPO}`).then(({ clienti }) =>
            clienti.map((c) => {
              const nome = [c.nome, c.cognome].filter(Boolean).join(" ") || c.azienda || c.email || ""
              return { id: c.id, gruppo: "Customers", titolo: nome, dettaglio: [c.email, c.citta].filter(Boolean).join(" · "), a: `/clienti/persone/${c.id}`, sigla: siglaDi(nome) }
            })
          )
        )
      }
      if (admin && conTesto && puo("sconti", "view")) {
        fonti.push(
          api<RispostaCodici>(`/admin/sconti/codici?q=${q}&limit=${PER_GRUPPO}`).then(({ codici }) =>
            codici.map((c) => ({
              id: c.id,
              gruppo: "Discounts",
              titolo: c.codice,
              dettaglio: [c.descrizione, `used ${numero(c.usi)}×`].filter(Boolean).join(" · "),
              a: `/sconti/codici?q=${encodeURIComponent(c.codice)}`,
              icona: Tag,
            }))
          )
        )
      }
      if (admin && conTesto && puo("sellers", "view")) {
        fonti.push(
          api<{ sellers: { id: string; name: string; email: string }[] }>("/admin/sellers?limit=100&fields=id,name,email").then(({ sellers }) =>
            sellers
              .filter((s) => s.name.toLowerCase().includes(testo.toLowerCase()))
              .slice(0, PER_GRUPPO)
              .map((s) => ({ id: s.id, gruppo: "Companies", titolo: s.name, dettaglio: s.email, a: "/aziende", sigla: siglaDi(s.name) }))
          )
        )
      }
      const esiti = await Promise.allSettled(fonti)
      return esiti.flatMap((esito) => (esito.status === "fulfilled" ? esito.value : []))
    },
  })
}

/** Tutte le pagine: senza testo una riga per area, con il testo anche le schede («Discounts › Gift cards»). */
function righePagine(voci: Voce[], cercato: string): Riga[] {
  const proprie = voci.filter((v) => !v.canale)
  const canali = voci.filter((v) => v.canale)
  const posizione = proprie.findIndex((v) => v.a === "/impostazioni")
  const aree: { titolo: string; a: string; icona: LucideIcon; sotto: { a: string; etichetta: string }[] }[] = proprie.map((v) => ({
    titolo: v.etichetta,
    a: v.a,
    icona: v.icona,
    sotto: v.sotto ?? v.schede ?? [],
  }))
  if (canali.length) {
    aree.splice(posizione < 0 ? aree.length : posizione, 0, {
      titolo: "Sales channels",
      a: canali[0].a,
      icona: Store,
      sotto: canali.map((v) => ({ a: v.a, etichetta: v.etichetta })),
    })
  }
  if (!cercato) {
    return aree.map((area) => ({
      id: area.a,
      gruppo: "Go to",
      titolo: area.titolo,
      dettaglio: area.sotto.length ? area.sotto.map((s) => s.etichetta).join(" · ") : "Page",
      a: area.a,
      icona: area.icona,
    }))
  }
  return aree.flatMap((area) => [
    ...(area.titolo.toLowerCase().includes(cercato) ? [{ id: area.a, gruppo: "Go to", titolo: area.titolo, dettaglio: "Page", a: area.a, icona: area.icona }] : []),
    ...area.sotto
      .filter((s) => s.etichetta.toLowerCase().includes(cercato) && !(area.sotto.length === 1 && s.etichetta === area.titolo))
      .map((s) => ({ id: s.a, gruppo: "Go to", titolo: `${area.titolo} › ${s.etichetta}`, dettaglio: "Page", a: s.a, icona: area.icona })),
  ])
}

type Proprieta = { voci: Voce[]; onChiudi: () => void; onCrea: (tipo: Creazione) => void }

export default function Ricerca({ voci, onChiudi, onCrea }: Proprieta) {
  const naviga = useNavigate()
  const client = useQueryClient()
  const { avvisa, segnalaErrore } = useAvvisi()
  const { sessione } = useSessione()
  const { puo } = usePermessi()
  const admin = sessione?.tipo === "admin"
  const campo = useRef<HTMLInputElement>(null)
  const velo = useRef<HTMLDivElement>(null)
  const finestra = useRef<HTMLDivElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  const chiudi = useRef(onChiudi)
  chiudi.current = onChiudi
  const [testo, setTesto] = useState("")
  const [attivo, setAttivo] = useState(0)
  const calmo = useTestoCalmo(testo.trim())
  const { data: trovati = [], isFetching } = useRisultati(calmo)

  useEffect(() => campo.current?.focus(), [])
  useEffect(() => setAttivo(0), [calmo])
  useEffect(() => {
    const esci = (e: globalThis.KeyboardEvent) => e.key === "Escape" && chiudi.current()
    document.addEventListener("keydown", esci)
    return () => document.removeEventListener("keydown", esci)
  }, [])
  useLayoutEffect(() => {
    if (!velo.current || !finestra.current) return
    const animazioni = [
      anima(velo.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 250, easing: CURVE.fuori1 }),
      anima(finestra.current, [{ opacity: 0, transform: "translateY(-18px) scale(0.97)" }, { opacity: 1, transform: "none" }], { duration: 440, easing: CURVE.ricerca }),
    ]
    return () => animazioni.forEach((a) => a?.cancel())
  }, [])
  useUscita(velo, (copia) => [
    anima(copia, [{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: CURVE.fuori1, fill: "forwards" }),
    anima(copia.querySelector(".ricerca")!, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-10px) scale(0.97)" }], { duration: 180, easing: CURVE.dentro2, fill: "forwards" }),
  ])

  const elenco = useMemo<Riga[]>(() => {
    const cercato = testo.trim().toLowerCase()
    const azioni = AZIONI_RICERCA.filter((a) => puo(...a.permesso) && (a.soloAdmin ? admin : true) && (!cercato || a.titolo.toLowerCase().includes(cercato))).map((a) => ({
      id: a.titolo,
      gruppo: "Actions",
      titolo: a.titolo,
      dettaglio: "Action",
      a: a.a,
      crea: a.crea,
      icona: a.icona,
    }))
    return [...trovati, ...righePagine(voci, cercato), ...azioni]
    // `puo` cambia a ogni disegno: contano i permessi, che arrivano con `voci`.
  }, [testo, voci, trovati, admin]) // eslint-disable-line react-hooks/exhaustive-deps

  const voceAttiva = elenco[attivo]

  useEffect(() => {
    lista.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" })
  }, [attivo])

  const apri = (riga: Riga | undefined) => {
    if (!riga) return
    onChiudi()
    if (riga.crea) onCrea(riga.crea)
    else if (riga.a) naviga(riga.a)
  }

  const disfa = async (ordineId: string) => {
    try {
      const { ordine } = await api<{ ordine: { richieste: { ordine_id: string; azienda_id: string; stato: string }[] } }>(`/admin/ordini/${ordineId}`)
      await Promise.all(ordine.richieste.filter((r) => r.stato === "preparata").map((r) => api(`/admin/evasioni/${r.ordine_id}/${r.azienda_id}/riapri`, { corpo: {} })))
      void client.invalidateQueries({ queryKey: ["ordini"] })
    } catch (errore) {
      segnalaErrore(errore)
    }
  }

  const avanza = async (ordine: OrdineRiga) => {
    const passo = passoOrdine(ordine.evasione)
    if (!passo) return
    onChiudi()
    try {
      const { falliti } = await api<{ falliti: { motivo: string }[] }>("/admin/ordini/blocco", { corpo: { azione: "avanza", ids: [ordine.id] } })
      if (falliti.length) throw new Error(falliti[0].motivo)
      void client.invalidateQueries({ queryKey: ["ordini"] })
      void client.invalidateQueries({ queryKey: ["ricerca"] })
      avvisa(`#${ordine.numero} ${passo.fatto}`, passo.annullabile ? { etichetta: "Undo", esegui: () => void disfa(ordine.id) } : undefined)
    } catch (errore) {
      segnalaErrore(errore)
    }
  }

  const puoAvanzare = (riga: Riga | undefined) => Boolean(riga?.ordine && passoOrdine(riga.ordine.evasione) && puo("evasioni", "edit"))

  const tasto = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (e.shiftKey) {
        const scelta = puoAvanzare(voceAttiva) ? voceAttiva : elenco.find(puoAvanzare)
        if (scelta?.ordine) void avanza(scelta.ordine)
      } else {
        apri(voceAttiva)
      }
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      const passo = e.key === "ArrowDown" ? 1 : -1
      setAttivo(Math.max(0, Math.min(elenco.length - 1, attivo + passo)))
    }
  }

  return createPortal(
    <div className="velo" ref={velo} onMouseDown={(e) => e.target === e.currentTarget && onChiudi()}>
      <div className="modale vetro ricerca" ref={finestra} role="dialog" aria-modal="true" aria-label="Search">
        <div className="ricerca__campo">
          <Search size={20} strokeWidth={1.8} aria-hidden="true" />
          <input
            ref={campo}
            type="search"
            value={testo}
            placeholder="Search orders, products, customers, codes..."
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="ricerca-elenco"
            aria-activedescendant={voceAttiva ? `ricerca-${attivo}` : undefined}
            onChange={(e) => setTesto(e.target.value)}
            onKeyDown={tasto}
          />
          <kbd className="tasto">esc</kbd>
        </div>
        <div className="ricerca__elenco" id="ricerca-elenco" role="listbox" aria-label="Results" ref={lista}>
          {elenco.map((riga, indice) => {
            const passo = puoAvanzare(riga) && riga.ordine ? passoOrdine(riga.ordine.evasione) : null
            const Icona = riga.icona
            return (
              <div key={`${riga.gruppo}-${riga.id}`}>
                {riga.gruppo !== elenco[indice - 1]?.gruppo ? <p className="ricerca__gruppo">{riga.gruppo}</p> : null}
                <div
                  id={`ricerca-${indice}`}
                  role="option"
                  aria-selected={indice === attivo}
                  className={`ricerca__voce${indice === attivo ? " ricerca__voce--attiva" : ""}`}
                  onMouseMove={() => setAttivo(indice)}
                  onClick={() => apri(riga)}
                >
                  {Icona ? (
                    <span className="ricerca__icona" aria-hidden="true"><Icona size={18} strokeWidth={1.8} /></span>
                  ) : riga.foto ? (
                    <img className="ricerca__foto" src={riga.foto} alt="" loading="lazy" />
                  ) : (
                    <span className="ricerca__sigla" aria-hidden="true">{riga.sigla}</span>
                  )}
                  <span className="ricerca__testi">
                    <b>{riga.titolo}</b>
                    {riga.dettaglio ? <small>{riga.dettaglio}</small> : null}
                  </span>
                  {passo && riga.ordine ? (
                    <button
                      type="button"
                      className="primario ricerca__passo"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (riga.ordine) void avanza(riga.ordine)
                      }}
                    >
                      <Check size={16} aria-hidden="true" /> {passo.testo}
                    </button>
                  ) : (
                    <ArrowRight size={18} strokeWidth={1.8} aria-hidden="true" />
                  )}
                </div>
              </div>
            )
          })}
          {!elenco.length ? (
            <div className="ricerca__vuoto">
              {isFetching ? <b>Searching...</b> : (
                <>
                  <b>Nothing for “{testo.trim()}”</b>
                  <p>Try an order number, a product name or a discount code.</p>
                </>
              )}
            </div>
          ) : null}
        </div>
        <div className="ricerca__piede">
          <span><kbd className="tasto">↑↓</kbd> move</span>
          <span><kbd className="tasto">↵</kbd> open</span>
          {admin ? <span><kbd className="tasto">⇧↵</kbd> pack or ship an order</span> : null}
        </div>
      </div>
    </div>,
    document.body
  )
}
