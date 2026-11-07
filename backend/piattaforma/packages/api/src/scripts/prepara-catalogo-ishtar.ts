import {randomBytes} from "node:crypto"
import type { ExecArgs } from "@medusajs/framework/types"
import {Modules,ContainerRegistrationKeys} from "@medusajs/framework/utils"
import {createSellerAccountWorkflow,approveSellerWorkflow} from "@mercurjs/core/workflows"
import {createProductCategoriesWorkflow,createShippingProfilesWorkflow,updateStoresWorkflow} from "@medusajs/medusa/core-flows"
export default async function({container}:ExecArgs) {
  if(process.env.ISHTAR_INSTANCE_ID!=="ishtar-lab-redx" || !process.env.DATABASE_URL?.includes(":55730/ishtar_lab_redx")) throw Error("Istanza non autorizzata")
  const q=container.resolve(ContainerRegistrationKeys.QUERY)
  const {data:stores}=await q.graph({entity:"store",fields:["id","metadata"],pagination:{take:1}})
  const store:any=stores[0]; const old=store.metadata?.ishtar_catalog
  if(old?.seller_id){console.log("Catalogo già inizializzato");return}
  const email="catalogo@ishtar-lab.local"
  let {data:sellers}=await q.graph({entity:"seller",fields:["id"],filters:{email}})
  let sellerId=sellers[0]?.id
  if(!sellerId) {
    const auth=container.resolve(Modules.AUTH)
    const registered=await auth.register("emailpass",{body:{email,password:randomBytes(32).toString("hex")}})
    let identity=registered.authIdentity?.id
    if(!identity){const [p]=await auth.listProviderIdentities({provider:"emailpass",entity_id:email});identity=p?.auth_identity_id}
    if(!identity)throw Error("Identità catalogo non creata")
    const {result:seller}=await createSellerAccountWorkflow(container).run({input:{auth_identity_id:identity,member_email:email,first_name:"Catalogo",last_name:"Ishtar",seller:{name:"Ishtar Lab",email,currency_code:"eur"}}})
    sellerId=seller.id
    await approveSellerWorkflow(container).run({input:{seller_id:sellerId}})
  }
  const {data:profiles}=await q.graph({entity:"shipping_profile",fields:["id"],pagination:{take:1}})
  if(!profiles.length)await createShippingProfilesWorkflow(container).run({input:{data:[{name:"Ishtar Lab",type:"default"}]}})
  const names=["Pellicce","Abiti","Parte sopra","Parte sotto","Completi","Borse","Scarpe","Accessori"]
  const {data:cats}=await q.graph({entity:"product_category",fields:["id","name"]})
  const categories:any[]=[...cats]
  for(const name of names)if(!categories.some(c=>c.name===name)){
    const {result}=await createProductCategoriesWorkflow(container).run({input:{product_categories:[{name,is_active:true}]}})
    categories.push(...result)
  }
  const fields=[{id:"fornitore",label:"Fornitore",type:"text",options:[],category:"",required:false},
    {id:"sistema_taglie",label:"Sistema taglie",type:"select",options:["EU","IT","UK","US","Alfabetico / taglia unica"],category:"",required:false},
    {id:"lunghezza_cm",label:"Lunghezza (cm)",type:"number",options:[],category:"Pellicce",required:false},
    {id:"larghezza_cm",label:"Larghezza (cm)",type:"number",options:[],category:"Borse",required:false},
    {id:"note",label:"Note interne",type:"text",options:[],category:"",required:false}]
  await updateStoresWorkflow(container).run({input:{selector:{id:store.id},update:{name:"Ishtar Lab",metadata:{...store.metadata,ishtar_catalog:{seller_id:sellerId,categories:categories.filter(c=>names.includes(c.name)).map(c=>({id:c.id,name:c.name})),fields}}}}})
  console.log("Catalogo Ishtar inizializzato: azienda, otto categorie e campi configurabili. Nessun vecchio database modificato.")
}
