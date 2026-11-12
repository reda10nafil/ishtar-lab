import { useQuery } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { api } from "../../api/client"
import { Schede } from "../../componenti"
import { Pagina } from "../../ui"
import type { ElencoProposte } from "./tipi"

/** Testata comune alle tre schede: ogni scheda porta la sua frase e la sua azione. */
export function Guscio({ sottotitolo, azioni, children }: { sottotitolo: string; azioni?: ReactNode; children: ReactNode }) {
  const inAttesa = useQuery({
    queryKey: ["sconti", "proposte", "in_attesa"],
    queryFn: () => api<ElencoProposte>("/admin/sconti/proposte?stato=in_attesa"),
  })
  return (
    <Pagina titolo="Discounts" sottotitolo={sottotitolo} azioni={azioni}>
      <Schede
        etichetta="Discount sections"
        voci={[
          { a: "/sconti/codici", etichetta: "Codes" },
          { a: "/sconti/carte-regalo", etichetta: "Gift cards" },
          { a: "/sconti/proposte", etichetta: "Proposals", conteggio: inAttesa.data?.in_attesa },
        ]}
      />
      {children}
    </Pagina>
  )
}
