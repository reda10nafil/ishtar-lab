import type { ExecArgs } from '@medusajs/framework/types'
import { Modules } from '@medusajs/framework/utils'
import fs from 'node:fs'
import path from 'node:path'

/** Crea solo il proprietario locale; nessun prodotto o account dimostrativo. */
export default async function prepara({container}: ExecArgs) {
  if(process.env.ISHTAR_INSTANCE_ID!=='ishtar-lab-redx') throw new Error('Wrong instance')
  const file=path.resolve(process.cwd(),'../../../.credenziali-locali.env')
  const creds=Object.fromEntries(fs.readFileSync(file,'utf8').trim().split(/\r?\n/).map(line=>line.split(/=(.*)/s).slice(0,2)))
  const email=creds.ADMIN_EMAIL,password=creds.ADMIN_PASSWORD
  if(!email||!password||password.length<32)throw new Error('Local owner credentials are missing')
  const users=container.resolve(Modules.USER),auth=container.resolve(Modules.AUTH)
  const existing=await users.listUsers({email})
  let user=existing[0]
  if(!user){
    const workflow=container.resolve(Modules.WORKFLOW_ENGINE)
    const {result}=await workflow.run('create-users-workflow',{input:{users:[{email}]}})
    user=result[0]
  }
  // Riconcilia anche un tentativo precedente interrotto dopo la creazione dell’utente.
  const login=await auth.authenticate('emailpass',{body:{email,password}})
  const identity=login.success&&login.authIdentity ? login.authIdentity : (await auth.register('emailpass',{body:{email,password}})).authIdentity
  if(!identity)throw new Error('Owner authentication not ready; no existing password was reset')
  const metadata=(identity.app_metadata??{}) as Record<string,unknown>
  if(metadata.user_id&&metadata.user_id!==user.id)throw new Error('Owner identity belongs to a different user')
  if(metadata.user_id!==user.id)await auth.updateAuthIdentities({id:identity.id,app_metadata:{...metadata,user_id:user.id}})
  const checked=await auth.authenticate('emailpass',{body:{email,password}})
  if(!checked.success||checked.authIdentity?.app_metadata?.user_id!==user.id)throw new Error('Owner authentication verification failed')
  console.log('Proprietario locale pronto. Credenziali nel file privato della copia.')
}
