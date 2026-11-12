import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { api } from "../../api/client"
import { usePermessi } from "../../permessi"
import type { CartaCollezione, Collezione, OffertaScheda, RispostaCatalogo, SchedaProdotto } from "./tipi"

export type FiltriCatalogo = { stato?: string; categoria?: string; azienda?: string; collezione?: string; q?: string; ordine?: string; offset?: number; limit?: number }

export function percorsoCatalogo(filtri: FiltriCatalogo) {
  const parametri = new URLSearchParams()
  for (const [chiave, valore] of Object.entries(filtri)) {
    if (valore !== undefined && valore !== "") parametri.set(chiave, String(valore))
  }
  return `/admin/catalogo/prodotti?${parametri}`
}

export const useCatalogo = (filtri: FiltriCatalogo) =>
  useQuery({ queryKey: ["catalogo", filtri], queryFn: () => api<RispostaCatalogo>(percorsoCatalogo(filtri)), placeholderData: keepPreviousData })

export const useProdotto = (id: string) => useQuery({ queryKey: ["prodotto", id], queryFn: () => api<{ prodotto: SchedaProdotto }>(`/admin/catalogo/prodotti/${id}`) })

export function useCategorie(radice: "/admin" | "/vendor" = "/admin") {
  return useQuery({
    queryKey: ["categorie", radice],
    queryFn: async () => {
      const { product_categories } = await api<{ product_categories: { id: string; name: string }[] }>(`${radice}/product-categories?limit=200&fields=id,name`)
      return product_categories.map((c) => ({ id: c.id, nome: c.name })).sort((a, b) => a.nome.localeCompare(b.nome, "en"))
    },
    staleTime: 60_000,
  })
}

export function useAziende() {
  const { puo } = usePermessi()
  return useQuery({
    queryKey: ["aziende-filtro"],
    enabled: puo("sellers", "view"),
    queryFn: async () => {
      const { sellers } = await api<{ sellers: { id: string; name: string }[] }>("/admin/sellers?limit=200&fields=id,name")
      return sellers.map((s) => ({ id: s.id, nome: s.name })).sort((a, b) => a.nome.localeCompare(b.nome, "en"))
    },
    staleTime: 60_000,
  })
}

export function useCollezioni() {
  const { puo } = usePermessi()
  return useQuery({
    queryKey: ["collezioni"],
    enabled: puo("product_collections", "view"),
    queryFn: async () => {
      const { collections } = await api<{ collections: Collezione[] }>("/admin/collections?limit=200&order=title&fields=id,title,handle,created_at,metadata,products.id,products.title,products.thumbnail")
      return collections
    },
  })
}

export function useAggiornaCatalogo() {
  const client = useQueryClient()
  return useCallback(
    (id?: string) => {
      void client.invalidateQueries({ queryKey: ["catalogo"] })
      void client.invalidateQueries({ queryKey: ["collezioni"] })
      void client.invalidateQueries({ queryKey: ["collezioni-carte"] })
      void client.invalidateQueries({ queryKey: ["ricerca"] })
      if (id) void client.invalidateQueries({ queryKey: ["prodotto", id] })
    },
    [client]
  )
}

/** Cambia subito la scheda in memoria: la schermata non aspetta il server, che poi conferma. */
export function useSchedaSubito(id: string) {
  const client = useQueryClient()
  return useCallback(
    (cambia: (scheda: SchedaProdotto) => SchedaProdotto) => {
      client.setQueryData<{ prodotto: SchedaProdotto }>(["prodotto", id], (attuale) => attuale && { prodotto: cambia(attuale.prodotto) })
    },
    [client, id]
  )
}

const margineCon = (o: OffertaScheda, prezzo: number | null) => {
  if (prezzo === null || o.prezzo_cessione === null || o.prezzo_cessione === undefined) return {}
  const margine = prezzo - o.prezzo_cessione
  return { margine, margine_percento: prezzo > 0 ? margine / prezzo : null }
}

/** La scheda con il nuovo prezzo di un'offerta: tessere e margine seguono all'istante. */
export function conPrezzo(scheda: SchedaProdotto, offertaId: string, prezzo: number | null): SchedaProdotto {
  const varianti = scheda.varianti.map((v) => ({ ...v, offerte: v.offerte.map((o) => (o.id === offertaId ? { ...o, prezzo, ...margineCon(o, prezzo) } : o)) }))
  const prezzi = varianti.flatMap((v) => v.offerte.map((o) => o.prezzo)).filter((p): p is number => p !== null)
  return { ...scheda, varianti, prezzo_min: prezzi.length ? Math.min(...prezzi) : null, prezzo_max: prezzi.length ? Math.max(...prezzi) : null }
}

export function useCartaSubito() {
  const client = useQueryClient()
  return useCallback(
    (id: string, modifica: Partial<CartaCollezione>) => {
      client.setQueryData<{ collezioni: CartaCollezione[] }>(["collezioni-carte"], (attuale) => attuale && { collezioni: attuale.collezioni.map((c) => (c.id === id ? { ...c, ...modifica } : c)) })
    },
    [client]
  )
}

export async function caricaFoto(radice: "/admin" | "/vendor", file: File[]) {
  const modulo = new FormData()
  file.forEach((f) => modulo.append("files", f))
  const { files } = await api<{ files: { url: string }[] }>(`${radice}/uploads`, { dati: modulo })
  return files.map((f) => ({ url: f.url }))
}

export const testoDa = (valore: number | string | null | undefined) => (valore === null || valore === undefined ? "" : String(valore))
export const numeroDa = (testo: string) => (testo.trim() === "" ? null : Number(testo))

/** Prezzo scritto a mano, anche con la virgola: `null` se non è un importo maggiore di zero. */
export function prezzoDaTesto(testo: string) {
  const valore = Number(testo.trim().replace(",", "."))
  return testo.trim() && Number.isFinite(valore) && valore > 0 ? valore : null
}
