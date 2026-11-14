// Costruisce dist/ishtar-chat.js con bun: un solo file minimizzato (script classico) con supabase-js dentro e, in testa,
// gli avvisi di licenza di tutti i pacchetti inclusi. Uso: bun install --frozen-lockfile && bun costruisci.mjs
import {readdirSync, readFileSync, statSync} from 'node:fs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';

const qui = import.meta.dir;
const moduli = path.join(qui, 'node_modules');
const pacchetti = new Map();

/** supabase-js e le sue dipendenze, con il testo della licenza di ognuno. */
function visita(nome) {
  if (pacchetti.has(nome)) return;
  const cartella = path.join(moduli, nome);
  const descrizione = JSON.parse(readFileSync(path.join(cartella, 'package.json'), 'utf8'));
  const file = readdirSync(cartella).find(f => /^licen[cs]e(\.(md|txt))?$/i.test(f));
  if (!file) throw new Error(`License file missing for ${nome}`);
  pacchetti.set(nome, {versione: descrizione.version, licenza: descrizione.license, testo: readFileSync(path.join(cartella, file), 'utf8').replace(/\r\n?/g, '\n').trim()});
  for (const dipendenza of Object.keys(descrizione.dependencies ?? {})) visita(dipendenza);
}
for (const nome of Object.keys(JSON.parse(readFileSync(path.join(qui, 'package.json'), 'utf8')).dependencies)) visita(nome);

const avvisi = [...pacchetti].map(([nome, p]) => `${nome} ${p.versione} (${p.licenza})\n\n${p.testo}`).join('\n\n----\n\n');
const banner = `/*! Ishtar Lab site chat widget. This file includes code from @supabase/supabase-js ${pacchetti.get('@supabase/supabase-js').versione} and its\n   dependencies (the parts the widget does not use are left out), under these licenses:\n\n${avvisi.replaceAll('*/', '* /')}\n*/`;

const esito = await Bun.build({
  entrypoints: [path.join(qui, 'src/avvio.mjs')],
  outdir: path.join(qui, 'dist'),
  naming: 'ishtar-chat.js',
  target: 'browser',
  format: 'iife',
  minify: true,
  banner,
});
if (!esito.success) {
  for (const riga of esito.logs) console.error(riga);
  process.exit(1);
}
for (const uscita of esito.outputs) {
  const byte = statSync(uscita.path).size;
  console.log(`${path.relative(qui, uscita.path)}: ${(byte / 1024).toFixed(1)} KB, ${(gzipSync(readFileSync(uscita.path)).length / 1024).toFixed(1)} KB gzip`);
}
console.log(`licenze incluse: ${[...pacchetti].map(([nome, p]) => `${nome} ${p.versione} ${p.licenza}`).join(', ')}`);
