import { useMutation } from "@tanstack/react-query"
import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { usePermessi } from "../../permessi"
import { Campo, Modale } from "../../ui"
import { CampiScheda, corpoScheda, SCHEDA_VUOTA, type ValoriScheda } from "./CampiScheda"
import { numeroDa, useAggiornaCatalogo, useAziende, useCategorie, useCollezioni } from "./dati"
import { GalleriaFoto } from "./GalleriaFoto"
import { RigheTaglie, variantiDa, type Taglie } from "./RigheTaglie"

export function NuovoProdotto({ onChiudi }: { onChiudi: () => void }) {
  const naviga = useNavigate()
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
  const [scheda, setScheda] = useState<ValoriScheda>(SCHEDA_VUOTA)
  const [taglie, setTaglie] = useState<Taglie>({ codice: "", taglie: "S, M, L", dettagli: {} })
  const [foto, setFoto] = useState<{ url: string }[]>([])
  const [occupato, setOccupato] = useState(false)
  const [seoTitolo, setSeoTitolo] = useState("")
  const [seoDescrizione, setSeoDescrizione] = useState("")

  const conScorte = puo("inventory_items", "edit") && Boolean(azienda)
  const crea = useMutation({
    mutationFn: (stato: "draft" | "published") =>
      api<{ prodotto: { id: string } }>("/admin/catalogo/prodotti", {
        corpo: {
          ...corpoScheda(scheda, puo("margini", "view")),
          titolo,
          descrizione,
          stato,
          foto,
          azienda_id: azienda || null,
          collezione_id: collezione || null,
          prezzo_vendita: azienda ? numeroDa(prezzo) : null,
          seo_titolo: seoTitolo,
          seo_descrizione: seoDescrizione,
          varianti: variantiDa(taglie).map((v) => ({ ...v, quantita: conScorte ? v.quantita : null })),
        },
      }),
    onSuccess: ({ prodotto }) => {
      avvisa("Product created")
      aggiorna()
      naviga(`/prodotti/catalogo/${prodotto.id}`)
    },
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    crea.mutate("draft")
  }

  return (
    <Modale titolo="New product" sottotitolo="It starts as a draft: you decide when it goes on sale." onChiudi={onChiudi}>
      <form className="modulo" onSubmit={invia}>
        <Campo etichetta="Product name">
          <input required value={titolo} onChange={(e) => setTitolo(e.target.value)} />
        </Campo>
        <Campo etichetta="Description">
          <textarea rows={3} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
        </Campo>
        <div className="griglia-due">
          <Campo etichetta="Company" aiuto="Without a company there is no price or stock">
            <select value={azienda} onChange={(e) => setAzienda(e.target.value)}>
              <option value="">No company</option>
              {(aziende.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </Campo>
          {collezioni.data ? (
            <Campo etichetta="Collection">
              <select value={collezione} onChange={(e) => setCollezione(e.target.value)}>
                <option value="">No collection</option>
                {collezioni.data.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </Campo>
          ) : null}
        </div>
        <CampiScheda valori={scheda} categorie={categorie.data ?? []} onCambia={setScheda} conCessione={puo("margini", "view") && Boolean(azienda)} conConsigliato={Boolean(azienda)} />
        {azienda ? (
          <Campo etichetta="Selling price">
            <input type="number" min="0" step="0.01" inputMode="decimal" value={prezzo} onChange={(e) => setPrezzo(e.target.value)} />
          </Campo>
        ) : null}
        <div className="griglia-due">
          <Campo etichetta="Item code">
            <input required value={taglie.codice} onChange={(e) => setTaglie({ ...taglie, codice: e.target.value })} />
          </Campo>
          <Campo etichetta="Sizes" aiuto="Separated by commas">
            <input required value={taglie.taglie} onChange={(e) => setTaglie({ ...taglie, taglie: e.target.value })} />
          </Campo>
        </div>
        <RigheTaglie valore={taglie} onCambia={setTaglie} conQuantita={conScorte} />
        <GalleriaFoto radice="/admin" foto={foto} onCambia={setFoto} onCaricamento={setOccupato} />
        <details className="apertura">
          <summary>Search engine text</summary>
          <div className="modulo">
            <Campo etichetta="Search title">
              <input value={seoTitolo} onChange={(e) => setSeoTitolo(e.target.value)} />
            </Campo>
            <Campo etichetta="Search summary">
              <textarea rows={2} value={seoDescrizione} onChange={(e) => setSeoDescrizione(e.target.value)} />
            </Campo>
          </div>
        </details>
        {crea.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{crea.error.message}</p> : null}
        <div className="riga__azioni">
          <button type="submit" className="primario" disabled={crea.isPending || occupato}>{crea.isPending ? "Saving..." : "Save as draft"}</button>
          <button type="button" disabled={crea.isPending || occupato || !titolo.trim() || !taglie.codice.trim()} onClick={() => crea.mutate("published")}>Put on sale</button>
        </div>
      </form>
    </Modale>
  )
}
