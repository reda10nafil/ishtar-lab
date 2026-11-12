import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { interroga, invalido } from "../../../utili"
import { assente } from "../../magazzino/lib/assente"

type Gruppo = {
  id: string
  name: string | null
  created_at: string
  customers?: { id: string; email: string | null; first_name: string | null; last_name: string | null }[] | null
}

const CAMPI = ["id", "name", "created_at", "customers.id", "customers.email", "customers.first_name", "customers.last_name"]

const pubblico = (g: Gruppo) => ({
  id: g.id,
  nome: g.name,
  creato_il: g.created_at,
  membri: (g.customers ?? []).map((c) => ({ id: c.id, email: c.email, nome: c.first_name, cognome: c.last_name })),
})

export async function leggiGruppi(req: AuthenticatedMedusaRequest) {
  const { data } = await interroga(req).graph({ entity: "customer_group", fields: CAMPI })
  return (data as unknown as Gruppo[]).map(pubblico).sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? "", "it"))
}

export async function leggiGruppo(req: AuthenticatedMedusaRequest, id: string) {
  const { data } = await interroga(req).graph({ entity: "customer_group", fields: CAMPI, filters: { id } })
  const gruppo = data[0] as unknown as Gruppo | undefined
  if (!gruppo) throw assente("Group")
  return pubblico(gruppo)
}

/** Il nome è unico nel database: meglio una frase chiara che un errore tecnico. */
export async function nomeLibero(req: AuthenticatedMedusaRequest, nome: string, escluso?: string) {
  const gruppi = await leggiGruppi(req)
  if (gruppi.some((g) => g.id !== escluso && g.nome?.toLowerCase() === nome.toLowerCase())) {
    throw invalido("A group with this name already exists")
  }
}
