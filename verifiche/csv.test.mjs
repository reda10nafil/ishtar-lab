import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV,numberCSV} from '../frontend/ishtar-lab/catalogo/csv.mjs';
test('BOM e CRLF, virgole e virgolette nei testi',()=>assert.deepEqual(parseCSV('\uFEFFSKU,Nome\r\nA,"Borsa, \"\"Luna\"\""\r\n').rows,[['A','Borsa, "Luna"']]));
test('CSV italiano e ritorni a capo nella descrizione',()=>assert.deepEqual(parseCSV('SKU;Descrizione;Prezzo\nA;"Riga 1\r\nRiga 2";"12,50"\n').rows,[['A','Riga 1\r\nRiga 2','12,50']]));
test('intestazioni duplicate e colonne mancanti rifiutate',()=>{assert.throws(()=>parseCSV('SKU,SKU\nA,B'));assert.throws(()=>parseCSV('SKU,Nome\nA'));});
test('virgolette non chiuse rifiutate',()=>assert.throws(()=>parseCSV('SKU,Nome\nA,"errore')));
test('numeri italiani, zero e valori non finiti',()=>{assert.equal(numberCSV('1.234,50'),1234.5);assert.equal(numberCSV('0'),0);assert.throws(()=>numberCSV('Infinity'));assert.throws(()=>numberCSV('-2'));});
