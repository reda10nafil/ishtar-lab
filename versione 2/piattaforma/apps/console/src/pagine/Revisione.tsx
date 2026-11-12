import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Link } from "react-router-dom"
import { api } from "../api/client"
import type { ModificaProdotto } from "../api/tipi"
import { usePermessi } from "../permessi"
import { ModaleDecisione } from "../sezioni/prodotti/ModaleDecisione"
import type { PropostaPrezzi, RispostaCatalogo } from "../sezioni/prodotti/tipi"
import { Anteprima, euro, Pagina, Stato } from "../ui"
import "../sezioni/prodotti/prodotti.css"

type Nuovo = RispostaCatalogo["prodotti"][number]
type Decisione = { prodotto: Nuovo; verbo: "reject" | "request-changes" }
type ModificaConAzioni = ModificaProdotto & { actions?: { action: string; details?: { field?: string } }[] }

const NOMI_CAMPI: Record<string, string> = {
  title: "name",
  subtitle: "subtitle",
  description: "description",
  thumbnail: "cover",
  images: "photos",
  material: "composition",
  weight: "weight",
  categories: "category",
  metadata: "sheet details",
}

function campiCambiati(m: ModificaConAzioni) {
  const nomi = (m.actions ?? []).map((a) => (a.details?.field ? NOMI_CAMPI[a.details.field] ?? "other details" : a.action.startsWith("VARIANT") ? "variants" : null))
  return [...new Set(nomi.filter(Boolean))].join(", ")
}

const descrizioneNuovo = (p: Nuovo) =>
  [p.aziende[0]?.nome, p.categorie[0]?.nome, p.taglie.length ? `Sizes: ${p.taglie.join(", ")}` : null].filter(Boolean).join(" · ") || "No details"

function prezziNuovo(p: Nuovo) {
  const voci = [p.prezzo_cessione === null || p.prezzo_cessione === undefined ? null : `Supply ${euro(p.prezzo_cessione)}`, p.prezzo_consigliato === null || p.prezzo_consigliato === undefined ? null : `Suggested ${euro(p.prezzo_consigliato)}`]
  return voci.filter(Boolean).join(" · ") || "No prices yet"
}

export default function Revisione() {
  const client = useQueryClient()
  const { puo } = usePermessi()
  const [decisione, setDecisione] = useState<Decisione | null>(null)
  const nuovi = useQuery({
    queryKey: ["revisione", "prodotti"],
    queryFn: () => api<RispostaCatalogo>("/admin/catalogo/prodotti?stato=proposed&limit=100"),
  })
  const modifiche = useQuery({
    queryKey: ["modifiche"],
    queryFn: () => api<{ product_changes: ModificaConAzioni[] }>("/admin/product-changes?limit=100"),
  })
  const proposte = useQuery({
    queryKey: ["revisione", "prezzi"],
    queryFn: () => api<{ proposte: PropostaPrezzi[] }>("/admin/catalogo/proposte"),
  })
  const aggiorna = () => {
    void client.invalidateQueries({ queryKey: ["revisione"] })
    void client.invalidateQueries({ queryKey: ["modifiche"] })
    void client.invalidateQueries({ queryKey: ["catalogo"] })
  }
  const prodotto = useMutation({
    mutationFn: ({ id, verbo, message }: { id: string; verbo: string; message?: string }) =>
      api(`/admin/products/${id}/${verbo}`, { corpo: message ? { message } : {} }),
    onSuccess: () => {
      aggiorna()
      setDecisione(null)
    },
  })
  const modifica = useMutation({
    mutationFn: ({ id, verbo }: { id: string; verbo: "confirm" | "cancel" }) => api(`/admin/product-changes/${id}/${verbo}`, { corpo: {} }),
    onSuccess: aggiorna,
  })
  const prezzi = useMutation({
    mutationFn: ({ proposta, esito }: { proposta: PropostaPrezzi; esito: "approva" | "rifiuta" }) =>
      api("/admin/catalogo/proposte", { corpo: { prodotto_id: proposta.prodotto_id, azienda_id: proposta.azienda_id, esito } }),
    onSuccess: aggiorna,
  })

  const elencoNuovi = nuovi.data?.prodotti ?? []
  const inAttesa = (modifiche.data?.product_changes ?? []).filter((m) => m.status === "pending" && m.type !== "new_product")
  const elencoPrezzi = proposte.data?.proposte ?? []
  const errore = prodotto.error ?? modifica.error ?? prezzi.error
  const conMargini = puo("margini", "view")

  return (
    <Pagina titolo="Review" sottotitolo="Nothing goes live without your approval.">
      {errore ? <p className="avviso-stato avviso-stato--errore" role="alert">{errore.message}</p> : null}

      <h2 className="sezione">New products <span>{elencoNuovi.length}</span></h2>
      <Stato caricamento={nuovi.isLoading} errore={nuovi.error} vuoto={!elencoNuovi.length} testoVuoto="No products to approve." />
      <ul className="elenco">
        {elencoNuovi.map((p) => (
          <li key={p.id} className="riga vetro">
            <Anteprima url={p.foto} titolo={p.titolo} />
            <div className="riga__testo">
              <strong><Link to={`/prodotti/catalogo/${p.id}`}>{p.titolo}</Link></strong>
              <small>{descrizioneNuovo(p)}</small>
              <small>{prezziNuovo(p)}</small>
            </div>
            <div className="riga__azioni">
              <button type="button" className="primario" disabled={prodotto.isPending} onClick={() => prodotto.mutate({ id: p.id, verbo: "confirm" })}>Approve</button>
              <button type="button" onClick={() => setDecisione({ prodotto: p, verbo: "request-changes" })}>Request changes</button>
              <button type="button" onClick={() => setDecisione({ prodotto: p, verbo: "reject" })}>Reject</button>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="sezione">Requested changes <span>{inAttesa.length}</span></h2>
      <Stato caricamento={modifiche.isLoading} errore={modifiche.error} vuoto={!inAttesa.length} testoVuoto="No changes waiting." />
      <ul className="elenco">
        {inAttesa.map((m) => {
          const campi = campiCambiati(m)
          return (
            <li key={m.id} className="riga vetro">
              <Anteprima url={m.product_thumbnail} titolo={m.product_title} />
              <div className="riga__testo">
                <strong><Link to={`/prodotti/catalogo/${m.product_id}`}>{m.product_title}</Link></strong>
                <small>{m.seller_name ?? "Company"}{campi ? ` · Changes: ${campi}` : ""}</small>
              </div>
              <div className="riga__azioni">
                <button type="button" className="primario" disabled={modifica.isPending} onClick={() => modifica.mutate({ id: m.id, verbo: "confirm" })}>Approve</button>
                <button type="button" disabled={modifica.isPending} onClick={() => modifica.mutate({ id: m.id, verbo: "cancel" })}>Dismiss</button>
              </div>
            </li>
          )
        })}
      </ul>

      <h2 className="sezione">Price proposals <span>{elencoPrezzi.length}</span></h2>
      <Stato caricamento={proposte.isLoading} errore={proposte.error} vuoto={!elencoPrezzi.length} testoVuoto="No prices waiting." />
      <ul className="elenco">
        {elencoPrezzi.map((p) => (
          <li key={`${p.prodotto_id}-${p.azienda_id}`} className="riga vetro">
            <Anteprima url={p.foto} titolo={p.titolo} />
            <div className="riga__testo">
              <strong><Link to={`/prodotti/catalogo/${p.prodotto_id}`}>{p.titolo}</Link></strong>
              <small>{p.azienda}</small>
              <span className="prezzi-confronto">
                {conMargini ? <span>Supply: {euro(p.attuale.prezzo_cessione)} → {euro(p.proposta?.prezzo_cessione)}</span> : null}
                <span>Suggested: {euro(p.attuale.prezzo_consigliato)} → {euro(p.proposta?.prezzo_consigliato)}</span>
              </span>
            </div>
            <div className="riga__azioni">
              <button type="button" className="primario" disabled={prezzi.isPending} onClick={() => prezzi.mutate({ proposta: p, esito: "approva" })}>Approve</button>
              <button type="button" disabled={prezzi.isPending} onClick={() => prezzi.mutate({ proposta: p, esito: "rifiuta" })}>Reject</button>
            </div>
          </li>
        ))}
      </ul>

      {decisione ? (
        <ModaleDecisione
          titolo={decisione.prodotto.titolo}
          rifiuto={decisione.verbo === "reject"}
          attesa={prodotto.isPending}
          onChiudi={() => setDecisione(null)}
          onInvia={(message) => prodotto.mutate({ id: decisione.prodotto.id, verbo: decisione.verbo, message })}
        />
      ) : null}
    </Pagina>
  )
}
