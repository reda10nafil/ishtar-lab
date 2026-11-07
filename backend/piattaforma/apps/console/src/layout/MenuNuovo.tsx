import { BadgePercent, Package, Plus, Shirt, ShoppingBag, UsersRound } from "lucide-react"
import { Link } from "react-router-dom"
import { Tendina } from "../componenti"
import { usePermessi, type Permesso } from "../permessi"
import { useSessione } from "../sessione"

const VOCI_ADMIN: { a: string; testo: string; icona: typeof Plus; permesso: Permesso }[] = [
  { a: "/ordini/bozze?nuovo=1", testo: "New order", icona: ShoppingBag, permesso: ["orders", "edit"] },
  { a: "/prodotti/catalogo?nuovo=1", testo: "New product", icona: Package, permesso: ["products", "edit"] },
  { a: "/outfit?nuovo=1", testo: "New outfit", icona: Shirt, permesso: ["outfit", "edit"] },
  { a: "/clienti/persone?nuovo=1", testo: "New customer", icona: UsersRound, permesso: ["customers", "edit"] },
  { a: "/sconti/codici?nuovo=1", testo: "New discount", icona: BadgePercent, permesso: ["sconti", "edit"] },
]

const VOCI_AZIENDA: typeof VOCI_ADMIN = [
  { a: "/prodotti?nuovo=1", testo: "New product", icona: Package, permesso: ["products", "edit"] },
  { a: "/sconti?nuovo=1", testo: "Propose a discount", icona: BadgePercent, permesso: ["sconti", "edit"] },
]

export default function MenuNuovo() {
  const { sessione } = useSessione()
  const { puo } = usePermessi()
  const voci = (sessione?.tipo === "admin" ? VOCI_ADMIN : VOCI_AZIENDA).filter((v) => puo(...v.permesso))
  if (!voci.length) return null
  return (
    <Tendina etichetta="Create new" classe="primario testata__nuovo" bottone={<><Plus size={18} aria-hidden="true" /> <span>New</span></>}>
      {voci.map(({ a, testo, icona: Icona }) => (
        <Link key={a} to={a}><Icona size={17} aria-hidden="true" /> {testo}</Link>
      ))}
    </Tendina>
  )
}
