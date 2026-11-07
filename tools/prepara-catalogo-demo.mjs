import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Workbook } from '@oai/artifact-tool';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'outputs', 'ishtar-catalogo-20261106');
const source = path.join(root, 'dati', 'sorgenti', 'inventario_2026-06-21.csv');
const raw = await fs.readFile(source);
const sourceHash = createHash('sha256').update(raw).digest('hex');
const sourceWb = await Workbook.fromCSV(raw.toString('utf8').replace(/^\uFEFF/, ''), { sheetName: 'Sorgente' });
const table = sourceWb.worksheets.getItem('Sorgente').getUsedRange().values;
const originalHeaders = table[0];
const records = table.slice(1).filter(r => r.some(v => String(v ?? '').trim()));
const additional = ['Genere', 'Colore', 'Sistema Taglie', 'Materiale', 'Brand', 'Valuta', 'Stato',
  'Link Prodotto', 'Tipo Dati', 'Campi Fittizi', 'SKU Originale', 'Record Sorgente', 'Stato Foto'];
const headers = [...originalHeaders, ...additional];
const fur = new Set(['visone', 'volpe', 'zibellino', 'cincilla', 'ermellino', 'astrakan']);
const colors = ['Nero', 'Avorio', 'Blu notte', 'Verde smeraldo', 'Bordeaux', 'Rosa cipria'];
const furNames = ['Aurora', 'Selene', 'Livia', 'Dafne', 'Venere', 'Arianna', 'Ninfea', 'Vesta'];
const priceFor = { Pellicce: 890, Borse: 145, Scarpe: 95, Accessori: 39, 'Parte sopra': 75 };
const rows = [];
const log = [];
for (const [i, values] of records.entries()) {
  const row = Object.fromEntries(originalHeaders.map((k, j) => [k, String(values[j] ?? '').trim()]));
  const generated = new Set();
  const changes = {};
  const set = (key, value, reason = 'Valore dimostrativo autorizzato') => {
    const before = row[key] ?? '';
    row[key] = String(value); generated.add(key);
    changes[key] = { before, after: row[key], reason };
  };
  const originalSku = row.SKU;
  const material = fur.has(row.Categoria.toLowerCase()) ? row.Categoria.toLowerCase() : null;
  if (/^https?:\/\//i.test(row.SKU) || !row.SKU) set('SKU', `ISH-DEMO-${String(i + 1).padStart(4, '0')}`, 'Identificatore stabile per questa copia; origine conservata');
  if (material) set('Categoria', 'Pellicce', 'Normalizzazione della categoria originale; materiale separato');
  else if (!row.Categoria) set('Categoria', /portamonete|guitar straps/i.test(row.Nome) ? 'Accessori' : 'Borse', 'Categoria dimostrativa, non classificazione verificata del prodotto');
  else if (row.Categoria === 'Abbigliamento') set('Categoria', 'Parte sopra', 'Categoria proposta per i due nomi giacca/felpa del file');
  if (!row.Nome || /^senza nome$/i.test(row.Nome)) set('Nome', `Pelliccia ${furNames[i % furNames.length]} ${String(i + 1).padStart(2, '0')} (demo)`);
  if (!row.Descrizione) set('Descrizione', `Scheda dimostrativa per ${row.Nome}. Campi generati per provare il catalogo; caratteristiche da verificare prima dell'uso reale.`);
  if (!row['Taglia/Variante']) set('Taglia/Variante', row.Categoria === 'Pellicce' ? ['S', 'M', 'L', 'XL'][i % 4] : 'Unica');
  if (!row.Fornitore) set('Fornitore', `Fornitore Demo ${String(i % 3 + 1).padStart(2, '0')}`);
  if (!row['Codice a Barre']) set('Codice a Barre', `DEMO-${String(i + 1).padStart(6, '0')}`, 'Codice interno dimostrativo per Code 128; non EAN/GTIN commerciale');
  if (!row.Note) set('Note', 'Dati integrati per dimostrazione su autorizzazione dell’utente.');
  if (!row['Link Foto']) set('Link Foto', 'http://127.0.0.1:4273/brand/segnaposto-prodotto.svg', 'Segnaposto esplicito, non fotografia del prodotto');
  if (Number(row['Prezzo Vendita']) === 0) set('Prezzo Vendita', (priceFor[row.Categoria] + i % 5 * 25).toFixed(2), 'Prezzo dimostrativo al posto dello zero sorgente; nessuna valutazione di mercato');
  if (Number(row['Costo Acquisto']) === 0) set('Costo Acquisto', (Number(row['Prezzo Vendita']) * 0.45).toFixed(2), 'Costo dimostrativo, 45% del prezzo per una prova coerente');
  set('Genere', row.Categoria === 'Pellicce' ? 'Donna' : ['Uomo', 'Donna', 'Unisex'][i % 3], 'Destinazione dimostrativa, non dedotta dalle foto');
  set('Colore', colors[i % colors.length], 'Colore dimostrativo, non dedotto dalle foto');
  set('Sistema Taglie', /^\d/.test(row['Taglia/Variante']) ? 'EU' : 'Alfabetico / taglia unica', 'Sistema dimostrativo; valore originale della taglia conservato');
  const desc = row.Descrizione.toLowerCase();
  const sourceMaterial = /pelle vegana/.test(desc) ? 'Pelle vegana' : /cuoio/.test(desc) ? 'Cuoio' : /cotone/.test(desc) ? 'Cotone' : null;
  const demoMaterial = {Borse:'Pelle sintetica',Scarpe:'Tessuto e gomma',Accessori:'Tessuto sintetico','Parte sopra':'Cotone'};
  set('Materiale', material ?? sourceMaterial ?? demoMaterial[row.Categoria] ?? 'Tessuto sintetico', material || sourceMaterial ? 'Valore ricavato dalla categoria o descrizione originale' : 'Materiale dimostrativo, da verificare');
  set('Brand', 'Brand Demo'); set('Valuta', 'EUR', 'Valuta di dimostrazione; il CSV sorgente non la specifica');
  row.Stato = 'bozza'; row['Tipo Dati'] = 'DEMO';
  row['Link Prodotto'] = `https://example.invalid/ishtar-demo/${row.SKU.toLowerCase()}`;
  generated.add('Link Prodotto');
  row['SKU Originale'] = originalSku;
  row['Record Sorgente'] = String(i + 2);
  row['Stato Foto'] = generated.has('Link Foto') ? 'segnaposto demo' : 'URL sorgente non verificato';
  row['Campi Fittizi'] = [...generated].join(' | ');
  rows.push(headers.map(k => row[k] ?? ''));
  log.push({ record: i + 2, sku: row.SKU, changes, generated_fields: [...generated] });
}
if (new Set(rows.map(r => r[0])).size !== records.length) throw new Error('SKU duplicati');
const wb = Workbook.create();
const sheet = wb.worksheets.add('Catalogo Demo');
sheet.getRangeByIndexes(0, 0, rows.length + 1, headers.length).values = [headers, ...rows];
wb.recalculate();
// Il formato richiesto è CSV: serializzare i valori del modello Artifact Tool,
// senza introdurre formule, styling XLSX o ulteriori copie del foglio.
const csvCell = v => {
  const s = String(v ?? '');
  if (/^[=+@\t\r\n]/.test(s)) throw new Error('Prefisso non sicuro in una cella testuale');
  return /[",\r\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
};
const matrix = sheet.getUsedRange().values;
const csv = '\uFEFF' + matrix.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, 'inventario-demo.csv'), csv, 'utf8');
await fs.writeFile(path.join(out, 'provenienza-demo.json'), JSON.stringify({
  source, source_sha256: sourceHash, rows: records.length, mode: 'DEMO', imported: false,
  note: 'Valori originali validi conservati; zero stock conservati. Solo in questa copia demo prezzi e costi zero integrati con valori sintetici.',
  source_sku_mapping: log.map(r => ({ source_record: r.record, assigned_sku: r.sku })), records: log,
}, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ file: path.join(out, 'inventario-demo.csv'), rows: rows.length, columns: headers.length, uniqueSku: new Set(rows.map(r => r[0])).size, source_sha256: sourceHash }));
