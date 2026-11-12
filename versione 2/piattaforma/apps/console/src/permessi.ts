import { useQuery } from "@tanstack/react-query"
import { api } from "./api/client"
import { useSessione } from "./sessione"

export type Diritto = "view" | "edit" | "manage"
export type Permesso = [chiave: string, diritto: Diritto]

const RANGO: Record<string, number> = { view: 1, edit: 2, manage: 3 }

type Profilo = { ruolo: { id: string; etichetta: string } | null; permessi: Record<string, string> }

/** Ruolo e permessi dal server. L'interfaccia li usa solo per adattarsi: il limite vero è nelle rotte. */
export function usePermessi() {
  const { sessione } = useSessione()
  const { data, isLoading } = useQuery({
    queryKey: ["permessi", sessione?.tipo, sessione?.email],
    queryFn: () => api<Profilo>(`/${sessione?.tipo === "admin" ? "admin" : "vendor"}/permessi/me`),
    enabled: Boolean(sessione),
    // Il backend riparte spesso in sviluppo: un errore di rete non è un permesso negato.
    retry: 8,
    retryDelay: 2000,
  })
  const puo = (chiave: string, diritto: Diritto = "view") => (RANGO[data?.permessi[chiave] ?? ""] ?? 0) >= RANGO[diritto]
  return { ruolo: data?.ruolo ?? null, puo, pronto: !isLoading }
}
