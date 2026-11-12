import { useQueryClient } from "@tanstack/react-query"
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { allaScadenza, leggiSessione, scriviSessione, type Sessione } from "./api/client"

type Contesto = {
  sessione: Sessione | null
  apri: (sessione: Sessione) => void
  chiudi: () => void
}

const ContestoSessione = createContext<Contesto | null>(null)

export function ProviderSessione({ children }: { children: ReactNode }) {
  const [sessione, imposta] = useState<Sessione | null>(leggiSessione)
  const client = useQueryClient()

  const apri = useCallback((nuova: Sessione) => {
    scriviSessione(nuova)
    imposta(nuova)
  }, [])

  /** L'amministratore rientra da solo; un'azienda torna alla sua pagina di accesso. */
  const chiudi = useCallback(() => {
    const azienda = leggiSessione()?.tipo === "azienda"
    scriviSessione(null)
    client.clear()
    imposta(null)
    if (azienda) window.location.assign("/accesso-azienda")
  }, [client])

  useEffect(() => allaScadenza(chiudi), [chiudi])

  const valore = useMemo(() => ({ sessione, apri, chiudi }), [sessione, apri, chiudi])
  return <ContestoSessione.Provider value={valore}>{children}</ContestoSessione.Provider>
}

export function useSessione() {
  const contesto = useContext(ContestoSessione)
  if (!contesto) throw new Error("useSessione richiede ProviderSessione")
  return contesto
}
