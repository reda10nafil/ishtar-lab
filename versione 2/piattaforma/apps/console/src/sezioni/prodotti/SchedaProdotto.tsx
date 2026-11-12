import { useMutation } from "@tanstack/react-query"
import { Archive, Pencil, Plus, Trash2 } from "lucide-react"
import { useCallback, useState } from "react"
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom"
import { api, ErroreApi } from "../../api/client"
import { Interruttore, useAvvisi } from "../../componenti"
import { numero, percentuale, stato as leggiStato } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Conferma, dataOra, Etichetta, Stato } from "../../ui"
import { Cassetto, Dato, EtichettaSezione, FotoProdotto, Grafico, prezzoBreve, prezzoDa, STATI_CATALOGO, Tessera } from "./comuni"
import { useAggiornaCatalogo, useProdotto, useSchedaSubito } from "./dati"
import { ModaleDecisione } from "./ModaleDecisione"
import { ModaleVariante } from "./ModaleVariante"
import { ModificaScheda } from "./ModificaScheda"
import { TabellaVarianti } from "./TabellaVarianti"
import type { SchedaProdotto as Scheda, VarianteScheda } from "./tipi"

type Verbo = "reject" | "request-changes"
type Finestra = "modifica" | "elimina" | "decisione" | "variante"

/** Per questi stati basta l'interruttore: l'etichetta servirebbe a dire due volte la stessa cosa. */
const INTERRUTTORE = new Set(["published", "draft", "archived"])

const SPIEGAZIONE_STATO: Record<string, string> = {
  published: "Visible on the online shop and the till",
  draft: "Draft — only you can see it",
  archived: "Archived",
  rejected: "Rejected — not on the shop",
}

const intervalloEuro = (voci: number[]) => (voci.length ? prezzoDa(Math.min(...voci), Math.max(...voci)) : null)

function intervalloMargine(voci: number[]) {
  if (!voci.length) return "–"
  const [minimo, massimo] = [Math.min(...voci), Math.max(...voci)]
  return minimo === massimo ? percentuale(minimo) : `${percentuale(minimo)} – ${percentuale(massimo)}`
}

const definiti = (voci: (number | null | undefined)[]) => voci.filter((v): v is number => v !== null && v !== undefined)

/** Stato del prodotto: interruttore per chi è in vendita o in bozza, decisione per chi è in revisione. */
function RigaStato({ scheda, onDecidi }: { scheda: Scheda; onDecidi: (verbo: Verbo) => void }) {
  const { puo } = usePermessi()
  const { avvisa, segnalaErrore } = useAvvisi()
  const aggiorna = useAggiornaCatalogo()
  const subito = useSchedaSubito(scheda.id)
  const finito = (testo: string) => {
    avvisa(testo)
    aggiorna(scheda.id)
  }
  const stato = useMutation({
    mutationFn: (inVendita: boolean) => api("/admin/catalogo/blocco", { corpo: { azione: inVendita ? "pubblica" : "bozza", ids: [scheda.id] } }),
    onMutate: (inVendita) => {
      const prima = scheda.stato
      subito((attuale) => ({ ...attuale, stato: inVendita ? "published" : "draft" }))
      return prima
    },
    onSuccess: (_, inVendita) => finito(inVendita ? `${scheda.titolo} is on sale` : `${scheda.titolo} moved to drafts`),
    onError: (errore, _, prima) => {
      if (prima) subito((attuale) => ({ ...attuale, stato: prima }))
      segnalaErrore(errore)
    },
  })
  const conferma = useMutation({
    mutationFn: () => api(`/admin/products/${scheda.id}/confirm`, { corpo: {} }),
    onSuccess: () => finito("Product approved"),
    onError: segnalaErrore,
  })

  if (scheda.stato === "proposed") {
    return (
      <div className="riga-impostazione riga-impostazione--a-capo">
        <span className="riga-impostazione__testo">
          <b>Waiting for review</b>
          <small>Sent by the company, not on the shop yet.</small>
        </span>
        {puo("products.review", "edit") ? (
          <div className="riga__azioni">
            <button type="button" className="primario" disabled={conferma.isPending} onClick={() => conferma.mutate()}>Approve</button>
            <button type="button" onClick={() => onDecidi("request-changes")}>Request changes</button>
            <button type="button" onClick={() => onDecidi("reject")}>Reject</button>
          </div>
        ) : null}
      </div>
    )
  }
  const inVendita = scheda.stato === "published"
  return (
    <div className="riga-impostazione">
      <span className="riga-impostazione__testo">
        <b>On sale</b>
        <small>{SPIEGAZIONE_STATO[scheda.stato]}</small>
      </span>
      <Interruttore acceso={inVendita} etichetta="On sale" disattivo={!puo("products", "edit")} onCambia={(acceso) => stato.isPending || stato.mutate(acceso)} />
    </div>
  )
}

export default function SchedaProdotto() {
  const { id = "" } = useParams()
  const naviga = useNavigate()
  const { search } = useLocation()
  const { puo } = usePermessi()
  const { avvisa, segnalaErrore } = useAvvisi()
  const aggiorna = useAggiornaCatalogo()
  const subito = useSchedaSubito(id)
  const { data, isLoading, error } = useProdotto(id)
  const [finestra, setFinestra] = useState<Finestra | null>(null)
  const [verbo, setVerbo] = useState<Verbo>("reject")
  const [variante, setVariante] = useState<VarianteScheda | null>(null)

  const chiudi = useCallback(() => naviga(`/prodotti/catalogo${search}`), [naviga, search])
  const eliminazione = useMutation({
    mutationFn: () => api(`/admin/catalogo/prodotti/${id}`, { metodo: "DELETE" }),
    onSuccess: () => {
      avvisa("Product deleted")
      aggiorna()
      chiudi()
    },
    onError: segnalaErrore,
  })
  const archivia = useMutation({
    mutationFn: () => api("/admin/catalogo/blocco", { corpo: { azione: "archivia", ids: [id] } }),
    onMutate: () => subito((attuale) => ({ ...attuale, stato: "archived" })),
    onSuccess: () => {
      avvisa(`${data?.prodotto.titolo} archived`)
      aggiorna(id)
    },
    onError: (errore) => {
      segnalaErrore(errore)
      aggiorna(id)
    },
  })
  const decisione = useMutation({
    mutationFn: (message: string) => api(`/admin/products/${id}/${verbo}`, { corpo: { message } }),
    onSuccess: () => {
      avvisa(verbo === "reject" ? "Product rejected" : "Request sent to the company")
      aggiorna(id)
      setFinestra(null)
    },
    onError: segnalaErrore,
  })

  if (error instanceof ErroreApi && error.stato === 404) return <Navigate to={`/prodotti/catalogo${search}`} replace />
  const scheda = data?.prodotto
  if (!scheda) {
    return (
      <Cassetto titolo="Product" onChiudi={chiudi}>
        <Stato caricamento={isLoading} errore={error} vuoto={false} testoVuoto="" />
      </Cassetto>
    )
  }

  const stato = leggiStato(STATI_CATALOGO, scheda.stato)
  const puoModificare = puo("products", "edit")
  const conMargini = puo("margini", "view")
  const offerte = scheda.varianti.flatMap((v) => v.offerte)
  const proposte = conMargini ? offerte.filter((o) => o.proposta) : []
  const margini = definiti(offerte.map((o) => o.margine_percento))
  const cessioni = definiti(offerte.map((o) => o.prezzo_cessione))
  const consigliati = definiti(offerte.map((o) => o.prezzo_consigliato))
  const apriVariante = (voce: VarianteScheda | null) => {
    setVariante(voce)
    setFinestra("variante")
  }

  return (
    <>
      <Cassetto
        titolo={scheda.titolo}
        sottotitolo={[scheda.categorie[0]?.nome, scheda.varianti[0]?.sku].filter(Boolean).join(" · ") || undefined}
        onChiudi={chiudi}
        bloccato={finestra !== null}
        piede={
          puoModificare ? (
            <>
              <button type="button" onClick={() => setFinestra("modifica")}><Pencil size={16} aria-hidden="true" /> Edit</button>
              {scheda.stato === "archived" || scheda.stato === "proposed" ? null : <button type="button" disabled={archivia.isPending} onClick={() => archivia.mutate()}><Archive size={16} aria-hidden="true" /> Archive</button>}
              {puo("products", "manage") ? <button type="button" className="pericolo" onClick={() => setFinestra("elimina")}><Trash2 size={16} aria-hidden="true" /> Delete</button> : null}
            </>
          ) : undefined
        }
      >
        <FotoProdotto url={scheda.copertina} titolo={scheda.titolo} tinta={scheda.tinta} classe="scheda-foto__grande" />
        {scheda.foto.length > 1 ? (
          <div className="galleria">
            {scheda.foto.map((f) => <span key={f.id} className="galleria__voce"><img src={f.url} alt="" loading="lazy" /></span>)}
          </div>
        ) : null}

        <div className="tessere">
          <Tessera etichetta="Price" valore={prezzoBreve(scheda.prezzo_min, scheda.prezzo_max)} />
          {conMargini ? <Tessera etichetta="Margin" valore={intervalloMargine(margini)} /> : <Tessera etichetta="Suggested" valore={intervalloEuro(consigliati) ?? "–"} />}
          <Tessera etichetta="Sold · 30 days" conteggio={scheda.vendite.pezzi} />
        </div>

        <EtichettaSezione>Last 14 days</EtichettaSezione>
        <Grafico valori={scheda.vendite.giorni} etichetta="Units sold in the last 14 days" />

        {scheda.modifiche_in_attesa ? <p className="avviso-stato avviso-stato--attesa">A company has asked to change this product: see <Link to="/revisione">Review</Link>.</p> : null}
        {proposte.length ? <p className="avviso-stato avviso-stato--attesa">The company has proposed new prices: see <Link to="/revisione">Review</Link>.</p> : null}

        <EtichettaSezione azione={INTERRUTTORE.has(scheda.stato) ? undefined : <Etichetta tono={stato.tono}>{stato.testo}</Etichetta>}>Details</EtichettaSezione>
        <RigaStato
          scheda={scheda}
          onDecidi={(scelta) => {
            setVerbo(scelta)
            setFinestra("decisione")
          }}
        />

        <EtichettaSezione azione={puoModificare ? <button type="button" className="pulsante-piccolo" onClick={() => apriVariante(null)}><Plus size={15} aria-hidden="true" /> Add variant</button> : undefined}>
          Variants · {numero(scheda.varianti.length)}
        </EtichettaSezione>
        <TabellaVarianti scheda={scheda} conMargini={conMargini} onApri={puoModificare ? apriVariante : undefined} />

        <dl className="definizioni">
          <Dato etichetta={scheda.aziende.length > 1 ? "Companies" : "Company"} valore={scheda.aziende.map((a) => a.nome).join(", ") || "No company"} />
          <Dato etichetta="Brand" valore={scheda.brand} />
          <Dato etichetta="Category" valore={scheda.categorie.map((c) => c.nome).join(", ")} />
          <Dato etichetta="Collections" valore={scheda.collezione?.titolo} />
          <Dato etichetta="Season" valore={scheda.stagione} />
          <Dato etichetta="Gender" valore={scheda.genere} />
          <Dato etichetta="Composition" valore={scheda.composizione} />
          <Dato etichetta="Weight" valore={scheda.peso === null ? null : `${numero(scheda.peso)} g`} />
          <Dato etichetta="Garment care" valore={scheda.cura} />
          <Dato etichetta="Selling price" valore={prezzoDa(scheda.prezzo_min, scheda.prezzo_max)} />
          <Dato etichetta="Suggested price" valore={intervalloEuro(consigliati)} />
          {conMargini ? <Dato etichetta="Supply price" valore={intervalloEuro(cessioni)} /> : null}
          <Dato etichetta="Search title" valore={scheda.seo_titolo} />
          <Dato etichetta="Search summary" valore={scheda.seo_descrizione} />
          <Dato etichetta="Address" valore={scheda.handle} />
          <Dato etichetta="Updated" valore={dataOra(scheda.aggiornato_il)} />
        </dl>
        <p className="scheda-testo">{scheda.descrizione || "No description yet."}</p>
      </Cassetto>

      {finestra === "modifica" ? <ModificaScheda scheda={scheda} onChiudi={() => setFinestra(null)} /> : null}
      {finestra === "variante" ? <ModaleVariante scheda={scheda} variante={variante} onChiudi={() => setFinestra(null)} /> : null}
      {finestra === "decisione" ? <ModaleDecisione titolo={scheda.titolo} rifiuto={verbo === "reject"} attesa={decisione.isPending} onChiudi={() => setFinestra(null)} onInvia={(message) => decisione.mutate(message)} /> : null}
      {finestra === "elimina" ? (
        <Conferma
          titolo="Delete this product?"
          testo={`“${scheda.titolo}” will leave the catalogue with its variants, offers and stock. This cannot be undone.`}
          azione="Delete"
          attesa={eliminazione.isPending}
          onConferma={() => eliminazione.mutate()}
          onChiudi={() => setFinestra(null)}
        />
      ) : null}
    </>
  )
}
