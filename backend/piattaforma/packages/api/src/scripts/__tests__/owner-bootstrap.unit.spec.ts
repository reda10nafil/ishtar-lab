import fs from 'node:fs'
jest.mock('@medusajs/framework/utils',()=>({Modules:{USER:'user',AUTH:'auth',WORKFLOW_ENGINE:'workflow'}}))
const prepara=require('../prepara-proprietario').default
describe('preparazione proprietario recuperabile',()=>{
  const before=process.env.ISHTAR_INSTANCE_ID
  beforeEach(()=>{
    process.env.ISHTAR_INSTANCE_ID='ishtar-lab-redx'
    const read=fs.readFileSync.bind(fs)
    jest.spyOn(fs,'readFileSync').mockImplementation(((file:any,...args:any[])=>String(file).endsWith('.credenziali-locali.env')?'ADMIN_EMAIL=owner@example.test\nADMIN_PASSWORD=local-test-password-longer-than-32-characters\n':(read as any)(file,...args)) as any)
    jest.spyOn(console,'log').mockImplementation(()=>{})
  })
  afterEach(()=>{jest.restoreAllMocks();if(before===undefined)delete process.env.ISHTAR_INSTANCE_ID;else process.env.ISHTAR_INSTANCE_ID=before})
  it('ripara una registrazione fallita dopo aver creato l’utente',async()=>{
    let user:any,identity:any
    const auth={authenticate:jest.fn(async()=>identity?{success:true,authIdentity:identity}:{success:false}),register:jest.fn().mockResolvedValueOnce({error:'temporary failure'}).mockImplementation(async()=>{identity={id:'auth_test',app_metadata:{}};return {authIdentity:identity}}),updateAuthIdentities:jest.fn(async(value:any)=>{identity.app_metadata=value.app_metadata})}
    const workflow={run:jest.fn(async()=>{user={id:'usr_test'};return {result:[user]}})}
    const services:any={user:{listUsers:async()=>user?[user]:[]},auth,workflow}
    const context={container:{resolve:(name:string)=>services[name]}}
    await expect(prepara(context)).rejects.toThrow('not ready')
    await expect(prepara(context)).resolves.toBeUndefined()
    expect(workflow.run).toHaveBeenCalledTimes(1);expect(identity.app_metadata.user_id).toBe('usr_test')
  })
  it('ripara il collegamento interrotto senza sovrascrivere altri metadati',async()=>{
    const identity:any={id:'auth_test',app_metadata:{member_id:'member_test'}}
    const auth={authenticate:async()=>({success:true,authIdentity:identity}),register:jest.fn(),updateAuthIdentities:async(value:any)=>{identity.app_metadata=value.app_metadata}}
    const services:any={user:{listUsers:async()=>[{id:'usr_test'}]},auth}
    await prepara({container:{resolve:(name:string)=>services[name]}})
    expect(identity.app_metadata).toEqual({member_id:'member_test',user_id:'usr_test'});expect(auth.register).not.toHaveBeenCalled()
  })
  it('non riassegna identità già collegate ad altri utenti',async()=>{
    const services:any={user:{listUsers:async()=>[{id:'usr_test'}]},auth:{authenticate:async()=>({success:true,authIdentity:{id:'auth_test',app_metadata:{user_id:'another'}}})}}
    await expect(prepara({container:{resolve:(name:string)=>services[name]}})).rejects.toThrow('different user')
  })
})
