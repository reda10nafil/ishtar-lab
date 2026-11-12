import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateStoresWorkflow } from "@medusajs/medusa/core-flows"
import { aggiornaProdottoCatalogoWorkflow, esegui } from "../../../../workflows/catalogo/salvataggio-prodotto"
import { valida, invalido } from "../../../utili"
import { inFila } from "../../carte-regalo/comune"
import { creaProdotto, SalvataggioAMeta } from "../../catalogo/comune/creazione"
import { depositoEsistente, leggiOfferte, prezziAggiornati } from "../../catalogo/comune/offerte"
import { vedeMargini } from "../../catalogo/comune/permessi"
import { controllaCampi, modificaOfferta, pianoScorte } from "./salvataggio"
import { catalogoIshtar, metadatiIshtar } from "./vista"

/** Attesa massima del lucchetto di un prodotto: i salvataggi dello stesso prodotto passano uno alla volta. */
const ATTESA_LUCCHETTO = 30
const oggetto = (v: unknown): v is Record<string, any> => Boolean(v) && typeof v === "object" && !Array.isArray(v)

const imageUrl = z.string().max(2048).refine(s => {
  try { const u = new URL(s, "http://127.0.0.1:4273"); return ["http:","https:"].includes(u.protocol) && !u.username && !u.password } catch { return false }
}, "Indirizzo foto non valido")
const Product = z.object({
  id: z.string().optional(), name: z.string().trim().min(1).max(200), sku: z.string().trim().min(1).max(80),
  description: z.string().max(20000).default(""), category: z.string().max(150), gender: z.string().max(100).default(""),
  size: z.string().max(80).default(""), color: z.string().max(100).default(""), material: z.string().max(2000).default(""),
  price: z.number().finite().min(0), cost: z.number().finite().min(0), stock: z.number().int().min(0).max(100000000),
  photos: z.array(imageUrl).max(30).default([]), demo: z.boolean().default(false),
  status: z.enum(["draft","active","archived"]).default("draft"),
  incoming: z.number().int().min(0).max(100000000).default(0),
  reorder: z.number().int().min(0).max(100000000).default(5),
  custom: z.record(z.string().max(80), z.union([z.string().max(20000), z.number().finite(), z.boolean()])).default({}),
})
const Field = z.object({id:z.string().regex(/^[a-z][a-z0-9_]{0,60}$/), label:z.string().trim().min(1).max(100),
  type:z.enum(["text","number","select","color","boolean","date"]), options:z.array(z.string().max(150)).max(100).default([]),
  category:z.string().max(150).default(""), required:z.boolean().default(false)})
const Body = z.union([z.object({product:Product}),z.object({fields:z.array(Field).max(100)})])
async function context(req: AuthenticatedMedusaRequest) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {data} = await query.graph({entity:"store",fields:["id","metadata"],pagination:{take:1}})
  const store:any = data[0]; const config = store?.metadata?.ishtar_catalog
  if(!config?.seller_id) throw invalido("Inizializzare il catalogo Ishtar Lab prima dell’uso")
  return {query,store,config}
}
export async function GET(req:AuthenticatedMedusaRequest,res:MedusaResponse) {
  const {query,config} = await context(req)
  const {data} = await query.graph({entity:"product",fields:["id","title","description","status","material","categories.name","metadata","images.url","variants.id","variants.sku"],pagination:{take:10000}})
  const offers = await leggiOfferte(req.scope,{seller_id:config.seller_id})
  // Solo i prodotti con un'offerta di Ishtar Lab; stato, categoria, materiale e genere dai campi nativi (li cambia anche la
  // console); il costo d'acquisto solo verso chi ha il permesso sui margini (vista.ts).
  const products = catalogoIshtar(data as any[], offers, vedeMargini(req), (config.categories??[]).map((c:any)=>c.name))
  res.json({products,fields:config.fields??[],categories:config.categories??[]})
}
export async function POST(req:AuthenticatedMedusaRequest,res:MedusaResponse) {
  const input=valida(Body,req.body); const {query,store,config}=await context(req)
  if("fields" in input) {
    if(new Set(input.fields.map(f=>f.id)).size!==input.fields.length) throw invalido("Identificatori campo duplicati")
    await updateStoresWorkflow(req.scope).run({input:{selector:{id:store.id},update:{metadata:{...store.metadata,ishtar_catalog:{...config,fields:input.fields}}}}})
    res.json({ok:true});return
  }
  const p=input.product
  const cat=config.categories.find((c:any)=>c.name===p.category)
  if(!cat) throw invalido("Scegliere una categoria del catalogo")
  const campi=config.fields??[]
  const nomiCategorie=(config.categories??[]).map((c:any)=>c.name)
  const scheda={title:p.name,description:p.description,material:p.material,status:p.status==="active"?"published":"draft",
    category_ids:[cat.id],images:p.photos.map(url=>({url})),thumbnail:p.photos[0]??null}
  try {
    if(!p.id) {
      // Creazione: un solo workflow (prodotto, varianti, deposito, offerta) con la scheda Ishtar già nei metadati.
      const errore=controllaCampi({campi,categoria:p.category,custom:p.custom,precedente:null})
      if(errore) throw invalido(errore)
      const id=await creaProdotto(req.scope,{scheda:{titolo:p.name,descrizione:p.description,categoria_id:cat.id,foto:p.photos.map(url=>({url})),genere:p.gender,composizione:p.material,prezzo_cessione:p.cost},
        varianti:[{titolo:[p.size,p.color].filter(Boolean).join(" · ")||"Unica",sku:p.sku,quantita:p.stock}],stato:p.status==="active"?"published":"draft",aziendaId:config.seller_id,
        autore:req.auth_context.actor_id,firma:req.auth_context.actor_id,prezzoVendita:p.price,legaSubito:true,metadatiExtra:{ishtar_v1:metadatiIshtar(p),genere:p.gender}})
      res.json({ok:true,id});return
    }
    const id=p.id
    // Modifica: lettura, controlli e un solo workflow (scheda, scorte, prezzo) con il lucchetto del prodotto.
    await inFila(req,`ishtar-prodotto:${id}`,async()=>{
      const {data}=await query.graph({entity:"product",fields:["id","metadata","categories.name","variants.id","variants.sku"],filters:{id}})
      const old:any=data[0]; if(!old?.metadata?.ishtar_v1) throw invalido("Prodotto Ishtar non trovato")
      const variant=old.variants[0]
      if(variant.sku!==p.sku) throw invalido("Il codice SKU identifica il prodotto: crearne uno nuovo per un altro articolo")
      const salvata=oggetto(old.metadata.ishtar_v1)?old.metadata.ishtar_v1:{}
      const categoriaPrima=(old.categories??[]).map((c:any)=>c?.name).find((n:string)=>n&&nomiCategorie.includes(n))??salvata.category
      const errore=controllaCampi({campi,categoria:p.category,custom:p.custom,precedente:{categoria:categoriaPrima,custom:oggetto(salvata.custom)?salvata.custom:{}}})
      if(errore) throw invalido(errore)
      const offers=await leggiOfferte(req.scope,{variant_id:variant.id,seller_id:config.seller_id})
      if(offers.length!==1) throw invalido("Offerta prodotto non univoca")
      const offerta=offers[0]
      const piano=pianoScorte(offerta,p.stock)
      const modifica=modificaOfferta(offerta,p.price,p.cost)
      const salva=async()=>{
        const scorte=piano.tipo==="nuovo-livello"?{...piano,azienda:config.seller_id,...(await depositoEsistente(req.scope,config.seller_id))}:piano
        // Metadati: solo le chiavi del pannello. Medusa le unisce alle altre (mergeMetadata), che restano come sono.
        const esito=await esegui(aggiornaProdottoCatalogoWorkflow,req.scope,{id,prodotto:{...scheda,metadata:{ishtar_v1:metadatiIshtar(p,id),genere:p.gender}},scorte,
          offerta:modifica?{id:offerta.id,...(modifica.prezzo!==undefined?{prices:prezziAggiornati(offerta,modifica.prezzo)}:{}),metadata:modifica.metadata}:null,updated_by:req.auth_context.actor_id})
        if(esito.esito==="annullato") throw esito.errore
        if(esito.esito==="a-meta") throw new SalvataggioAMeta(esito.transazione,esito.errore)
      }
      // Deposito da creare (azienda che ancora non ne ha uno): stesso lucchetto di creaProdotto e nuova lettura dentro.
      const senzaDeposito=piano.tipo==="nuovo-livello"&&!(await depositoEsistente(req.scope,config.seller_id)).deposito
      await (senzaDeposito?inFila(req,`deposito:${config.seller_id}`,salva,ATTESA_LUCCHETTO):salva())
    },ATTESA_LUCCHETTO)
    res.json({ok:true,id})
  } catch(errore) {
    if(!(errore instanceof SalvataggioAMeta)) throw errore
    // Annullamento non riuscito: il prodotto può essere rimasto a metà. Lo si dice invece di un generico errore 500.
    req.scope.resolve(ContainerRegistrationKeys.LOGGER).error(`${errore.message}: ${String((errore.causa as Error)?.message ?? errore.causa)}`)
    res.status(500).json({message:"Salvataggio interrotto e annullamento non completato: ricaricare il catalogo e controllare il prodotto"})
  }
}