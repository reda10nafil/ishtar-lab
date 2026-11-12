import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, type FormEvent } from "react"
import { api } from "../../api/client"
import { Interruttore, useAvvisi } from "../../componenti"
import { Conferma, Modale } from "../../ui"
import type { PaginaNegozio } from "./tipi"

/** Dal titolo nasce l'indirizzo: «Our story» diventa /our-story. */
const indirizzoDa = (titolo: string) =>
  `/${titolo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`

type Proprieta = { pagina: PaginaNegozio | null; puoEliminare: boolean; onChiudi: () => void }

export function ModalePagina({ pagina, puoEliminare, onChiudi }: Proprieta) {
  const client = useQueryClient()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [titolo, setTitolo] = useState(pagina?.titolo ?? "")
  const [percorso, setPercorso] = useState(pagina?.percorso ?? "")
  const [testo, setTesto] = useState(pagina?.testo ?? "")
  const [visibile, setVisibile] = useState(pagina?.visibile ?? true)
  const [scritto, setScritto] = useState(Boolean(pagina))
  const [elimina, setElimina] = useState(false)

  const fatto = (frase: string) => {
    client.invalidateQueries({ queryKey: ["negozio-online", "stato"] })
    avvisa(frase)
    onChiudi()
  }

  const salva = useMutation({
    mutationFn: () => {
      const corpo = { titolo, percorso: percorso || indirizzoDa(titolo), testo, visibile }
      return api(pagina ? `/admin/negozio-online/pagine/${pagina.id}` : "/admin/negozio-online/pagine", { corpo })
    },
    onSuccess: () => fatto(pagina ? "Page saved" : "Page added"),
    onError: segnalaErrore,
  })

  const rimuovi = useMutation({
    mutationFn: () => api(`/admin/negozio-online/pagine/${pagina?.id}`, { metodo: "DELETE" }),
    onSuccess: () => fatto("Page deleted"),
    onError: segnalaErrore,
  })

  const invia = (evento: FormEvent) => {
    evento.preventDefault()
    salva.mutate()
  }

  const cambiaTitolo = (valore: string) => {
    setTitolo(valore)
    if (!scritto) setPercorso(valore.trim() ? indirizzoDa(valore) : "")
  }

  return (
    <>
      <Modale titolo={pagina ? "Edit page" : "New page"} sottotitolo="Saved on the server. It goes online with the public site." onChiudi={onChiudi}>
        <form className="negozio-modulo" onSubmit={invia}>
          <label className="canale-campo">
            <span>Title</span>
            <input autoFocus required value={titolo} maxLength={80} onChange={(e) => cambiaTitolo(e.target.value)} />
          </label>
          <label className="canale-campo">
            <span>Address</span>
            <input value={percorso} placeholder="/our-story" maxLength={80} onChange={(e) => { setPercorso(e.target.value); setScritto(true) }} />
          </label>
          <label className="canale-campo">
            <span>Text</span>
            <textarea rows={7} value={testo} onChange={(e) => setTesto(e.target.value)} />
          </label>
          <div className="negozio-modulo__mostra">
            <span>Showing in the menu</span>
            <Interruttore acceso={visibile} etichetta="Showing in the menu" onCambia={setVisibile} />
          </div>
          <div className="cassa-piede">
            {pagina && puoEliminare ? <button type="button" className="pericolo negozio-modulo__elimina" onClick={() => setElimina(true)}>Delete</button> : null}
            <button type="button" onClick={onChiudi}>Cancel</button>
            <button type="submit" className="primario" disabled={salva.isPending || !titolo.trim()}>{pagina ? "Save page" : "Add page"}</button>
          </div>
        </form>
      </Modale>
      {elimina ? <Conferma titolo="Delete this page?" testo={`${pagina?.titolo} will be gone for good. Hide it instead to keep it.`} azione="Delete page" attesa={rimuovi.isPending} onConferma={() => rimuovi.mutate()} onChiudi={() => setElimina(false)} /> : null}
    </>
  )
}
