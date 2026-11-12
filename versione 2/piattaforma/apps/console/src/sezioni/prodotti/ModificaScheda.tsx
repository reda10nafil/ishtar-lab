import { useMutation } from "@tanstack/react-query"
import { useState, type FormEvent } from "react"
import { api } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { Campo, Modale } from "../../ui"
import { CampiScheda, corpoScheda, valoriDa, type ValoriScheda } from "./CampiScheda"
import { ScegliTinta } from "./comuni"
import { useAggiornaCatalogo, useCategorie, useCollezioni } from "./dati"
import { GalleriaFoto } from "./GalleriaFoto"
import type { SchedaProdotto } from "./tipi"

/** Modifica testi, foto e dati della scheda con la rotta nativa: prezzi e varianti hanno la loro finestra. */
export function ModificaScheda({ scheda, onChiudi }: { scheda: SchedaProdotto; onChiudi: () => void }) {
  const { avvisa } = useAvvisi()
  const aggiorna = useAggiornaCatalogo()
  const categorie = useCategorie()
  const collezioni = useCollezioni()
  const [titolo, setTitolo] = useState(scheda.titolo)
  const [descrizione, setDescrizione] = useState(scheda.descrizione ?? "")
  const [collezione, setCollezione] = useState(scheda.collezione?.id ?? "")
  const [valori, setValori] = useState<ValoriScheda>(valoriDa(scheda))
  const [foto, setFoto] = useState<{ url: string }[]>(scheda.foto.map((f) => ({ url: f.url })))
  const [occupato, setOccupato] = useState(false)
  const [tinta, setTinta] = useState(scheda.tinta ?? 0)
  const [seoTitolo, setSeoTitolo] = useState(scheda.seo_titolo ?? "")
  const [seoDescrizione, setSeoDescrizione] = useState(scheda.seo_descrizione ?? "")

  const salva = useMutation({
    mutationFn: () => {
      const { categoria_id, brand, stagione, genere, composizione, cura, peso } = corpoScheda(valori, false)
      return api(`/admin/products/${scheda.id}`, {
        corpo: {
          title: titolo.trim(),
          description: descrizione.trim() || null,
          categories: categoria_id ? [{ id: categoria_id }] : [],
          images: foto,
          thumbnail: foto[0]?.url ?? null,
          weight: peso,
          material: composizione,
          ...(collezioni.data ? { collection_id: collezione || null } : {}),
          metadata: { brand, stagione, genere, cura, tinta, seo_titolo: seoTitolo.trim() || null, seo_descrizione: seoDescrizione.trim() || null },
        },
      })
    },
    onSuccess: () => {
      avvisa("Changes saved")
      aggiorna(scheda.id)
      onChiudi()
    },
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    salva.mutate()
  }

  return (
    <Modale titolo="Edit product" sottotitolo={scheda.titolo} onChiudi={onChiudi}>
      <form className="modulo modulo-prodotto" onSubmit={invia}>
        <Campo etichetta="Product name">
          <input required value={titolo} onChange={(e) => setTitolo(e.target.value)} />
        </Campo>
        <Campo etichetta="Description">
          <textarea rows={4} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
        </Campo>
        {collezioni.data ? (
          <Campo etichetta="Collection">
            <select value={collezione} onChange={(e) => setCollezione(e.target.value)}>
              <option value="">No collection</option>
              {collezioni.data.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </Campo>
        ) : null}
        <CampiScheda valori={valori} categorie={categorie.data ?? []} onCambia={setValori} conCessione={false} conConsigliato={false} />
        <ScegliTinta valore={tinta} onCambia={setTinta} />
        <GalleriaFoto radice="/admin" foto={foto} onCambia={setFoto} onCaricamento={setOccupato} />
        <Campo etichetta="Search title">
          <input value={seoTitolo} onChange={(e) => setSeoTitolo(e.target.value)} />
        </Campo>
        <Campo etichetta="Search summary">
          <textarea rows={2} value={seoDescrizione} onChange={(e) => setSeoDescrizione(e.target.value)} />
        </Campo>
        {salva.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{salva.error.message}</p> : null}
        <button type="submit" className="primario" disabled={salva.isPending || occupato}>{salva.isPending ? "Saving..." : "Save changes"}</button>
      </form>
    </Modale>
  )
}
