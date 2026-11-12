import { Megaphone, Package, Plus, ReceiptText, Shirt, Store, Tag, UserPlus } from "lucide-react"
import { Fragment } from "react"
import { Link } from "react-router-dom"
import { Tendina } from "../componenti"
import { usePermessi, type Permesso } from "../permessi"
import { useSessione } from "../sessione"
import type { Creazione } from "./Crea"

type VoceNuovo = { a: string; testo: string; nome: string; icona: typeof Plus; permesso: Permesso; crea?: Creazione }

/**
 * `testo` è ciò che si legge nel menu; `nome` è il nome completo per screen reader e foglio del telefono.
 * Con `crea` il modulo si apre sulla pagina corrente; `a` resta l'indirizzo per chi apre in una nuova scheda.
 */
const GRUPPI_ADMIN: VoceNuovo[][] = [
  [
    { a: "/ordini/bozze?nuovo=1", testo: "Order", nome: "New order", icona: ReceiptText, permesso: ["orders", "edit"], crea: "ordine" },
    { a: "/prodotti/catalogo?nuovo=1", testo: "Product", nome: "New product", icona: Package, permesso: ["products", "edit"], crea: "prodotto" },
    { a: "/clienti/persone?nuovo=1", testo: "Customer", nome: "New customer", icona: UserPlus, permesso: ["customers", "edit"], crea: "cliente" },
    { a: "/outfit?nuovo=1", testo: "Outfit", nome: "New outfit", icona: Shirt, permesso: ["outfit", "edit"] },
  ],
  [
    { a: "/sconti/codici?nuovo=1", testo: "Discount code", nome: "New discount", icona: Tag, permesso: ["sconti", "edit"], crea: "sconto" },
    { a: "/marketing/campagne?nuovo=1", testo: "Campaign", nome: "New campaign", icona: Megaphone, permesso: ["marketing", "edit"], crea: "campagna" },
  ],
  [{ a: "/cassa", testo: "Open the shop till", nome: "Open the shop till", icona: Store, permesso: ["cassa", "view"] }],
]

const GRUPPI_AZIENDA: VoceNuovo[][] = [
  [
    { a: "/prodotti?nuovo=1", testo: "Product", nome: "New product", icona: Package, permesso: ["products", "edit"] },
    { a: "/sconti?nuovo=1", testo: "Propose a discount", nome: "Propose a discount", icona: Tag, permesso: ["sconti", "edit"] },
  ],
]

const gruppiNuovo = (tipo: string | undefined, puo: (...permesso: Permesso) => boolean) =>
  (tipo === "admin" ? GRUPPI_ADMIN : GRUPPI_AZIENDA).map((voci) => voci.filter((v) => puo(...v.permesso))).filter((voci) => voci.length)

export const vociNuovo = (tipo: string | undefined, puo: (...permesso: Permesso) => boolean) =>
  gruppiNuovo(tipo, puo).flat().map(({ a, nome, icona, crea }) => ({ a, testo: nome, icona, crea }))

export default function MenuNuovo({ onCrea }: { onCrea: (tipo: Creazione) => void }) {
  const { sessione } = useSessione()
  const { puo } = usePermessi()
  const gruppi = gruppiNuovo(sessione?.tipo, puo)
  if (!gruppi.length) return null
  return (
    <Tendina etichetta="Create new" classe="primario testata__nuovo" chiudiAlClic bottone={<><Plus size={18} aria-hidden="true" /> <span>New</span></>}>
      <p className="tendina__etichetta">Create</p>
      {gruppi.map((voci, indice) => (
        <Fragment key={voci[0].a}>
          {indice > 0 ? <div className="tendina__linea" role="separator" /> : null}
          {voci.map(({ a, testo, nome, icona: Icona, crea }) => (
            <Link
              key={a}
              to={a}
              aria-label={nome}
              onClick={(e) => {
                if (!crea) return
                e.preventDefault()
                onCrea(crea)
              }}
            >
              <Icona size={18} aria-hidden="true" /> {testo}
            </Link>
          ))}
        </Fragment>
      ))}
    </Tendina>
  )
}
