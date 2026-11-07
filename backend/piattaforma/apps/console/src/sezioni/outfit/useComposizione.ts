import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"
import { api, ErroreApi } from "../../api/client"
import { useAvvisi } from "../../componenti"
import type { Composizione, Outfit } from "./tipi"

const ATTESA = 500

export type Esito = "salvato" | "in_corso" | "errore"

const daVista = (outfit: Outfit): Composizione => ({
  nome: outfit.nome,
  descrizione: outfit.descrizione,
  modalita_prezzo: outfit.modalita_prezzo,
  prezzo_fisso: outfit.prezzo_fisso,
  sconto_a_carico: outfit.sconto_a_carico,
  quota_negozio: outfit.quota_negozio,
  capi: outfit.capi.map((c) => ({
    product_id: c.product_id,
    azienda_id: c.azienda_id,
    alternativa_product_id: c.alternativa?.product_id ?? null,
    alternativa_azienda_id: c.alternativa?.azienda_id ?? null,
    x: c.x,
    y: c.y,
    larghezza: c.larghezza,
    livello: c.livello,
  })),
})

/**
 * Tiene la composizione nella pagina e la salva da sola poco dopo ogni modifica.
 * I numeri (prezzi, disponibilità, margini) tornano dal server: qui non si ricalcolano.
 */
export function useComposizione(id: string) {
  const client = useQueryClient()
  const { segnalaErrore } = useAvvisi()
  const chiave = ["outfit", id]

  const lettura = useQuery({ queryKey: chiave, queryFn: async () => (await api<{ outfit: Outfit }>(`/admin/outfit/${id}`)).outfit })

  const [locale, setLocale] = useState<Composizione | null>(null)
  const [esito, setEsito] = useState<Esito>("salvato")
  const attuale = useRef<Composizione | null>(null)
  const daInviare = useRef<Composizione | null>(null)
  /** Modifica non arrivata al server per un problema di rete: resta in pagina e si può riprovare. */
  const sospesa = useRef<Composizione | null>(null)
  const inviando = useRef(false)
  const timer = useRef<number | undefined>(undefined)

  const applica = useCallback((composizione: Composizione) => {
    attuale.current = composizione
    setLocale(composizione)
  }, [])

  useEffect(() => {
    if (lettura.data && !daInviare.current && !inviando.current && !sospesa.current) applica(daVista(lettura.data))
  }, [lettura.data, applica])

  const invia = useCallback(async () => {
    window.clearTimeout(timer.current)
    const corpo = daInviare.current
    if (!corpo || inviando.current) return
    inviando.current = true
    daInviare.current = null
    setEsito("in_corso")
    try {
      // Una lettura partita prima di questo salvataggio riporterebbe la tela indietro.
      await client.cancelQueries({ queryKey: ["outfit", id] })
      const { outfit } = await api<{ outfit: Outfit }>(`/admin/outfit/${id}`, { corpo })
      client.setQueryData(["outfit", id], outfit)
      void client.invalidateQueries({ queryKey: ["outfit-elenco"] })
      sospesa.current = null
      setEsito("salvato")
    } catch (errore) {
      setEsito("errore")
      segnalaErrore(errore)
      const salvato = client.getQueryData<Outfit>(["outfit", id])
      // Il server ha rifiutato: la tela torna a ciò che è davvero salvato.
      if (errore instanceof ErroreApi && errore.stato === 400) {
        if (salvato && !daInviare.current) applica(daVista(salvato))
      } else {
        sospesa.current = corpo
      }
    } finally {
      inviando.current = false
      if (daInviare.current) void invia()
    }
  }, [id, client, segnalaErrore, applica])

  const cambia = useCallback(
    (modifica: (composizione: Composizione) => Composizione, subito = false) => {
      if (!attuale.current) return
      const prossima = modifica(attuale.current)
      applica(prossima)
      daInviare.current = prossima
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => void invia(), subito ? 0 : ATTESA)
    },
    [applica, invia]
  )

  const riprova = useCallback(() => {
    if (sospesa.current && !daInviare.current) daInviare.current = sospesa.current
    void invia()
  }, [invia])

  /** Prima di cambiare stato si salva ciò che è in sospeso. */
  const salvaOra = useCallback(async () => {
    while (inviando.current) await new Promise((risolvi) => setTimeout(risolvi, 50))
    if (daInviare.current) await invia()
    while (inviando.current) await new Promise((risolvi) => setTimeout(risolvi, 50))
  }, [invia])

  useEffect(
    () => () => {
      if (daInviare.current) void invia()
    },
    [invia]
  )

  return { vista: lettura.data, caricamento: lettura.isLoading, errore: lettura.error, locale, esito, cambia, salvaOra, riprova }
}
