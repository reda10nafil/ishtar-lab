import { lookupPubblico, indirizzoPubblico, leggiHttpsPubblico } from '../rete-pubblica'
import {eseguiProva} from '../prova'
import https from 'node:https'
import {EventEmitter} from 'node:events'
import { trovaServizio, valoriValidi } from '../catalogo'
const query=(records:{address:string;family:number}[],options:Record<string,unknown>={})=>new Promise((resolve,reject)=>{
  (lookupPubblico(async()=>records) as any)('shop.example',options,(error:Error|null,...args:unknown[])=>error?reject(error):resolve(args))
})
describe('WooCommerce: indirizzi e DNS',()=>{
  it.each(['127.0.0.1','10.0.0.1','192.168.0.1','169.254.169.254','100.64.0.1','0.0.0.0','224.0.0.1','::1','fc00::1','fe80::1','::ffff:127.0.0.1','2001:db8::1','fec0::1','64:ff9b:1::a00:1','::7f00:1','3fff::1','5f00::1'])('rifiuta %s',ip=>expect(indirizzoPubblico(ip)).toBe(false))
  it.each(['8.8.8.8','1.1.1.1','2606:4700:4700::1111'])('accetta IP pubblico %s',ip=>expect(indirizzoPubblico(ip)).toBe(true))
  it('blocca un nome pubblico che risolve un IP privato',async()=>{await expect(query([{address:'127.0.0.1',family:4}])).rejects.toThrow('not public')})
  it('blocca risposte DNS miste',async()=>{await expect(query([{address:'8.8.8.8',family:4},{address:'::1',family:6}])).rejects.toThrow('not public')})
  it('fornisce alla connessione solo gli IP verificati, senza un secondo DNS',async()=>{
    const resolver=jest.fn(async()=>[{address:'8.8.8.8',family:4}]);const fn=lookupPubblico(resolver)
    const result=await new Promise((resolve,reject)=>(fn as any)('shop.example',{all:true},(e:Error|null,rows:unknown)=>e?reject(e):resolve(rows)))
    expect(result).toEqual([{address:'8.8.8.8',family:4}]);expect(resolver).toHaveBeenCalledTimes(1)
  })
  it('seleziona la famiglia richiesta solo dopo aver verificato tutte le risposte',async()=>{await expect(query([{address:'8.8.8.8',family:4}],{family:6})).rejects.toThrow('requested family')})
  it('propaga il fallimento DNS',async()=>{const fn=lookupPubblico(async()=>{throw new Error('DNS failed')});await expect(new Promise((resolve,reject)=>(fn as any)('shop.example',{},(e:Error|null,v:unknown)=>e?reject(e):resolve(v)))).rejects.toThrow('DNS failed')})
  const woo=trovaServizio('woocommerce')!
  it.each(['https://user:pass@shop.example','https://shop.example/?a=1','https://shop.example/#x','https://localhost.','https://2130706433','https://0x7f000001'])('rifiuta indirizzo ambiguo %s',site=>expect(valoriValidi(woo,{site,consumer_key:'key',consumer_secret:'secret'})).not.toBeNull())
  it('conserva sottocartelle WordPress e porte HTTPS',()=>{const values={site:'https://shop.example:8443/wordpress/',consumer_key:'key',consumer_secret:'secret'};expect(valoriValidi(woo,values)).toBeNull();expect(woo.prova!(values).url).toBe('https://shop.example:8443/wordpress/wp-json/wc/v3/system_status')})
  afterEach(()=>jest.restoreAllMocks())
  function reply(status:number){
    return jest.spyOn(https,'request').mockImplementation(((_url:unknown,_options:unknown,done:(r:any)=>void)=>{
      const req=new EventEmitter() as any;req.end=()=>{};req.destroy=()=>{};
      queueMicrotask(()=>{const res=new EventEmitter() as any;res.statusCode=status;res.destroy=()=>{};done(res);res.emit('data',Buffer.from('{"ok":true}'));res.emit('end')});return req
    }) as any)
  }
  it('rifiuta stati HTTP non standard senza eccezioni fuori dal promise',async()=>{reply(600);await expect(leggiHttpsPubblico('https://shop.example/')).rejects.toThrow('Invalid HTTP status')})
  it('rifiuta i redirect',async()=>{reply(302);await expect(leggiHttpsPubblico('https://shop.example/')).rejects.toThrow('Redirect refused')})
  it('mantiene URL, lookup verificato e TLS predefinito nelle richieste ammesse',async()=>{
    const spy=reply(200);const result=await leggiHttpsPubblico('https://shop.example/wordpress/')
    expect(await result.json()).toEqual({ok:true});const [url,options]=spy.mock.calls[0] as any[]
    expect(url.hostname).toBe('shop.example');expect(options.agent).toBe(false);expect(options.lookup).toEqual(expect.any(Function));expect(options.rejectUnauthorized).not.toBe(false)
  })
  it('gestisce risposte senza corpo',async()=>{reply(204);expect((await leggiHttpsPubblico('https://shop.example/')).status).toBe(204)})
  it('verifica nuovamente anche un sito privato già salvato, senza usare fetch non protetto',async()=>{
    const unsafe=jest.fn();const spy=jest.spyOn(https,'request');const result=await eseguiProva(woo,{site:'https://127.0.0.1',consumer_key:'key',consumer_secret:'secret'},undefined,unsafe as any)
    expect(result.ok).toBe(false);expect(unsafe).not.toHaveBeenCalled();expect(spy).not.toHaveBeenCalled()
  })
})
