import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, BarChart3, Plus, RotateCcw } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { api } from "../../api/client"
import { Riquadro, useAvvisi, Vuoto } from "../../componenti"
import { numero, percentuale } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Campo, Conferma, dataOra, euro, Pagina } from "../../ui"
import Capi from "./Capi"
import { chiaveCapo, EtichettaStato } from "./comuni"
import Margine from "./Margine"
import Prezzo from "./Prezzo"
import ScegliCapo from "./ScegliCapo"
import Tela, { dentroTela } from "./Tela"
import type { Composizione, Outfit, PezzoTela, Posto, Sorgente, StatoOutfit } from "./tipi"
import { useComposizione, type Esito } from "./useComposizione"

const TESTI_ESITO: Record<Esito, string> = { salvato: "All changes saved", in_corso: "Saving...", errore: "Not saved" }

const NOTA_STATO: Record<StatoOutfit, string> = {
  bozza: "",
  pubblicato: "A published outfit cannot be edited: move it back to draft to change it.",
  archiviato: "An archived outfit cannot be edited: move it back to draft to change it.",
}

/** I capi nuovi si aprono a ventaglio, così non finiscono uno sopra l'altro. */
function nuovoPosto(voce: Sorgente, capi: Posto[]): Posto {
  const passo = capi.length % 6
  const larghezza = 42
  return {
    product_id: voce.product_id,
    azienda_id: voce.azienda_id,
    alternativa_product_id: null,
    alternativa_azienda_id: null,
    ...dentroTela(6 + passo * 9, 6 + passo * 11, larghezza),
    larghezza,
    livello: capi.length + 1,
  }
}

function riordina(capi: Posto[], chiave: string, verso: "avanti" | "indietro"): Posto[] {
  const scelto = capi.find((p) => chiaveCapo(p) === chiave)
  if (!scelto) return capi
  const altri = capi.filter((p) => p !== scelto).sort((a, b) => a.livello - b.livello)
  const ordine = verso === "avanti" ? [...altri, scelto] : [scelto, ...altri]
  const livelli = new Map(ordine.map((p, indice) => [chiaveCapo(p), indice + 1]))
  return capi.map((p) => ({ ...p, livello: livelli.get(chiaveCapo(p)) ?? p.livello }))
}

/** I tre numeri da leggere a colpo d'occhio. Il margine c'è solo se il server lo manda. */
function Tessere({ outfit }: { outfit: Outfit }) {
  const { prezzo, economia, capi } = outfit
  return (
    <dl className="outfit-tessere">
      <div>
        <dt>Customer price</dt>
        <dd>{prezzo.finale === null ? "–" : euro(prezzo.finale)}</dd>
      </div>
      {economia ? (
        <div>
          <dt>Margin</dt>
          <dd>{economia.margine_percentuale === null ? "–" : percentuale(economia.margine_percentuale)}</dd>
        </div>
      ) : null}
      <div>
        <dt>Pieces</dt>
        <dd>{numero(capi.length)}</dd>
      </div>
    </dl>
  )
}

function AzioniStato({ outfit, attesa, onStato, onElimina }: { outfit: Outfit; attesa: boolean; onStato: (stato: StatoOutfit) => void; onElimina: () => void }) {
  const { stato } = outfit
  return (
    <div className="riga__azioni">
      {stato === "bozza" ? <button type="button" className="primario" disabled={attesa} onClick={() => onStato("pubblicato")}>Publish</button> : null}
      {stato !== "bozza" ? <button type="button" disabled={attesa} onClick={() => onStato("bozza")}>Back to draft</button> : null}
      {stato !== "archiviato" ? <button type="button" disabled={attesa} onClick={() => onStato("archiviato")}>Archive</button> : null}
      {stato !== "pubblicato" ? <button type="button" className="pericolo" disabled={attesa} onClick={onElimina}>Delete</button> : null}
    </div>
  )
}

function Dettagli({ composizione, modificabile, onCambia }: { composizione: Composizione; modificabile: boolean; onCambia: (modifica: Partial<Composizione>) => void }) {
  // Il nome resta com'è scritto: mentre lo si riscrive il campo può essere vuoto, ma vuoto non si salva.
  const [nome, setNome] = useState(composizione.nome)
  useEffect(() => {
    if (composizione.nome.trim() !== nome.trim()) setNome(composizione.nome)
    // Solo un cambiamento arrivato dal server riscrive il campo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composizione.nome])

  return (
    <Riquadro titolo="Details">
      <div className="modulo">
        <Campo etichetta="Outfit name">
          <input
            required
            maxLength={120}
            value={nome}
            disabled={!modificabile}
            onChange={(e) => {
              setNome(e.target.value)
              if (e.target.value.trim()) onCambia({ nome: e.target.value })
            }}
            onBlur={() => !nome.trim() && setNome(composizione.nome)}
          />
        </Campo>
        <Campo etichetta="Description">
          <textarea rows={3} maxLength={2000} value={composizione.descrizione ?? ""} disabled={!modificabile} onChange={(e) => onCambia({ descrizione: e.target.value || null })} />
        </Campo>
      </div>
    </Riquadro>
  )
}

export default function Editor() {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const client = useQueryClient()
  const { puo } = usePermessi()
  const { avvisa, segnalaErrore } = useAvvisi()
  const { vista, caricamento, errore, locale, esito, cambia, salvaOra, riprova } = useComposizione(id)

  const [selezionato, setSelezionato] = useState<string | null>(null)
  const [scelta, setScelta] = useState<{ alternativaDi: string | null } | null>(null)
  const [elimina, setElimina] = useState(false)

  const cambiaStato = useMutation({
    mutationFn: async (stato: StatoOutfit) => {
      await salvaOra()
      return api<{ outfit: Outfit }>(`/admin/outfit/${id}/stato`, { corpo: { stato } })
    },
    onSuccess: ({ outfit }) => {
      client.setQueryData(["outfit", id], outfit)
      void client.invalidateQueries({ queryKey: ["outfit-elenco"] })
      avvisa(outfit.stato === "pubblicato" ? "Outfit published" : outfit.stato === "archiviato" ? "Outfit archived" : "Outfit moved back to draft")
    },
    onError: segnalaErrore,
  })

  const eliminaOutfit = useMutation({
    mutationFn: () => api(`/admin/outfit/${id}`, { metodo: "DELETE" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["outfit-elenco"] })
      avvisa("Outfit deleted")
      navigate("/outfit")
    },
    onError: (e) => {
      setElimina(false)
      segnalaErrore(e)
    },
  })

  if (caricamento) return <p className="avviso-stato">Loading...</p>
  if (errore) return <p className="avviso-stato avviso-stato--errore" role="alert">{(errore as Error).message}</p>
  if (!vista || !locale) return null

  const modificabile = puo("outfit", "edit") && vista.stato === "bozza"
  const puoGestire = puo("outfit", "manage")

  const pezzi: PezzoTela[] = locale.capi.flatMap((posto) => {
    const chiave = chiaveCapo(posto)
    const capo = vista.capi.find((c) => chiaveCapo(c) === chiave)
    return capo ? [{ ...posto, chiave, titolo: capo.titolo, foto: capo.foto }] : []
  })

  const modificaCampi = (modifica: Partial<Composizione>) => cambia((c) => ({ ...c, ...modifica }))
  const modificaPosto = (chiave: string, modifica: Partial<Posto>, subito = false) =>
    cambia((c) => ({ ...c, capi: c.capi.map((p) => (chiaveCapo(p) === chiave ? { ...p, ...modifica } : p)) }), subito)

  const togli = (chiave: string) => {
    setSelezionato(null)
    cambia((c) => ({ ...c, capi: c.capi.filter((p) => chiaveCapo(p) !== chiave) }), true)
  }

  const scegli = (voce: Sorgente) => {
    const alternativaDi = scelta?.alternativaDi
    setScelta(null)
    if (alternativaDi) {
      modificaPosto(alternativaDi, { alternativa_product_id: voce.product_id, alternativa_azienda_id: voce.azienda_id }, true)
      return
    }
    cambia((c) => ({ ...c, capi: [...c.capi, nuovoPosto(voce, c.capi)] }), true)
    setSelezionato(chiaveCapo(voce))
  }

  const attesa = cambiaStato.isPending || eliminaOutfit.isPending
  const nota = NOTA_STATO[vista.stato]

  return (
    <Pagina
      titolo={locale.nome}
      sottotitolo={vista.pubblicato_il ? `Published on ${dataOra(vista.pubblicato_il)}` : "Pick the pieces, arrange them on the canvas and set the price."}
      azioni={puoGestire ? <AzioniStato outfit={vista} attesa={attesa} onStato={(s) => cambiaStato.mutate(s)} onElimina={() => setElimina(true)} /> : undefined}
    >
      <div className="studio__barra">
        <Link to="/outfit" className="studio__indietro"><ArrowLeft size={17} aria-hidden="true" /> All outfits</Link>
        <EtichettaStato stato={vista.stato} />
        {modificabile ? (
          <span className={`studio__esito studio__esito--${esito}`} role="status">
            {TESTI_ESITO[esito]}
            {esito === "errore" ? <button type="button" className="studio__riprova" onClick={riprova}><RotateCcw size={15} aria-hidden="true" /> Retry</button> : null}
          </span>
        ) : null}
      </div>
      {nota ? <p className="avviso-stato">{nota}</p> : null}

      <div className="studio">
        <div className="studio__colonna">
          <Riquadro
            titolo="Canvas"
            testo={modificabile ? "Drag the pieces, with a finger too. The customer will choose a size for each." : "How the outfit is composed."}
            azioni={modificabile ? <button type="button" className="primario" onClick={() => setScelta({ alternativaDi: null })}><Plus size={18} aria-hidden="true" /> Add piece</button> : undefined}
          >
            <Tela
              pezzi={pezzi}
              selezionato={selezionato}
              modificabile={modificabile}
              onSeleziona={setSelezionato}
              onModifica={(chiave, modifica) => modificaPosto(chiave, modifica)}
              onLivello={(chiave, verso) => cambia((c) => ({ ...c, capi: riordina(c.capi, chiave, verso) }))}
              onTogli={togli}
            />
          </Riquadro>
          <div className="studio__risultati">
            <Riquadro titolo="Results" testo="Views, sales, replaced pieces and revenue for this outfit.">
              <Vuoto icona={BarChart3} titolo="No data yet" testo="The shop is not online: views and sales will appear here with the first real orders." />
            </Riquadro>
          </div>
        </div>

        <div className="studio__colonna">
          <Tessere outfit={vista} />
          <Capi
            capi={vista.capi}
            disponibilita={vista.disponibilita}
            modificabile={modificabile}
            selezionato={selezionato}
            onSeleziona={setSelezionato}
            onAlternativa={(chiave) => setScelta({ alternativaDi: chiave })}
            onTogliAlternativa={(chiave) => modificaPosto(chiave, { alternativa_product_id: null, alternativa_azienda_id: null }, true)}
          />
          <Prezzo composizione={locale} prezzo={vista.prezzo} modificabile={modificabile} onCambia={modificaCampi} />
          {vista.economia ? <Margine economia={vista.economia} /> : null}
          <Dettagli composizione={locale} modificabile={modificabile} onCambia={modificaCampi} />
        </div>
      </div>

      {scelta ? (
        <ScegliCapo
          titolo={scelta.alternativaDi ? "Choose the alternative" : "Add a piece"}
          testo={scelta.alternativaDi ? "It takes the place of the piece if that sells out, at its own price." : "Approved products only, with the company selling them."}
          esclusi={locale.capi.map(chiaveCapo)}
          onScegli={scegli}
          onChiudi={() => setScelta(null)}
        />
      ) : null}

      {elimina ? (
        <Conferma
          titolo="Delete this outfit?"
          testo="The outfit is gone for good. The products stay in the catalogue."
          azione="Delete"
          attesa={eliminaOutfit.isPending}
          onConferma={() => eliminaOutfit.mutate()}
          onChiudi={() => setElimina(false)}
        />
      ) : null}
    </Pagina>
  )
}
