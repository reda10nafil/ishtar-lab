import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { api, ErroreApi } from "../../api/client"
import { usePermessi } from "../../permessi"
import type { Collezione, RispostaCatalogo, SchedaProdotto } from "./tipi"

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
      void client.invalidateQueries({ queryKey: ["ricerca"] })
      if (id) void client.invalidateQueries({ queryKey: ["prodotto", id] })
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

/** Il modulo della collezione ha un solo campo a rischio: un 400 significa nome o indirizzo già usato. */
export const erroreCollezione = (errore: Error) =>
  errore instanceof ErroreApi && errore.stato === 400 ? "A collection with this name or address already exists: choose another" : errore.message

export const testoDa = (valore: number | string | null | undefined) => (valore === null || valore === undefined ? "" : String(valore))
export const numeroDa = (testo: string) => (testo.trim() === "" ? null : Number(testo))
