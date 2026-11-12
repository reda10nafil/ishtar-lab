import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useCallback, useState } from "react"
import { api } from "../../api/client"
import { Interruttore, useAvvisi } from "../../componenti"
import { numero } from "../../lingua"
import { usePermessi } from "../../permessi"
import { dataBreve } from "../../ui"
import { ModalePagina } from "./ModalePagina"
import type { PaginaNegozio } from "./tipi"

/** Elenco delle pagine: l'interruttore toglie una pagina dal menu senza eliminarla. */
export function Pagine({ pagine, viste }: { pagine: PaginaNegozio[]; viste: Record<string, number> }) {
  const client = useQueryClient()
  const { avvisa, segnalaErrore } = useAvvisi()
  const { puo } = usePermessi()
  const [aperta, setAperta] = useState<PaginaNegozio | "nuova" | null>(null)
  const modifica = puo("negozio_online", "edit")
  const chiudi = useCallback(() => setAperta(null), [])

  const mostra = useMutation({
    mutationFn: ({ pagina, visibile }: { pagina: PaginaNegozio; visibile: boolean }) => api(`/admin/negozio-online/pagine/${pagina.id}`, { corpo: { visibile } }),
    onSuccess: (_, { pagina, visibile }) => {
      client.invalidateQueries({ queryKey: ["negozio-online", "stato"] })
      avvisa(`${pagina.titolo} ${visibile ? "showing" : "hidden"}`)
    },
    onError: segnalaErrore,
  })

  return (
    <section className="negozio__pagine vetro" aria-label="Pages">
      <div className="canale-testa negozio__testa-pagine">
        <div>
          <h2>Pages</h2>
          <p>Hide one to take it off the menu without deleting it</p>
        </div>
        {modifica ? <button type="button" className="negozio__nuova" onClick={() => setAperta("nuova")}><Plus size={16} aria-hidden="true" /> New page</button> : null}
      </div>
      <div className="negozio__tabella">
        <table className="tabella" aria-label="Pages">
          <thead>
            <tr>
              <th scope="col">Page</th>
              <th scope="col" className="a-destra">Views · 30d</th>
              <th scope="col">Updated</th>
              <th scope="col" className="a-destra">Showing</th>
            </tr>
          </thead>
          <tbody>
            {pagine.map((pagina) => (
              <tr key={pagina.id} className={modifica ? "tabella__riga--apribile" : undefined} tabIndex={modifica ? 0 : undefined} onClick={modifica ? () => setAperta(pagina) : undefined} onKeyDown={modifica ? (e) => e.key === "Enter" && e.target === e.currentTarget && setAperta(pagina) : undefined}>
                <td data-titolo="Page">
                  <span className="negozio__cella">
                    <b>{pagina.titolo}</b>
                    <small>{pagina.percorso}</small>
                  </span>
                </td>
                <td data-titolo="Views · 30d" className="a-destra">{numero(viste[pagina.percorso])}</td>
                <td data-titolo="Updated" className="negozio__data">{dataBreve(pagina.updated_at)}</td>
                <td data-titolo="Showing" className="a-destra" onClick={(e) => e.stopPropagation()}>
                  <Interruttore acceso={pagina.visibile} etichetta={`${pagina.titolo} showing`} disattivo={!modifica} onCambia={(visibile) => mostra.mutate({ pagina, visibile })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pagine.length ? null : <p className="negozio__nulla">No pages yet. Add the first one and it joins the menu in the preview.</p>}
      </div>
      {aperta ? <ModalePagina pagina={aperta === "nuova" ? null : aperta} puoEliminare={puo("negozio_online", "manage")} onChiudi={chiudi} /> : null}
    </section>
  )
}
