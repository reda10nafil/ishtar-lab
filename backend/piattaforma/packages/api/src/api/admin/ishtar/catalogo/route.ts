import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow, updateStoresWorkflow } from "@medusajs/medusa/core-flows"
import { valida, invalido } from "../../../utili"
import { creaProdotto, controllaCodici } from "../../catalogo/comune/creazione"
import { leggiOfferte, aggiornaOfferta, impostaScorte } from "../../catalogo/comune/offerte"
import { vedeMargini } from "../../catalogo/comune/permessi"
import { catalogoIshtar, metadatiIshtar } from "./vista"

const imageUrl = z.string().max(2048).refine(s => {
  try { const u = new URL(s, "http://127.0.0.1:4273"); return ["http:","https:"].includes(u.protocol) && !u.username && !u.password } catch { return false }
}, "Indirizzo foto non valido")
const Product = z.object({
  id: z.string().optional(), name: z.string().trim().min(1).max(200), sku: z.string().trim().min(1).max(80),
  description: z.string().max(20000).default(""), category: z.string().max(150), gender: z.string().max(100).default(""),
  size: z.string().max(80).default(""), color: z.string().max(100).default(""), material: z.string().max(200).default(""),
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
  const {data} = await query.graph({entity:"product",fields:["id","title","description","metadata","images.url","variants.id","variants.sku"],pagination:{take:10000}})
  const offers = await leggiOfferte(req.scope,{seller_id:config.seller_id})
  // Solo i prodotti con un'offerta di Ishtar Lab; il costo d'acquisto solo verso chi ha il permesso sui margini (vista.ts).
  const products = catalogoIshtar(data as any[], offers, vedeMargini(req))
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
  for(const f of config.fields??[]) {
    if(f.category && f.category!==p.category) continue
    const v=p.custom[f.id]; const present=v!==undefined && v!==""
    if(f.required && !present) throw invalido(`Compilare ${f.label}`)
    if(present && f.type==="number" && typeof v!=="number") throw invalido(`${f.label}: indicare un numero`)
    if(present && f.type==="boolean" && typeof v!=="boolean") throw invalido(`${f.label}: indicare sì/no`)
    if(present && f.type==="select" && !f.options.includes(v)) throw invalido(`${f.label}: valore non valido`)
  }
  let id=p.id
  if(!id) {
    id=await creaProdotto(req.scope,{scheda:{titolo:p.name,descrizione:p.description,categoria_id:cat.id,foto:p.photos.map(url=>({url})),genere:p.gender,composizione:p.material,prezzo_cessione:p.cost},
      varianti:[{titolo:[p.size,p.color].filter(Boolean).join(" · ")||"Unica",sku:p.sku,quantita:p.stock}],stato:p.status==="active"?"published":"draft",aziendaId:config.seller_id,
      autore:req.auth_context.actor_id,firma:req.auth_context.actor_id,prezzoVendita:p.price,legaSubito:true})
  } else {
    const {data}=await query.graph({entity:"product",fields:["id","metadata","variants.id","variants.sku"],filters:{id}})
    const old:any=data[0]; if(!old?.metadata?.ishtar_v1) throw invalido("Prodotto Ishtar non trovato")
    const variant=old.variants[0]
    if(variant.sku!==p.sku) throw invalido("Il codice SKU identifica il prodotto: crearne uno nuovo per un altro articolo")
    const offers=await leggiOfferte(req.scope,{variant_id:variant.id,seller_id:config.seller_id})
    if(offers.length!==1) throw invalido("Offerta prodotto non univoca")
    await aggiornaOfferta(req.scope,offers[0],{prezzo:p.price,metadata:{...offers[0].metadata,prezzo_cessione:p.cost}},req.auth_context.actor_id)
    await impostaScorte(req.scope,offers[0],p.stock)
  }
  const {data}=await query.graph({entity:"product",fields:["id","metadata"],filters:{id}})
  await updateProductsWorkflow(req.scope).run({input:{selector:{id},update:{title:p.name,description:p.description,material:p.material,status:p.status==="active"?"published":"draft",
    category_ids:[cat.id],images:p.photos.map(url=>({url})),thumbnail:p.photos[0]??null,metadata:{...(data[0] as any).metadata,ishtar_v1:metadatiIshtar(p,id),genere:p.gender}}}})
  res.json({ok:true,id})
}
