import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Trash2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import { api, ErroreApi } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { numero } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Campo, Conferma, euro, Stato } from "../../ui"
import { Cassetto, EtichettaSezione, FotoProdotto } from "./comuni"
import { useAggiornaCatalogo, useCatalogo } from "./dati"
import type { Collezione } from "./tipi"

const MASSIMO_PRODOTTI = 200
const ATTESA_DIGITAZIONE = 350
const ISTRUZIONE = "Tick the products that belong here"

type Modifica = { title?: string; metadata?: { descrizione: string | null } }

/** Niente pulsante di salvataggio: nome, descrizione e spunte si scrivono mentre si cambiano. */
export default function SchedaCollezione() {
  const { id = "" } = useParams()
  const naviga = useNavigate()
  const { puo } = usePermessi()
  const { avvisa, segnalaErrore } = useAvvisi()
  const client = useQueryClient()
  const aggiorna = useAggiornaCatalogo()
  const [titolo, setTitolo] = useState("")
  const [descrizione, setDescrizione] = useState("")
  const [spuntati, setSpuntati] = useState<Set<string>>(new Set())
  const [conferma, setConferma] = useState(false)
  const intestazione = useRef<string | null>(null)
  const inAttesa = useRef<Modifica | null>(null)
  const attesa = useRef<ReturnType<typeof setTimeout>>()

  const collezione = useQuery({
    queryKey: ["collezione", id],
    queryFn: () => api<{ collection: Collezione }>(`/admin/collections/${id}?fields=id,title,handle,created_at,metadata`),
    refetchInterval: false,
  })
  const dati = collezione.data?.collection
  const catalogo = useCatalogo({ limit: MASSIMO_PRODOTTI })
  const prodotti = (catalogo.data?.prodotti ?? []).filter((p) => p.stato !== "archived")
  const puoModificare = puo("product_collections", "edit")

  useEffect(() => {
    if (!dati || intestazione.current !== null) return
    intestazione.current = dati.title
    setTitolo(dati.title)
    setDescrizione(dati.metadata?.descrizione ?? "")
  }, [dati])

  useEffect(() => {
    setSpuntati(new Set((catalogo.data?.prodotti ?? []).filter((p) => p.collezione?.id === id).map((p) => p.id)))
  }, [catalogo.data, id])

  const rinfresca = useCallback(() => {
    aggiorna()
    void client.invalidateQueries({ queryKey: ["collezioni-carte"] })
    void client.invalidateQueries({ queryKey: ["collezione", id] })
  }, [aggiorna, client, id])
  const chiudi = useCallback(() => naviga("/prodotti/collezioni"), [naviga])

  const scrivi = useCallback(() => {
    clearTimeout(attesa.current)
    const corpo = inAttesa.current
    if (!corpo) return
    inAttesa.current = null
    api(`/admin/collections/${id}`, { corpo }).then(rinfresca).catch(segnalaErrore)
  }, [id, rinfresca, segnalaErrore])
  // Chiudere il cassetto mentre si scrive non deve perdere le ultime lettere.
  useEffect(() => scrivi, [scrivi])

  const programma = (parte: Modifica) => {
    inAttesa.current = { ...inAttesa.current, ...parte }
    clearTimeout(attesa.current)
    attesa.current = setTimeout(scrivi, ATTESA_DIGITAZIONE)
  }
  const cambiaTitolo = (testo: string) => {
    setTitolo(testo)
    // Medusa non accetta un nome vuoto: resta l'ultimo valido finché non se ne scrive un altro.
    if (testo.trim()) programma({ title: testo.trim() })
  }
  const cambiaDescrizione = (testo: string) => {
    setDescrizione(testo)
    programma({ metadata: { descrizione: testo.trim() || null } })
  }

  const spunta = useMutation({
    mutationFn: ({ prodotto, attivo }: { prodotto: string; attivo: boolean }) => api(`/admin/collections/${id}/products`, { corpo: attivo ? { add: [prodotto] } : { remove: [prodotto] } }),
    onSuccess: rinfresca,
    onError: segnalaErrore,
  })
  const elimina = useMutation({
    mutationFn: () => api(`/admin/collections/${id}`, { metodo: "DELETE" }),
    onSuccess: () => {
      inAttesa.current = null
      avvisa("Collection deleted")
      rinfresca()
      chiudi()
    },
    onError: segnalaErrore,
  })

  const cambia = (prodotto: string) => {
    const attivo = !spuntati.has(prodotto)
    const nuovi = new Set(spuntati)
    if (attivo) nuovi.add(prodotto)
    else nuovi.delete(prodotto)
    setSpuntati(nuovi)
    spunta.mutate({ prodotto, attivo })
  }

  if (collezione.error instanceof ErroreApi && collezione.error.stato === 404) return <Navigate to="/prodotti/collezioni" replace />
  if (!dati) {
    return (
      <Cassetto titolo="Collection" onChiudi={chiudi}>
        <Stato caricamento={collezione.isLoading} errore={collezione.error} vuoto={false} testoVuoto="" />
      </Cassetto>
    )
  }

  return (
    <>
      <Cassetto
        titolo={intestazione.current ?? dati.title}
        sottotitolo={ISTRUZIONE}
        onChiudi={chiudi}
        bloccato={conferma}
        piede={puo("product_collections", "manage") ? <button type="button" className="pericolo" onClick={() => setConferma(true)}><Trash2 size={16} aria-hidden="true" /> Delete</button> : undefined}
      >
        <div className="modulo">
          <Campo etichetta="Name">
            <input disabled={!puoModificare} value={titolo} onChange={(e) => cambiaTitolo(e.target.value)} />
          </Campo>
          <Campo etichetta="Description">
            <input disabled={!puoModificare} placeholder="Describe what ties these together" value={descrizione} onChange={(e) => cambiaDescrizione(e.target.value)} />
          </Campo>
        </div>
        <EtichettaSezione>Products · {numero(spuntati.size)}</EtichettaSezione>
        <Stato caricamento={catalogo.isLoading} errore={catalogo.error} vuoto={false} testoVuoto="" />
        <ul className="righe-spunta">
          {prodotti.map((p) => {
            const attivo = spuntati.has(p.id)
            return (
              <li key={p.id}>
                <button type="button" role="checkbox" aria-checked={attivo} aria-label={`${p.titolo} in ${titolo || dati.title}`} className="spunta" disabled={!puoModificare} onClick={() => cambia(p.id)}>
                  {attivo ? <Check size={14} aria-hidden="true" /> : null}
                </button>
                <FotoProdotto url={p.foto} titolo={p.titolo} tinta={p.tinta} classe="foto-piccola" />
                <span className="righe-spunta__testo">
                  <b>{p.titolo}</b>
                  <small>{p.categorie[0]?.nome ?? "No category"}</small>
                </span>
                <span className="righe-spunta__prezzo">{p.prezzo_min === null ? "–" : euro(p.prezzo_min)}</span>
              </li>
            )
          })}
        </ul>
      </Cassetto>

      {conferma ? (
        <Conferma
          titolo="Delete this collection?"
          testo={`“${dati.title}” will go; its products stay in the catalogue.`}
          azione="Delete"
          attesa={elimina.isPending}
          onConferma={() => elimina.mutate()}
          onChiudi={() => setConferma(false)}
        />
      ) : null}
    </>
  )
}
