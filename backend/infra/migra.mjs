import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {RADICE} from './istanza.mjs';
const args=process.argv.slice(2);
if(args.length && !(args.length===2 && args[0]==='genera' && /^[a-z][a-z0-9-]*$/.test(args[1])))throw new Error('Uso: node infra/migra.mjs [genera nome-modulo]');
const r=spawnSync(process.execPath,[path.join(RADICE,'infra/runtime.mjs'),...(args.length?['generate',args[1]]:['migrate'])],{stdio:'inherit',windowsHide:true});
process.exitCode=r.status??1;
