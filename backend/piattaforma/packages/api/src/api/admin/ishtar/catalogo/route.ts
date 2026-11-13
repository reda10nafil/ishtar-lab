import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateStoresWorkflow } from "@medusajs/medusa/core-flows"
import { valida, invalido } from "../../../utili"
import { inFila } from "../../carte-regalo/comune"
import { creaProdotto, SalvataggioAMeta } from "../../catalogo/comune/creazione"
import { leggiOfferte } from "../../catalogo/comune/offerte"
import { vedeMargini } from "../../catalogo/comune/permessi"
import { aggiornaProdotto, ATTESA_LUCCHETTO, CAMPI_PRODOTTO, ConflittoModifica, RifiutoScorte } from "./aggiornamento"
import { controllaCampi, stessiCampi } from "./salvataggio"
import { Body, RICARICA } from "./schema"
import { catalogoIshtar, metadatiIshtar } from "./vista"

async function context(req: AuthenticatedMedusaRequest) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {data} = await query.graph({entity:"store",fields:["id","metadata"],pagination:{take:1}})
  const store:any = data[0]; const config = store?.metadata?.ishtar_catalog
  if(!config?.seller_id) throw invalido("Inizializzare il catalogo Ishtar Lab prima dell’uso")
  return {query,store,config}
}
export async function GET(req:AuthenticatedMedusaRequest,res:MedusaResponse) {
  const {query,config} = await context(req)
  const {data} = await query.graph({entity:"product",fields:CAMPI_PRODOTTO,pagination:{take:10000}})
  const offers = await leggiOfferte(req.scope,{seller_id:config.seller_id})
  // Solo i prodotti con un'offerta di Ishtar Lab; stato, categoria, materiale e genere dai campi nativi (li cambia anche la
  // console); il costo d'acquisto solo verso chi ha il permesso sui margini (vista.ts).
  const products = catalogoIshtar(data as any[], offers, vedeMargini(req), (config.categories??[]).map((c:any)=>c.name))
  res.json({products,fields:config.fields??[],categories:config.categories??[]})
}
export async function POST(req:AuthenticatedMedusaRequest,res:MedusaResponse) {
  const input=valida(Body,req.body); const {config}=await context(req)
  if("fields" in input) {
    // Configurazione dei campi: si salva solo se è ancora quella da cui il pannello è partito (un'altra finestra può
    // averla cambiata), con lettura e scrittura sotto lo stesso lucchetto.
    if(!input.prima) throw invalido(RICARICA)
    if(new Set(input.fields.map(f=>f.id)).size!==input.fields.length) throw invalido("Identificatori campo duplicati")
    const salvata=await inFila(req,"ishtar-configurazione",async()=>{
      const {store,config}=await context(req)
      // Già salvata così (invio ripetuto dopo una risposta persa): niente da fare, non è un conflitto.
      if(stessiCampi(config.fields??[],input.fields)) return true
      if(!stessiCampi(config.fields??[],input.prima!)) return false
      await updateStoresWorkflow(req.scope).run({input:{selector:{id:store.id},update:{metadata:{...store.metadata,ishtar_catalog:{...config,fields:input.fields}}}}})
      return true
    },ATTESA_LUCCHETTO)
    if(!salvata){res.status(412).json({message:"Modifica non salvata: i campi personalizzati sono stati cambiati altrove.",code:"conflitto",conflitti:[]});return}
    res.json({ok:true});return
  }
  try {
    if("modifica" in input) {
      // Modifica: solo i campi cambiati, con il valore di partenza; scorte come variazioni o conteggio (aggiornamento.ts).
      const product=await aggiornaProdotto(req,config,input.modifica)
      res.json({ok:true,id:input.modifica.id,product});return
    }
    const p=input.product
    // Scheda intera con un id: arriva da una finestra con il codice di prima, che riscriverebbe anche i campi cambiati altrove.
    if(p.id) throw invalido(RICARICA)
    const cat=config.categories.find((c:any)=>c.name===p.category)
    if(!cat) throw invalido("Scegliere una categoria del catalogo")
    // Creazione: un solo workflow (prodotto, varianti, deposito, offerta) con la scheda Ishtar già nei metadati.
    const errore=controllaCampi({campi:config.fields??[],categoria:p.category,custom:p.custom,precedente:null})
    if(errore) throw invalido(errore)
    const id=await creaProdotto(req.scope,{scheda:{titolo:p.name,descrizione:p.description,categoria_id:cat.id,foto:p.photos.map(url=>({url})),genere:p.gender,composizione:p.material,prezzo_cessione:p.cost},
      varianti:[{titolo:[p.size,p.color].filter(Boolean).join(" · ")||"Unica",sku:p.sku,quantita:p.stock}],stato:p.status==="active"?"published":"draft",aziendaId:config.seller_id,
      autore:req.auth_context.actor_id,firma:req.auth_context.actor_id,prezzoVendita:p.price,legaSubito:true,metadatiExtra:{ishtar_v1:metadatiIshtar(p),genere:p.gender}})
    res.json({ok:true,id})
  } catch(errore) {
    if(errore instanceof ConflittoModifica){res.status(412).json({message:errore.message,code:"conflitto",conflitti:errore.conflitti});return}
    if(errore instanceof RifiutoScorte){res.status(400).json({message:errore.message,code:"scorte"});return}
    if(!(errore instanceof SalvataggioAMeta)) throw errore
    // Annullamento non riuscito: il prodotto può essere rimasto a metà. Lo si dice invece di un generico errore 500.
    req.scope.resolve(ContainerRegistrationKeys.LOGGER).error(`${errore.message}: ${String((errore.causa as Error)?.message ?? errore.causa)}`)
    res.status(500).json({message:"Salvataggio interrotto e annullamento non completato: ricaricare il catalogo e controllare il prodotto"})
  }
}
