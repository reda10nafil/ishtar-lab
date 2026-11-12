// Riempie il database locale con dati fittizi di un negozio di moda. Si può rilanciare: nessun doppione.
// Uso, dalla cartella multi-outfit: node infra/in-coda.mjs infra/popola-demo.mjs [fasi...] [--ordini=N]
// Senza fasi le esegue tutte. Per togliere tutto: node infra/in-coda.mjs infra/togli-demo.mjs
import * as base from './demo/fasi-base.mjs';
import * as vendite from './demo/fasi-ordini.mjs';
import * as sezioni from './demo/fasi-sezioni.mjs';
import { contesto, racconta } from './demo/comune.mjs';

const argomenti = process.argv.slice(2);
const scelte = argomenti.filter((a) => !a.startsWith('--'));
const limite = Number(argomenti.find((a) => a.startsWith('--ordini='))?.split('=')[1] ?? Infinity);

const FASI = [
  ['residui', base.residui],
  ['negozio', base.negozio],
  ['spedizioni', base.spedizioni],
  ['prodotti', base.prodotti],
  ['collezioni', base.collezioni],
  ['clienti', base.clienti],
  ['gruppi', base.gruppi],
  ['vetrina', sezioni.vetrina],
  ['sconti', sezioni.sconti],
  ['ingrosso', sezioni.ingrosso],
  ['outfit', sezioni.outfit],
  ['ordini', (c) => vendite.ordini(c, { limite })],
  ['bozze', vendite.bozze],
  ['scorte', base.scorte],
  ['carte', sezioni.carte],
  ['proposte', sezioni.proposte],
  ['assistenza', sezioni.assistenza],
  ['marketing', sezioni.marketing],
  ['traffico', sezioni.traffico],
];

const sconosciute = scelte.filter((s) => !FASI.some(([nome]) => nome === s));
if (sconosciute.length) throw new Error(`Fasi sconosciute: ${sconosciute.join(', ')}`);

const c = await contesto();
let errori = 0;
for (const [nome, fase] of FASI) {
  if (scelte.length && !scelte.includes(nome)) continue;
  racconta(`--- ${nome}`);
  try {
    await fase(c);
  } catch (errore) {
    errori += 1;
    racconta(`ERRORE in ${nome}: ${errore.message}`);
    c.salva();
  }
}
racconta(errori ? `Finito con ${errori} fasi da rilanciare` : 'Finito');
process.exitCode = errori ? 1 : 0;
