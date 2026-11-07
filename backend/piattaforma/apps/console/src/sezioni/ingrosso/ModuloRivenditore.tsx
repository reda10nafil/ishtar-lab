import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, type FormEvent } from "react"
import { api } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { usePermessi } from "../../permessi"
import { Campo, Conferma, Modale } from "../../ui"
import { PAESI, PAGAMENTI, numeroDa } from "./testi"
import type { Rivenditore } from "./tipi"

const testo = (valore: string | number | null | undefined) => (valore === null || valore === undefined ? "" : String(valore))

export function ModuloRivenditore({ rivenditore, onChiudi }: { rivenditore?: Rivenditore; onChiudi: () => void }) {
  const client = useQueryClient()
  const { avvisa, segnalaErrore } = useAvvisi()
  const { puo } = usePermessi()
  const [eliminando, setEliminando] = useState(false)
  const [dati, setDati] = useState({
    nome: testo(rivenditore?.nome),
    referente: testo(rivenditore?.referente),
    email: testo(rivenditore?.email),
    telefono: testo(rivenditore?.telefono),
    partita_iva: testo(rivenditore?.partita_iva),
    indirizzo: testo(rivenditore?.indirizzo),
    citta: testo(rivenditore?.citta),
    cap: testo(rivenditore?.cap),
    paese: rivenditore?.paese ?? "it",
    condizione: rivenditore?.condizione ?? ("sconto" as Rivenditore["condizione"]),
    listino: testo(rivenditore?.listino),
    sconto: testo(rivenditore?.sconto_percentuale),
    pagamento: testo(rivenditore?.pagamento),
    minimo: testo(rivenditore?.ordine_minimo),
    appunti: testo(rivenditore?.appunti),
  })
  const aggiorna = (chiave: keyof typeof dati) => (e: { target: { value: string } }) => setDati({ ...dati, [chiave]: e.target.value })
  const aggiornaElenco = () => client.invalidateQueries({ queryKey: ["ingrosso"] })

  const salva = useMutation({
    mutationFn: () =>
      api<{ rivenditore: Rivenditore }>(rivenditore ? `/admin/ingrosso/rivenditori/${rivenditore.id}` : "/admin/ingrosso/rivenditori", {
        corpo: {
          nome: dati.nome,
          referente: dati.referente,
          email: dati.email,
          telefono: dati.telefono,
          partita_iva: dati.partita_iva,
          indirizzo: dati.indirizzo,
          citta: dati.citta,
          cap: dati.cap,
          paese: dati.paese,
          condizione: dati.condizione,
          listino: dati.condizione === "listino" ? dati.listino : null,
          sconto_percentuale: dati.condizione === "sconto" ? numeroDa(dati.sconto) : null,
          pagamento: dati.pagamento,
          ordine_minimo: numeroDa(dati.minimo),
          appunti: dati.appunti,
        },
      }),
    onSuccess: () => {
      void aggiornaElenco()
      avvisa(rivenditore ? "Stockist updated" : "Stockist created")
      onChiudi()
    },
  })
  const elimina = useMutation({
    mutationFn: () => api(`/admin/ingrosso/rivenditori/${rivenditore?.id}`, { metodo: "DELETE" }),
    onSuccess: () => {
      void aggiornaElenco()
      avvisa("Stockist deleted")
      onChiudi()
    },
    onError: (errore) => {
      segnalaErrore(errore)
      setEliminando(false)
    },
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    salva.mutate()
  }

  // Una finestra alla volta: dentro il vetro una seconda finestra resterebbe intrappolata.
  if (eliminando) {
    return <Conferma titolo={`Delete ${rivenditore?.nome}?`} testo="You can only delete a stockist with no deals." azione="Delete" attesa={elimina.isPending} onConferma={() => elimina.mutate()} onChiudi={() => setEliminando(false)} />
  }

  return (
    <Modale titolo={rivenditore ? rivenditore.nome : "New stockist"} sottotitolo="Contact details and trade terms." onChiudi={onChiudi}>
      <form className="modulo" onSubmit={invia}>
        <Campo etichetta="Business name"><input required minLength={2} maxLength={120} value={dati.nome} onChange={aggiorna("nome")} /></Campo>
        <div className="griglia-due ing-griglia">
          <Campo etichetta="Contact"><input maxLength={120} value={dati.referente} onChange={aggiorna("referente")} /></Campo>
          <Campo etichetta="VAT number"><input maxLength={30} value={dati.partita_iva} onChange={aggiorna("partita_iva")} /></Campo>
        </div>
        <div className="griglia-due ing-griglia">
          <Campo etichetta="Email" aiuto="Needed to turn an agreed deal into an order."><input type="email" value={dati.email} onChange={aggiorna("email")} /></Campo>
          <Campo etichetta="Phone"><input maxLength={40} value={dati.telefono} onChange={aggiorna("telefono")} /></Campo>
        </div>
        <Campo etichetta="Address"><input maxLength={200} value={dati.indirizzo} onChange={aggiorna("indirizzo")} /></Campo>
        <div className="griglia-due ing-griglia">
          <Campo etichetta="Town or city"><input maxLength={120} value={dati.citta} onChange={aggiorna("citta")} /></Campo>
          <Campo etichetta="Postcode"><input maxLength={12} value={dati.cap} onChange={aggiorna("cap")} /></Campo>
        </div>
        <Campo etichetta="Country">
          <select value={dati.paese} onChange={aggiorna("paese")}>
            {Object.entries(PAESI).map(([codice, nome]) => <option key={codice} value={codice}>{nome}</option>)}
          </select>
        </Campo>

        <div className="griglia-due ing-griglia">
          <Campo etichetta="Price terms">
            <select value={dati.condizione} onChange={(e) => setDati({ ...dati, condizione: e.target.value as Rivenditore["condizione"] })}>
              <option value="sconto">Discount off retail</option>
              <option value="listino">Price list</option>
            </select>
          </Campo>
          {dati.condizione === "sconto" ? (
            <Campo etichetta="Discount percent">
              <input type="number" inputMode="decimal" min="0" max="100" step="0.01" value={dati.sconto} onChange={aggiorna("sconto")} />
            </Campo>
          ) : (
            <Campo etichetta="Price list name"><input maxLength={120} value={dati.listino} onChange={aggiorna("listino")} /></Campo>
          )}
        </div>
        <div className="griglia-due ing-griglia">
          <Campo etichetta="Payment terms">
            <input list="ing-pagamenti" maxLength={120} value={dati.pagamento} onChange={aggiorna("pagamento")} />
            <datalist id="ing-pagamenti">{PAGAMENTI.map((voce) => <option key={voce} value={voce} />)}</datalist>
          </Campo>
          <Campo etichetta="Minimum order"><input type="number" inputMode="decimal" min="0" step="0.01" value={dati.minimo} onChange={aggiorna("minimo")} /></Campo>
        </div>
        <Campo etichetta="Notes"><textarea rows={3} maxLength={1000} value={dati.appunti} onChange={aggiorna("appunti")} /></Campo>

        {salva.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{salva.error.message}</p> : null}
        <div className="riga__azioni ing-piede">
          {rivenditore && puo("ingrosso", "manage") ? <button type="button" className="pericolo" onClick={() => setEliminando(true)}>Delete</button> : null}
          <span className="spazio" />
          <button type="button" onClick={onChiudi}>Cancel</button>
          <button className="primario" type="submit" disabled={salva.isPending}>{salva.isPending ? "Saving..." : rivenditore ? "Save changes" : "Create stockist"}</button>
        </div>
      </form>
    </Modale>
  )
}
