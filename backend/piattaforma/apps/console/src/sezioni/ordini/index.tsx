import { Cantiere } from "../../componenti"
import OrdiniAzienda from "../../pagine/OrdiniAzienda"
import { useSessione } from "../../sessione"

export default function Ordini() {
  const { sessione } = useSessione()
  return sessione?.tipo === "admin" ? <Cantiere titolo="Ordini" /> : <OrdiniAzienda />
}
