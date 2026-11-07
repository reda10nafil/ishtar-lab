import { useMutation } from "@tanstack/react-query"
import { PackageX, Pencil, Plus, Trash2 } from "lucide-react"
import { useCallback, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { api, ErroreApi } from "../../api/client"
import { Interruttore, useAvvisi, Vuoto } from "../../componenti"
import { numero, percentuale, STATI_PRODOTTO, stato as leggiStato } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Conferma, dataOra, Etichetta, Stato } from "../../ui"
import { Cassetto, Dato, FotoProdotto, prezzoDa, Tessera } from "./comuni"
import { useAggiornaCatalogo, useProdotto } from "./dati"
import { ModaleDecisione } from "./ModaleDecisione"
import { ModaleVariante } from "./ModaleVariante"
import { ModificaScheda } from "./ModificaScheda"
import { TabellaVarianti } from "./TabellaVarianti"
import type { SchedaProdotto as Scheda, VarianteScheda } from "./tipi"

type Verbo = "reject" | "request-changes"
type Finestra = "modifica" | "elimina" | "decisione" | "variante"

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
  const finito = (testo: string) => {
    avvisa(testo)
    aggiorna(scheda.id)
  }
  const stato = useMutation({
    mutationFn: (nuovo: "published" | "draft") => api(`/admin/products/${scheda.id}`, { corpo: { status: nuovo } }),
    onSuccess: (_, nuovo) => finito(nuovo === "published" ? "Product on sale" : "Product back in drafts"),
    onError: segnalaErrore,
  })
  const conferma = useMutation({
    mutationFn: () => api(`/admin/products/${scheda.id}/confirm`, { corpo: {} }),
    onSuccess: () => finito("Product approved"),
    onError: segnalaErrore,
  })

  if (scheda.stato === "proposed") {
    return (
      <div className="impostazione">
        <div>
          <strong>Waiting for review</strong>
          <small>Sent by the company, not visible on the shop yet.</small>
        </div>
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
    <div className="impostazione">
      <div>
        <strong>On sale</strong>
        <small>{inVendita ? "Visible on the online shop." : "Hidden from the online shop."}</small>
      </div>
      <Interruttore acceso={inVendita} etichetta="On sale" disattivo={!puo("products", "edit") || stato.isPending} onCambia={(acceso) => stato.mutate(acceso ? "published" : "draft")} />
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
  const decisione = useMutation({
    mutationFn: (message: string) => api(`/admin/products/${id}/${verbo}`, { corpo: { message } }),
    onSuccess: () => {
      avvisa(verbo === "reject" ? "Product rejected" : "Request sent to the company")
      aggiorna(id)
      setFinestra(null)
    },
    onError: segnalaErrore,
  })

  if (error instanceof ErroreApi && error.stato === 404) {
    return (
      <Cassetto titolo="Product" onChiudi={chiudi}>
        <Vuoto icona={PackageX} titolo="This product no longer exists" testo="It may have been deleted." azione={<Link to={`/prodotti/catalogo${search}`}>Back to the catalogue</Link>} />
      </Cassetto>
    )
  }
  const scheda = data?.prodotto
  if (!scheda) {
    return (
      <Cassetto titolo="Product" onChiudi={chiudi}>
        <Stato caricamento={isLoading} errore={error} vuoto={false} testoVuoto="" />
      </Cassetto>
    )
  }

  const stato = leggiStato(STATI_PRODOTTO, scheda.stato)
  const puoModificare = puo("products", "edit")
  const conMargini = puo("margini", "view")
  const offerte = scheda.varianti.flatMap((v) => v.offerte)
  const proposte = conMargini ? offerte.filter((o) => o.proposta) : []
  const margini = definiti(offerte.map((o) => o.margine_percento))
  const cessioni = definiti(offerte.map((o) => o.prezzo_cessione))
  const consigliati = definiti(offerte.map((o) => o.prezzo_consigliato))
  const primoSku = scheda.varianti[0]?.sku
  const apriVariante = (voce: VarianteScheda | null) => {
    setVariante(voce)
    setFinestra("variante")
  }

  return (
    <>
      <Cassetto
        titolo={scheda.titolo}
        sottotitolo={[scheda.categorie[0]?.nome, primoSku].filter(Boolean).join(" · ") || undefined}
        onChiudi={chiudi}
        bloccato={finestra !== null}
        piede={
          puoModificare ? (
            <>
              <button type="button" onClick={() => setFinestra("modifica")}><Pencil size={16} aria-hidden="true" /> Edit</button>
              {puo("products", "manage") ? <button type="button" className="pericolo" onClick={() => setFinestra("elimina")}><Trash2 size={16} aria-hidden="true" /> Delete</button> : null}
            </>
          ) : undefined
        }
      >
        <FotoProdotto url={scheda.copertina} titolo={scheda.titolo} classe="scheda-foto__grande" />
        {scheda.foto.length > 1 ? (
          <div className="galleria">
            {scheda.foto.map((f) => <span key={f.id} className="galleria__voce"><img src={f.url} alt="" loading="lazy" /></span>)}
          </div>
        ) : null}

        <div className="tessere">
          <Tessera etichetta="Price" valore={prezzoDa(scheda.prezzo_min, scheda.prezzo_max)} />
          {conMargini ? <Tessera etichetta="Margin" valore={intervalloMargine(margini)} /> : <Tessera etichetta="Suggested" valore={intervalloEuro(consigliati) ?? "–"} />}
          <Tessera etichetta="Stock" valore={numero(scheda.scorte)} />
        </div>

        {scheda.modifiche_in_attesa ? <p className="avviso-stato avviso-stato--attesa">A company has asked to change this product: see <Link to="/revisione">Review</Link>.</p> : null}
        {proposte.length ? <p className="avviso-stato avviso-stato--attesa">The company has proposed new prices: see <Link to="/revisione">Review</Link>.</p> : null}

        <section className="cassetto__sezione">
          <div className="cassetto__titolo">
            <h3>Details</h3>
            <Etichetta tono={stato.tono}>{stato.testo}</Etichetta>
          </div>
          <RigaStato
            scheda={scheda}
            onDecidi={(scelta) => {
              setVerbo(scelta)
              setFinestra("decisione")
            }}
          />
          <p className="scheda-testo">{scheda.descrizione || "No description yet."}</p>
          <dl className="dati">
            <Dato etichetta={scheda.aziende.length > 1 ? "Companies" : "Company"} valore={scheda.aziende.map((a) => a.nome).join(", ") || "No company"} />
            <Dato etichetta="Brand" valore={scheda.brand} />
            <Dato etichetta="Category" valore={scheda.categorie.map((c) => c.nome).join(", ")} />
            <Dato etichetta="Collection" valore={scheda.collezione?.titolo} />
            <Dato etichetta="Season" valore={scheda.stagione} />
            <Dato etichetta="Gender" valore={scheda.genere} />
            <Dato etichetta="Composition" valore={scheda.composizione} />
            <Dato etichetta="Weight" valore={scheda.peso === null ? null : `${numero(scheda.peso)} g`} />
            <Dato etichetta="Garment care" valore={scheda.cura} />
            <Dato etichetta="Suggested price" valore={intervalloEuro(consigliati)} />
            {conMargini ? <Dato etichetta="Supply price" valore={intervalloEuro(cessioni)} /> : null}
          </dl>
        </section>

        <section className="cassetto__sezione">
          <div className="cassetto__titolo">
            <h3>Variants</h3>
            {puoModificare ? <button type="button" onClick={() => apriVariante(null)}><Plus size={16} aria-hidden="true" /> Add variant</button> : null}
          </div>
          <TabellaVarianti scheda={scheda} conMargini={conMargini} onApri={puoModificare ? apriVariante : undefined} />
        </section>

        <section className="cassetto__sezione">
          <div className="cassetto__titolo">
            <h3>Search engines</h3>
          </div>
          <dl className="dati">
            <Dato etichetta="Title" valore={scheda.seo_titolo} />
            <Dato etichetta="Summary" valore={scheda.seo_descrizione} />
            <Dato etichetta="Address" valore={scheda.handle} />
          </dl>
          <small className="testo-tenue">Updated {dataOra(scheda.aggiornato_il)}</small>
        </section>
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
