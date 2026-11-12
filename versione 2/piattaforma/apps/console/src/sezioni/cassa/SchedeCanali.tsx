import { Schede, type VoceScheda } from "../../componenti"
import { usePermessi } from "../../permessi"

/** Le tre schede dei canali di vendita: la stessa riga in Online shop, Shop till e Wholesale. */
export function SchedeCanali() {
  const { puo } = usePermessi()
  const voci: VoceScheda[] = [
    ...(puo("negozio_online") ? [{ a: "/negozio-online", etichetta: "Online shop" }] : []),
    ...(puo("cassa") ? [{ a: "/cassa", etichetta: "Shop till" }] : []),
    ...(puo("ingrosso") ? [{ a: "/ingrosso", etichetta: "Wholesale" }] : []),
  ]
  return <Schede voci={voci} etichetta="Sales channels" />
}
