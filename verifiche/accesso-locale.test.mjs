import {test} from 'node:test';
import assert from 'node:assert/strict';
import {richiestaLocale,intestazioniSicure} from '../backend/piattaforma/apps/console/accesso-locale.mjs';

// /__accesso-locale del server di sviluppo della console consegna il token del proprietario: solo pagine della console
// aperte su questo PC. Con il DNS rebinding un sito esterno può risultare «same-origin» con un nome suo che punta a
// 127.0.0.1: l'host deve essere quello locale.
const PORTA=5283;
const pagina=(host,altro={})=>({host,'sec-fetch-site':'same-origin',...altro});

test('pagine della console su questo PC: accesso concesso',()=>{
  for(const host of ['localhost:5283','127.0.0.1:5283','[::1]:5283','LOCALHOST:5283'])
    assert.equal(richiestaLocale(pagina(host),PORTA),true,host);
  assert.equal(richiestaLocale(pagina('localhost:5283',{origin:'http://localhost:5283'}),PORTA),true);
});
test('sito esterno con un nome che punta a 127.0.0.1 (DNS rebinding): rifiutato anche se «same-origin»',()=>{
  for(const host of ['attacco.example:5283','127.0.0.1.nip.io:5283','localhost.attacco.example:5283',undefined])
    assert.equal(richiestaLocale(pagina(host),PORTA),false,String(host));
});
test('altra porta, altra origine o richiesta da un altro sito: rifiutati',()=>{
  assert.equal(richiestaLocale(pagina('localhost:5284'),PORTA),false);
  assert.equal(richiestaLocale(pagina('localhost:5283',{origin:'http://attacco.example:5283'}),PORTA),false);
  assert.equal(richiestaLocale({host:'localhost:5283','sec-fetch-site':'cross-site'},PORTA),false);
  assert.equal(richiestaLocale({host:'localhost:5283'},PORTA),false);
});
test('la console non si apre dentro le pagine di altri siti (clic ingannevoli con l\'accesso da proprietario)',()=>{
  assert.equal(intestazioniSicure['X-Frame-Options'],'DENY');
  assert.match(intestazioniSicure['Content-Security-Policy'],/frame-ancestors 'none'/);
});
