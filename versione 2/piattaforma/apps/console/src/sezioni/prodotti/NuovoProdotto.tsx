import { useMutation } from "@tanstack/react-query"
import { Check } from "lucide-react"
import { useState, type FormEvent } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { api } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { usePermessi } from "../../permessi"
import { Campo, Modale } from "../../ui"
import { CampiScheda, corpoScheda, SCHEDA_VUOTA, type ValoriScheda } from "./CampiScheda"
import { ScegliTinta } from "./comuni"
import { numeroDa, prezzoDaTesto, useAggiornaCatalogo, useAziende, useCategorie, useCollezioni } from "./dati"
import { GalleriaFoto } from "./GalleriaFoto"
import { RigheTaglie, variantiDa, type Taglie } from "./RigheTaglie"

type Errori = { nome?: boolean; prezzo?: boolean; apertura?: boolean; azienda?: boolean }

const TAGLIA_UNICA = "One size"

/** Il codice si può lasciare vuoto: ne nasce uno breve, come per le altre schede create al volo. */
const codiceAutomatico = () => `IL-${Date.now().toString(36).toUpperCase().slice(-5)}`
const aperturaValida = (testo: string) => testo.trim() !== "" && Number.isInteger(Number(testo)) && Number(testo) >= 0

export function NuovoProdotto({ onChiudi }: { onChiudi: () => void }) {
  const naviga = useNavigate()
  const { pathname, search } = useLocation()
  const { puo } = usePermessi()
  const { avvisa } = useAvvisi()
  const aggiorna = useAggiornaCatalogo()
  const categorie = useCategorie()
  const aziende = useAziende()
  const collezioni = useCollezioni()

  const [titolo, setTitolo] = useState("")
  const [descrizione, setDescrizione] = useState("")
  const [azienda, setAzienda] = useState("")
  const [collezione, setCollezione] = useState("")
  const [prezzo, setPrezzo] = useState("")
  const [apertura, setApertura] = useState("0")
  const [tinta, setTinta] = useState(0)
  const [scheda, setScheda] = useState<ValoriScheda>(SCHEDA_VUOTA)
  const [taglie, setTaglie] = useState<Taglie>({ codice: "", taglie: TAGLIA_UNICA, dettagli: {} })
  const [foto, setFoto] = useState<{ url: string }[]>([])
  const [occupato, setOccupato] = useState(false)
  const [seoTitolo, setSeoTitolo] = useState("")
  const [seoDescrizione, setSeoDescrizione] = useState("")
  const [errori, setErrori] = useState<Errori>({})

  const conScorte = puo("inventory_items", "edit") && Boolean(azienda)
  const nome = titolo.trim()
  const crea = useMutation({
    mutationFn: () =>
      api<{ prodotto: { id: string } }>("/admin/catalogo/prodotti", {
        corpo: {
          ...corpoScheda(scheda, puo("margini", "view")),
          titolo,
          descrizione,
          stato: "draft",
          tinta,
          foto,
          azienda_id: azienda || null,
          collezione_id: collezione || null,
          prezzo_vendita: azienda ? prezzoDaTesto(prezzo) : null,
          seo_titolo: seoTitolo,
          seo_descrizione: seoDescrizione,
          varianti: variantiDa({ ...taglie, codice: taglie.codice.trim() || codiceAutomatico() }).map((v) => ({ ...v, quantita: conScorte ? v.quantita ?? numeroDa(apertura) : null })),
        },
      }),
    onSuccess: ({ prodotto }) => {
      avvisa(`${nome} saved as a draft`)
      aggiorna()
      const filtri = new URLSearchParams(search)
      filtri.delete("nuovo")
      const resto = pathname.startsWith("/prodotti/catalogo") && String(filtri) ? `?${filtri}` : ""
      naviga(`/prodotti/catalogo/${prodotto.id}${resto}`)
    },
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    const prezzoSbagliato = prezzo.trim() !== "" && prezzoDaTesto(prezzo) === null
    const aperturaSbagliata = !aperturaValida(apertura)
    const trovati: Errori = {
      nome: !nome,
      prezzo: prezzoSbagliato,
      apertura: aperturaSbagliata,
      azienda: !azienda && (prezzo.trim() !== "" || (!aperturaSbagliata && Number(apertura) > 0)),
    }
    setErrori(trovati)
    if (!Object.values(trovati).some(Boolean)) crea.mutate()
  }

  return (
    <Modale titolo="New product" sottotitolo="It starts as a draft until you publish it." onChiudi={onChiudi}>
      <form className="modulo modulo-prodotto" onSubmit={invia} noValidate>
        <Campo etichetta="Name" aiuto={errori.nome ? "Give it a name." : null}>
          <input autoFocus placeholder="e.g. Linen Wrap Dress" aria-invalid={Boolean(errori.nome)} value={titolo} onChange={(e) => setTitolo(e.target.value)} />
        </Campo>
        <div className="griglia-due">
          <Campo etichetta="Type">
            <select value={scheda.categoria_id} onChange={(e) => setScheda({ ...scheda, categoria_id: e.target.value })}>
              <option value="">No type</option>
              {(categorie.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Campo>
          <Campo etichetta="Price (€)">
            <input inputMode="decimal" aria-invalid={Boolean(errori.prezzo)} value={prezzo} onChange={(e) => setPrezzo(e.target.value)} />
          </Campo>
          <Campo etichetta="Opening stock">
            <input inputMode="numeric" aria-invalid={Boolean(errori.apertura)} value={apertura} onChange={(e) => setApertura(e.target.value)} />
          </Campo>
          <ScegliTinta valore={tinta} onCambia={setTinta} />
        </div>
        <Campo etichetta="Composition">
          <input placeholder="For example, 100% linen" value={scheda.composizione} onChange={(e) => setScheda({ ...scheda, composizione: e.target.value })} />
        </Campo>
        <Campo etichetta="Company" aiuto={errori.azienda ? "Price and stock belong to a company: choose one." : null}>
          <select aria-invalid={Boolean(errori.azienda)} value={azienda} onChange={(e) => setAzienda(e.target.value)}>
            <option value="">No company</option>
            {(aziende.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </Campo>

        <details className="apertura">
          <summary>More details</summary>
          <div className="modulo">
            <Campo etichetta="Description">
              <textarea rows={3} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
            </Campo>
            {collezioni.data ? (
              <Campo etichetta="Collection">
                <select value={collezione} onChange={(e) => setCollezione(e.target.value)}>
                  <option value="">No collection</option>
                  {collezioni.data.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </Campo>
            ) : null}
            <CampiScheda valori={scheda} categorie={categorie.data ?? []} onCambia={setScheda} conCessione={puo("margini", "view") && Boolean(azienda)} conConsigliato={Boolean(azienda)} senzaPrimi />
            <div className="griglia-due">
              <Campo etichetta="Item code" aiuto="Leave it empty to get one automatically">
                <input value={taglie.codice} onChange={(e) => setTaglie({ ...taglie, codice: e.target.value })} />
              </Campo>
              <Campo etichetta="Sizes" aiuto="Separated by commas">
                <input value={taglie.taglie} onChange={(e) => setTaglie({ ...taglie, taglie: e.target.value })} />
              </Campo>
            </div>
            <RigheTaglie valore={taglie} onCambia={setTaglie} conQuantita={conScorte} />
            <GalleriaFoto radice="/admin" foto={foto} onCambia={setFoto} onCaricamento={setOccupato} />
            <Campo etichetta="Search title">
              <input value={seoTitolo} onChange={(e) => setSeoTitolo(e.target.value)} />
            </Campo>
            <Campo etichetta="Search summary">
              <textarea rows={2} value={seoDescrizione} onChange={(e) => setSeoDescrizione(e.target.value)} />
            </Campo>
          </div>
        </details>

        {crea.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{crea.error.message}</p> : null}
        <div className="riga__azioni riga__azioni--fine">
          <button type="button" onClick={onChiudi}>Cancel</button>
          <button type="submit" className="primario" disabled={crea.isPending || occupato}><Check size={16} aria-hidden="true" /> {crea.isPending ? "Saving..." : "Save draft"}</button>
        </div>
      </form>
    </Modale>
  )
}
