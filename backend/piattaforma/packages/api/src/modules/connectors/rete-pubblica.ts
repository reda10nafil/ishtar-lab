import https from 'node:https'
import { lookup } from 'node:dns/promises'
import type { LookupAddress } from 'node:dns'
import { isIP, type LookupFunction } from 'node:net'
import ipaddr from 'ipaddr.js'

export function indirizzoPubblico(address: string): boolean {
  try {
    const parsed=ipaddr.process(address)
    if(parsed.range()!=='unicast')return false
    if(parsed.kind()==='ipv6'){
      const v6=parsed as ipaddr.IPv6
      return v6.match(ipaddr.IPv6.parseCIDR('2000::/3')) && !v6.match(ipaddr.IPv6.parseCIDR('3fff::/20'))
    }
    return true
  } catch { return false }
}

export type Risolvi = (hostname: string) => Promise<LookupAddress[]>
/** Il controllo avviene nel lookup della connessione: nessuna seconda risoluzione DNS. */
export function lookupPubblico(resolve: Risolvi = host => lookup(host, {all:true,verbatim:true})): LookupFunction {
  return ((hostname: string, options: {all?: boolean; family?: number}, callback: (...args: any[]) => void) => {
    resolve(hostname).then(addresses => {
      if (!addresses.length || addresses.some(a => !indirizzoPubblico(a.address))) throw new Error('Destination is not public')
      const allowed = options?.family ? addresses.filter(a => a.family === options.family) : addresses
      if (!allowed.length) throw new Error('No public address for requested family')
      if (options?.all) callback(null, allowed)
      else callback(null, allowed[0].address, allowed[0].family)
    }).catch(error => callback(error))
  }) as LookupFunction
}

/** Solo WooCommerce: TLS predefinito, IP verificato, nessun redirect o socket condiviso. */
export function leggiHttpsPubblico(address: string, headers?: Record<string,string>): Promise<Response> {
  return new Promise((resolve,reject) => {
    const url = new URL(address)
    const host = url.hostname.replace(/^\[|\]$/g,'')
    if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||(isIP(host)&&!indirizzoPubblico(host))) {
      reject(new Error('Invalid public HTTPS destination')); return
    }
    const req = https.request(url,{method:'GET',headers,agent:false,lookup:lookupPubblico(),signal:AbortSignal.timeout(10_000)},res=>{
      const status=res.statusCode??502
      if(status<200||status>599){res.destroy();reject(new Error('Invalid HTTP status'));return}
      if(status>=300&&status<400){res.destroy();reject(new Error('Redirect refused'));return}
      const chunks:Buffer[]=[];let size=0
      res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>1024*1024)req.destroy(new Error('Response too large'));else chunks.push(chunk)})
      res.on('error',reject)
      res.on('end',()=>{try{resolve(new Response([204,205].includes(status)?null:Buffer.concat(chunks).toString('utf8'),{status}))}catch(error){reject(error)}})
    })
    req.on('error',reject)
    req.end()
  })
}
