import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useState, type FormEvent } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { api } from "../api/client"
import { useAvvisi } from "../componenti"
import { numero, type Stato as StatoEtichetta } from "../lingua"
import { usePermessi } from "../permessi"
import { CampiScheda, corpoScheda, SCHEDA_VUOTA, valoriDa, type ValoriScheda } from "../sezioni/prodotti/CampiScheda"
import { useCategorie } from "../sezioni/prodotti/dati"
import { GalleriaFoto } from "../sezioni/prodotti/GalleriaFoto"
import { RigheTaglie, variantiDa, type Taglie } from "../sezioni/prodotti/RigheTaglie"
import type { RigaAzienda, SchedaAzienda } from "../sezioni/prodotti/tipi"
import { Anteprima, Campo, Etichetta, euro, Modale, Pagina, Stato } from "../ui"

const ONLINE = "published"

/** Per l'azienda il capo è «Live»: è visibile, ma a venderlo è Ishtar Lab. */
const STATI: Record<string, StatoEtichetta> = {
  published: { testo: "Live", tono: "ok" },
  proposed: { testo: "In review", tono: "attesa" },
  requires_action: { testo: "Changes requested", tono: "attesa" },
  rejected: { testo: "Rejected", tono: "errore" },
  draft: { testo: "Draft", tono: "neutro" },
}

const statoDi = (p: RigaAzienda) => (p.modifiche_richieste ? STATI.requires_action : STATI[p.stato] ?? STATI.draft)

const dettagliPrezzi = (p: RigaAzienda) =>
  [p.prezzo_cessione === null ? null : `Supply ${euro(p.prezzo_cessione)}`, p.prezzo_consigliato === null ? null : `Suggested ${euro(p.prezzo_consigliato)}`, p.proposta ? "Prices waiting for approval" : null]
    .filter(Boolean)
    .join(" · ")

function NuovoProdotto({ onChiudi, onCreato }: { onChiudi: () => void; onCreato: () => void }) {
  const categorie = useCategorie("/vendor")
  const [titolo, setTitolo] = useState("")
  const [descrizione, setDescrizione] = useState("")
  const [scheda, setScheda] = useState<ValoriScheda>(SCHEDA_VUOTA)
  const [taglie, setTaglie] = useState<Taglie>({ codice: "", taglie: "S, M, L", dettagli: {} })
  const [foto, setFoto] = useState<{ url: string }[]>([])
  const [occupato, setOccupato] = useState(false)

  const crea = useMutation({
    mutationFn: (bozza: boolean) =>
      api("/vendor/catalogo/prodotti", {
        corpo: { ...corpoScheda(scheda, true), titolo, descrizione, foto, bozza, varianti: variantiDa(taglie) },
      }),
    onSuccess: onCreato,
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    crea.mutate(false)
  }

  return (
    <Modale titolo="New product" sottotitolo="It goes live once Ishtar Lab approves it." onChiudi={onChiudi}>
      <form className="modulo" onSubmit={invia}>
        <Campo etichetta="Product name">
          <input required value={titolo} onChange={(e) => setTitolo(e.target.value)} />
        </Campo>
        <Campo etichetta="Description">
          <textarea rows={3} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
        </Campo>
        <div className="griglia-due">
          <Campo etichetta="Item code">
            <input required value={taglie.codice} onChange={(e) => setTaglie({ ...taglie, codice: e.target.value })} />
          </Campo>
          <Campo etichetta="Sizes" aiuto="Separated by commas">
            <input required value={taglie.taglie} onChange={(e) => setTaglie({ ...taglie, taglie: e.target.value })} />
          </Campo>
        </div>
        <RigheTaglie valore={taglie} onCambia={setTaglie} conQuantita />
        <CampiScheda valori={scheda} categorie={categorie.data ?? []} onCambia={setScheda} conCessione />
        <GalleriaFoto radice="/vendor" foto={foto} onCambia={setFoto} onCaricamento={setOccupato} />
        {crea.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{crea.error.message}</p> : null}
        <div className="riga__azioni">
          <button type="submit" className="primario" disabled={crea.isPending || occupato}>{crea.isPending ? "Sending..." : "Send for review"}</button>
          <button type="button" disabled={crea.isPending || occupato || !titolo.trim() || !taglie.codice.trim()} onClick={() => crea.mutate(true)}>Save as draft</button>
        </div>
      </form>
    </Modale>
  )
}

function ModuloScheda({ scheda, onChiudi, onSalvato }: { scheda: SchedaAzienda; onChiudi: () => void; onSalvato: (inRevisione: boolean) => void }) {
  const { puo } = usePermessi()
  const categorie = useCategorie("/vendor")
  const online = scheda.stato === ONLINE
  const puoModificare = puo("products", "edit")
  const [titolo, setTitolo] = useState(scheda.titolo)
  const [descrizione, setDescrizione] = useState(scheda.descrizione ?? "")
  const [valori, setValori] = useState<ValoriScheda>(valoriDa(scheda))
  const [foto, setFoto] = useState<{ url: string }[]>(scheda.foto.length ? scheda.foto.map((f) => ({ url: f.url })) : scheda.copertina ? [{ url: scheda.copertina }] : [])
  const [ean, setEan] = useState<Record<string, string>>(Object.fromEntries(scheda.varianti.map((v) => [v.id, v.ean ?? ""])))
  const [occupato, setOccupato] = useState(false)

  const salva = useMutation({
    mutationFn: () =>
      api<{ in_revisione: boolean }>(`/vendor/catalogo/prodotti/${scheda.id}`, {
        corpo: {
          ...corpoScheda(valori, true),
          titolo,
          descrizione,
          foto,
          ...(online ? {} : { varianti: scheda.varianti.map((v) => ({ id: v.id, ean: ean[v.id].trim() || null })) }),
        },
      }),
    onSuccess: ({ in_revisione }) => onSalvato(in_revisione),
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    salva.mutate()
  }

  return (
    <Modale titolo="Product sheet" sottotitolo={scheda.titolo} onChiudi={onChiudi}>
      <form className="modulo" onSubmit={invia}>
        {scheda.nota ? <p className="avviso-stato avviso-stato--attesa">Note from Ishtar Lab: {scheda.nota}</p> : null}
        {online ? <p className="avviso-stato">This product is live: changes to text or prices go back to review.</p> : null}
        {scheda.modifiche_in_attesa ? <p className="avviso-stato avviso-stato--attesa">A change to the text is already waiting for approval.</p> : null}
        {scheda.proposta ? (
          <p className="avviso-stato avviso-stato--attesa">Prices waiting for approval: supply {euro(scheda.proposta.prezzo_cessione)}, suggested {euro(scheda.proposta.prezzo_consigliato)}.</p>
        ) : null}
        <fieldset className="contenitore" disabled={!puoModificare}>
          <Campo etichetta="Product name">
            <input required value={titolo} onChange={(e) => setTitolo(e.target.value)} />
          </Campo>
          <Campo etichetta="Description">
            <textarea rows={3} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
          </Campo>
          <CampiScheda valori={valori} categorie={categorie.data ?? []} onCambia={setValori} conCessione />
          <GalleriaFoto radice="/vendor" foto={foto} onCambia={setFoto} onCaricamento={setOccupato} />
          <div className="righe-taglie" role="group" aria-label="Product sizes">
            <div className="righe-taglie__riga righe-taglie__testa" aria-hidden="true">
              <span>Size</span>
              <span>EAN</span>
              <span>Quantity</span>
            </div>
            {scheda.varianti.map((v) => (
              <div key={v.id} className="righe-taglie__riga">
                <strong>{v.titolo}</strong>
                <input inputMode="numeric" aria-label={`EAN for size ${v.titolo}`} disabled={online} value={ean[v.id]} onChange={(e) => setEan({ ...ean, [v.id]: e.target.value })} />
                <span>{numero(v.quantita)}</span>
              </div>
            ))}
          </div>
          <small className="testo-tenue">Quantities update straight away from <Link to="/magazzino">Inventory</Link>.</small>
        </fieldset>
        {salva.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{salva.error.message}</p> : null}
        {puoModificare ? <button type="submit" className="primario" disabled={salva.isPending || occupato}>{salva.isPending ? "Saving..." : "Save changes"}</button> : null}
      </form>
    </Modale>
  )
}

function FinestraScheda({ id, onChiudi, onSalvato }: { id: string; onChiudi: () => void; onSalvato: (inRevisione: boolean) => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["mia-scheda", id],
    queryFn: () => api<{ prodotto: SchedaAzienda }>(`/vendor/catalogo/prodotti/${id}`),
    // Il modulo parte dai dati letti all'apertura: un aggiornamento non deve cancellare ciò che si sta scrivendo.
    refetchInterval: false,
    refetchOnWindowFocus: false,
    gcTime: 0,
  })
  if (data) return <ModuloScheda scheda={data.prodotto} onChiudi={onChiudi} onSalvato={onSalvato} />
  return (
    <Modale titolo="Product sheet" onChiudi={onChiudi}>
      <Stato caricamento={isLoading} errore={error} vuoto={false} testoVuoto="" />
    </Modale>
  )
}

export default function ProdottiAzienda() {
  const { puo } = usePermessi()
  const { avvisa } = useAvvisi()
  const client = useQueryClient()
  const [parametri, setParametri] = useSearchParams()
  const [nuovo, setNuovo] = useState(false)
  const [aperto, setAperto] = useState<string | null>(null)
  const query = useQuery({
    queryKey: ["miei-prodotti"],
    queryFn: () => api<{ prodotti: RigaAzienda[]; totale: number }>("/vendor/catalogo/prodotti?limit=200"),
  })
  const elenco = query.data?.prodotti ?? []
  const puoCreare = puo("products", "edit")
  const inCreazione = nuovo || (parametri.get("nuovo") === "1" && puoCreare)

  const aggiorna = () => {
    void client.invalidateQueries({ queryKey: ["miei-prodotti"] })
    void client.invalidateQueries({ queryKey: ["ricerca"] })
  }
  const chiudiNuovo = () => {
    setNuovo(false)
    if (parametri.has("nuovo")) setParametri({}, { replace: true })
  }

  return (
    <Pagina
      titolo="My products"
      sottotitolo="Upload your garments and follow their approval."
      azioni={puoCreare ? <button className="primario" type="button" onClick={() => setNuovo(true)}><Plus size={17} aria-hidden="true" /> New product</button> : undefined}
    >
      <Stato caricamento={query.isLoading} errore={query.error} vuoto={!elenco.length} testoVuoto="You have not uploaded any products yet." />
      <ul className="elenco">
        {elenco.map((p) => {
          const stato = statoDi(p)
          const prezzi = dettagliPrezzi(p)
          return (
            <li key={p.id} className="riga vetro">
              <Anteprima url={p.foto} titolo={p.titolo} />
              <div className="riga__testo">
                <strong>{p.titolo}</strong>
                <small>{p.taglie.length ? `Sizes: ${p.taglie.join(", ")}` : "No variants"}{p.categorie[0] ? ` · ${p.categorie[0].nome}` : ""}{` · ${numero(p.scorte)} in stock`}</small>
                {prezzi ? <small>{prezzi}</small> : null}
              </div>
              <Etichetta tono={stato.tono}>{stato.testo}</Etichetta>
              <button type="button" onClick={() => setAperto(p.id)} aria-label={`Open the sheet for ${p.titolo}`}>Sheet</button>
            </li>
          )
        })}
      </ul>
      {inCreazione ? (
        <NuovoProdotto
          onChiudi={chiudiNuovo}
          onCreato={() => {
            aggiorna()
            chiudiNuovo()
          }}
        />
      ) : null}
      {aperto ? (
        <FinestraScheda
          id={aperto}
          onChiudi={() => setAperto(null)}
          onSalvato={(inRevisione) => {
            avvisa(inRevisione ? "Changes sent for review" : "Changes saved")
            aggiorna()
            setAperto(null)
          }}
        />
      ) : null}
    </Pagina>
  )
}
