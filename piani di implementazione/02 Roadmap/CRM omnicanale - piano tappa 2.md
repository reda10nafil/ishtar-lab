---
title: "CRM omnicanale - piano tappa 2"
updated: 2026-11-13
type: documentazione-progetto
tags: [ishtar-lab]
---

# CRM tappa 2: pagina «Chats» nel primo pannello — piano

> **Per chi esegue:** sotto-skill richiesta: superpowers:subagent-driven-development (consigliata) oppure superpowers:executing-plans, un task alla volta. I passi usano le caselle (`- [ ]`).

**Obiettivo:** nel primo pannello una pagina «Chats» con l'elenco delle conversazioni, la conversazione con risposte rapide e invio, e la scheda del cliente con i suoi ordini, sui dati veri del backend attraverso il ponte locale.

**Architettura:**
- La pagina è un componente React scritto contro il runtime e i componenti del kit originale, come le altre pagine:
  - testata `phead`, schede `tabs`, `card`, `chip`, `pill`, avatar, stato vuoto, cassetto e finestre del kit.
- Il router e il menu ricevono solo le voci nuove: modifiche testuali minime ai due bundle.
- La logica sta in moduli `.mjs` senza DOM, provati con `node --test`:
  - aiuti puri;
  - richieste al ponte;
  - un controllo della casella con dipendenze iniettate, che tiene lo stato, ordina le risposte del server e gestisce le risposte in attesa.
- Il ponte Python apre solo i percorsi della casella, con identificativi e parametri verificati.

**Tecnologie:**
- React 19 già dentro il kit;
- moduli ES serviti da `avvia_pannello.py`;
- Python 3 (ponte);
- `node --test`, `unittest`, jest (backend).

Nessuna dipendenza nuova.

**Progetto:** [[CRM omnicanale - progetto]], tappa 2. Contratto dell'API dalla tappa 1: [[CRM omnicanale - piano tappa 1]].

## Vincoli globali

- **Ramo e file protetti.** Ramo `crm-tappa2` dal main 7a0b362. Non toccare `LICENSE.md`, `LICENSING-SCOPE.md`, `THIRD_PARTY_NOTICES.md`, `licensing/`, `frontend/legal/`.
- **Lingua.** Testi della pagina in inglese, come il pannello e i messaggi d'errore dell'API; commenti in italiano.
- **Stile** (`.ai-style-rules.md`):
  - classi e componenti originali;
  - classi nuove solo con prefisso `chat-` e solo con i token esistenti (`--card`, `--ink`, `--muted`, `--line`, `--accent`, `--accent-ink`, `--accent-soft`, `--good`, `--warn`, `--bad` e i loro `-soft`, `--r-*`, `--gap`, `--fs-*`);
  - niente fondi bianchi o colori fissi.
- **Dati veri fuori dallo stato dimostrativo.** Mai in `localStorage`/`sessionStorage`, mai in `lumelle:data`, mai nel registro attività del kit (`dt`/`gs`), mai con `it` (mutateLegacy). Restano solo in memoria.
- **Orologio vero.** Niente aiuti del kit per le date: usano l'orologio dimostrativo fermo al 30/10/2026. Si formatta con `Intl` in `en-GB`.
- **Id delle risposte.**
  - `crypto.randomUUID().replaceAll('-','')` (32 caratteri, dentro `^[A-Za-z0-9_-]{8,80}$`).
  - Ogni nuovo tentativo della stessa risposta usa lo stesso id.
  - Un id nuovo solo con «Send again», dopo la conferma della persona.
- **Lettura e «letta».** Si legge solo con la demo «entrata» (`wt.signedIn`) e la pagina visibile. «Letta» si manda solo con la pagina visibile e in primo piano (`document.hasFocus()`).
- **Ponte** (`catalog_bridge.py`):
  - stessi controlli di oggi: Host, Origin, Sec-Fetch-Site, `X-Ishtar-Local`;
  - solo i percorsi elencati nel Task 2, con gli id riconosciuti dal prefisso (`conv_`, `rrap_`, `cus_` + `[0-9A-Za-z]{8,64}`);
  - solo i parametri elencati;
  - corpi JSON fino a 64 KB.
- **Modifiche ai bundle.** Solo le sostituzioni del Task 5, ognuna trovata esattamente una volta. Controllo sintattico come modulo ES.
- **Test** (dalla radice del repository):
  - `node --test verifiche/*.test.mjs`;
  - `python3 -m unittest verifiche/test_ponte.py`;
  - da `backend/`, `node piattaforma/packages/api/node_modules/jest/bin/jest.js --config infra/jest-security.cjs --runInBand`;
  - typecheck `node piattaforma/node_modules/typescript/bin/tsc -p piattaforma/packages/api/tsconfig.json --noEmit --incremental false`.
- **Prove nel browser** sull'istanza locale:
  - backup del database prima, ripristino alla fine (database separato e scambio dei nomi);
  - Telegram finto con `TELEGRAM_API_BASE`;
  - nessun token vero;
  - il cliente di prova sparisce con il ripristino.
- **Commit e PR.** Commit con l'email noreply di satria64 e la riga `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; PR con la dichiarazione di `CONTRIBUTING.md` e la riga finale di Claude Code.

## Da tenere d'occhio nella revisione

1. **Risposta di cui si perde l'esito** (rete, ponte o API che cadono a metà): la risposta non parte mai due volte e non sparisce in silenzio. Resta «Not sent yet» con lo stesso id finché il server non mostra la sua riga (riconosciuta da `id_client`). Prove nel Task 4.
2. **Risposta vecchia del server** che arriva dopo una più nuova, o dopo il cambio di conversazione: non sovrascrive lo stato e non mostra la conversazione sbagliata. Prove nel Task 4.
3. **Pannello nascosto o non in primo piano:** nessuna «letta», i non letti restano. Prove nel Task 4; prova nel browser nel Task 6.
4. **Testi ostili** (HTML, parole lunghissime, emoji, 4000 caratteri): si vedono come testo e non allargano la pagina. Prova nel browser nel Task 6.
5. **Indirizzi truccati verso il ponte** (`..`, caratteri codificati, parametri in più o ripetuti, metodo sbagliato): 404 o 400, mai inoltrati. Prove nel Task 2.

---

### Task 1: id della risposta nella vista dei messaggi (backend)

Il pannello deve riconoscere la propria risposta nella conversazione riletta (stesso id generato dal pannello): senza, una risposta in attesa e la sua riga sul server comparirebbero due volte, e dopo un ricaricamento una risposta fallita non si potrebbe ritentare con lo stesso id.

**File** (relativi a `backend/piattaforma/packages/api/`):
- Modifica: `src/api/admin/conversazioni/lib/elenco.ts` (`MessaggioLetto`, `vistaMessaggio`)
- Test: `src/api/admin/conversazioni/__tests__/elenco.unit.spec.ts`

**Interfacce:**
- Produce: `vistaMessaggio(m)` aggiunge `id_client: string | null`. Vale l'id dopo `uscita:` in `chiave_unica` per i messaggi `uscita`, `null` per gli altri. La chiave dei messaggi in arrivo non si espone.

- [ ] **Step 1: test che fallisce**

```ts
it("id della risposta solo per i messaggi in uscita", () => {
  const base = { id: "msgc_1", testo: "Ciao", quando: "2026-11-13T10:00:00Z", stato_consegna: "inviato", errore: null, autore_nome: "Reda" }
  expect(vistaMessaggio({ ...base, direzione: "uscita", chiave_unica: "uscita:abc12345" }).id_client).toBe("abc12345")
  expect(vistaMessaggio({ ...base, direzione: "entrata", chiave_unica: "telegram:bot:42" }).id_client).toBeNull()
  expect(vistaMessaggio({ ...base, direzione: "uscita", chiave_unica: null }).id_client).toBeNull()
})
```

- [ ] **Step 2:** jest sul file. Atteso: FAIL (`id_client` undefined).
- [ ] **Step 3:** `MessaggioLetto` riceve `chiave_unica?: string | null`; `vistaMessaggio` calcola `id_client`.
- [ ] **Step 4:** jest completo e typecheck. Atteso: tutto verde, 0 errori.
- [ ] **Step 5: commit** `feat(conversazioni): id della risposta nella vista dei messaggi`

### Task 2: percorsi della casella nel ponte locale

**File:**
- Modifica: `catalog_bridge.py` (tabella dei percorsi, parametri, limite del corpo, DELETE);
- Modifica: `avvia_pannello.py` (`do_DELETE` che passa al ponte);
- Test: `verifiche/test_ponte.py`.

**Interfacce:**
- Produce i percorsi del pannello. `ID(p)` = `p_[0-9A-Za-z]{8,64}`.

| Metodo | Percorso del pannello | Inoltro all'API | Parametri |
|---|---|---|---|
| GET | `/api/conversazioni` | `/admin/conversazioni` | `stato`, `canale`, `q`, `limit`, `offset` |
| GET | `/api/conversazioni/ID(conv)` | `/admin/conversazioni/<id>` | nessuno |
| POST | `/api/conversazioni/ID(conv)/(messaggi\|stato\|letta\|cliente)` | stesso percorso sotto `/admin` | nessuno |
| GET, POST | `/api/risposte-rapide` | `/admin/risposte-rapide` | nessuno |
| POST, DELETE | `/api/risposte-rapide/ID(rrap)` | `/admin/risposte-rapide/<id>` | nessuno |
| GET | `/api/clienti` | `/admin/clienti` | `q`, `limit` |
| GET | `/api/clienti/ID(cus)` | `/admin/clienti/<id>` | nessuno |

- Regole dei parametri e degli indirizzi:
  - **Parametri.** Letti con `parse_qs(keep_blank_values=True)`.
    - Una chiave sconosciuta o ripetuta, oppure un valore oltre 200 caratteri: 400 con messaggio JSON.
    - Validi: si inoltrano ricodificati con `urlencode`.
  - **Indirizzi senza parametri.** Con una query: 404.
  - **Corpi.** Un POST della casella vuole `application/json`, altrimenti 415, e al massimo 64 KB, altrimenti 413. Un DELETE non ha corpo.
- Invariati per `/api/catalogo` e `/api/foto`: percorso esatto, metodi, 25 MB e 415 del catalogo.

- [ ] **Step 1: test che falliscono.** `FintaAPI` registra metodo e percorso ricevuti e risponde 200 `{}` sui percorsi `/admin/...`.
  - `test_casella_percorsi_inoltrati`: per ogni riga della tabella (con un id valido come `conv_01JC5ABCDEFGHJKMNPQRSTVWXY`), lo stato è 200 e `FintaAPI` ha ricevuto metodo e percorso attesi.
  - `test_casella_parametri_ripuliti`:
    - `?q=a%26stato%3Dchiuse&limit=5` arriva come `q=a%26stato%3Dchiuse&limit=5`;
    - `?x=1`, `?q=a&q=b`, `q` di 201 caratteri, `?limit=5` su `/api/clienti/cus_...`: 400 o 404 e nulla inoltrato.
  - `test_casella_percorsi_rifiutati`, sempre 404 e nulla inoltrato:
    - `/api/conversazioni/../clienti`;
    - `/api/conversazioni/conv_01JC5ABCDEFGH%2F..`;
    - `/api/conversazioni/abc12345678`;
    - `/api/clienti/conv_01JC5ABCDEFGHJKM`;
    - DELETE su `/api/conversazioni/conv_...`;
    - GET su `/api/conversazioni/conv_.../messaggi`;
    - POST su `/api/clienti`.
  - `test_casella_corpo_json_e_limite`: POST `messaggi` con `text/plain` dà 415; con 70 KB dà 413.
  - `test_delete_servito`: `avvia_pannello.Handler` ha `do_DELETE`.
- [ ] **Step 2:** `python3 -m unittest verifiche/test_ponte.py`. Atteso: i nuovi FAIL, i vecchi 8 OK.
- [ ] **Step 3: implementazione.** `handle(handler)` separa percorso e query (`urlsplit`), poi cerca prima i due percorsi del catalogo, poi la tabella della casella (`re.fullmatch`). Il 401 si rinnova una sola volta come oggi.
- [ ] **Step 4:** stessi test. Atteso: tutti OK.
- [ ] **Step 5: commit** `feat(ponte): percorsi della casella dei clienti`

### Task 3: aiuti puri e richieste del pannello

**File:**
- Crea: `frontend/ishtar-lab/chat/casella.mjs`, `frontend/ishtar-lab/chat/api.mjs`
- Test: `verifiche/chat-casella.test.mjs`, `verifiche/chat-api.test.mjs` (in testa `process.env.TZ='Europe/Rome'`)

**Interfacce:**
- Produce (`api.mjs`):
  - `class ErroreRichiesta extends Error { stato:number; codice?:string; dati?:object }`
  - `richiesta(percorso, {metodo='GET', corpo, fetch=globalThis.fetch}={}): Promise<object>`:
    - intestazione `X-Ishtar-Local: 1`;
    - con `corpo`, `Content-Type: application/json` e il corpo in JSON;
    - errore di rete: `stato` 0;
    - risposta non JSON: `stato` = codice HTTP;
    - non ok: `message` del corpo, `codice` = `code`, `dati` = corpo.
- Produce (`casella.mjs`):
  - **Etichette e nomi.**
    - `etichettaCanale(canale)`: `telegram` → `Telegram`, `email` → `Email`, `sito` → `Site chat`, `whatsapp` → `WhatsApp`, `instagram` → `Instagram`, `messenger` → `Messenger`.
    - `etichettaStato(stato)`: `aperta` → `Open`, `in_attesa` → `Waiting for customer`, `chiusa` → `Closed`.
    - `nomeContatto(x)`: `nome`, poi `recapito`, poi `Customer` (mai vuoto: l'avatar del kit lo richiede).
  - **Orari** (relativi a `adesso`, ora locale):
    - `quandoElenco(quando, adesso)`: `now` sotto il minuto, `N min` sotto l'ora, `HH:MM` oggi, `Yesterday`, giorno della settimana (`Mon`) entro 6 giorni, `12 Nov` nell'anno, `12 Nov 2025`.
    - `quandoMessaggio(quando, adesso)`: `HH:MM`, `Yesterday, HH:MM`, `12 Nov, HH:MM`, `12 Nov 2025, HH:MM`.
  - **Importi e ordini.**
    - `soldi(importo, valuta='eur')`: valuta in `en-GB`; con un codice non valido, `importo.toFixed(2)` più il codice in maiuscolo.
    - `statoOrdine(stato)` → `{testo, tono}`, con il tono dei `pill` del kit:
      - `completed` → `Completed`, `good`;
      - `canceled` → `Cancelled`, `bad`;
      - `pending` → `Pending`, `warn`;
      - `requires_action` → `Needs action`, `warn`;
      - `archived` → `Archived`, `plain`;
      - `draft` → `Draft`, `plain`;
      - altro: iniziale maiuscola, `plain`.
  - **Elenco e messaggi.**
    - `percorsoElenco({stato, canale, q, quante})`: `/api/conversazioni?stato=…&limit=…`, poi `canale` e `q` solo se presenti, con `URLSearchParams`.
    - `unisci(messaggi, inSospeso, conversazione_id)`: i messaggi del server nell'ordine ricevuto, poi le risposte in attesa di quella conversazione il cui `id_client` non è fra i messaggi (con `locale: true`).
    - `ultimoVisto(messaggi)`: id dell'ultimo messaggio del server, oppure `null`.
  - **Stato di una risposta.** `statoRisposta(m, adesso)` → `{testo, tono, azione}`, con `azione` ∈ `null|'riprova'|'rimanda'|'modifica'`:

| Messaggio | testo | tono | azione |
|---|---|---|---|
| server `inviato` | `Sent` | `good` | null |
| server `in_coda`, meno di 60 s | `Sending…` | `plain` | null |
| server `in_coda`, da 60 s | `Still sending` | `warn` | `riprova` |
| server `fallito` | `Not sent: <errore>` | `bad` | `riprova` |
| server `incerto` | `Not confirmed: the customer may have received it.` | `warn` | `rimanda` |
| in attesa `invio` | `Sending…` | `plain` | null |
| in attesa `attesa` | `Not sent yet` | `warn` | `riprova` |
| in attesa `rifiutato` | `<errore>` | `bad` | `modifica` |
| in arrivo | — | — | null |

  - **Errori e id.**
    - `testoErrore(e)`:
      - stato 0 → `The panel's local server is not responding.`;
      - stato 503 → `The Ishtar Lab server is not reachable. Start Ishtar Lab and try again.`;
      - altrimenti il messaggio, oppure `Something went wrong (<stato>).`.
    - `nuovoId()` (32 caratteri esadecimali).

- [ ] **Step 1: test che falliscono.**
  - Un test per gruppo di funzioni, con le tabelle sopra come casi.
  - Fra i casi:
    - mezzanotte (23:59 del giorno prima → `Yesterday`);
    - `q` con `&` e `%`;
    - `unisci` che nasconde la risposta in attesa quando il server ha lo stesso `id_client`;
    - `richiesta` con un `fetch` finto che rifiuta (stato 0) e uno che dà HTML (stato 502).
- [ ] **Step 2:** `node --test verifiche/chat-casella.test.mjs verifiche/chat-api.test.mjs`. Atteso: FAIL (moduli assenti).
- [ ] **Step 3:** implementazione dei due moduli.
- [ ] **Step 4:** stessi test, poi `node --test verifiche/*.test.mjs`. Atteso: tutti OK.
- [ ] **Step 5: commit** `feat(pannello): aiuti e richieste della casella dei clienti`

### Task 4: controllo della casella

**File:**
- Crea: `frontend/ishtar-lab/chat/controllo.mjs`
- Test: `verifiche/chat-controllo.test.mjs`

**Interfacce:**
- Consuma: `richiesta`, `ErroreRichiesta`, `testoErrore`, `percorsoElenco`, `ultimoVisto`, `unisci` dal Task 3.
- Produce `creaCasella({richiesta, ambiente, nuovoId})`, con:
  - `ambiente = {adesso(): number, visibile(): boolean, inPrimoPiano(): boolean, vista(): {id: string|null}, avviso(testo, {warn}): void}`.
- La casella restituita ha questi metodi.
  - **Stato e lettura.**
    - `iscrivi(fn) → disiscrivi` e `istantanea()`, per `useSyncExternalStore`. L'istantanea è un oggetto nuovo a ogni cambiamento.
    - `aggiorna({elenco, dettaglio, conteggi}) → Promise<boolean>`: non lancia mai; mette `errore` in elenco o dettaglio.
    - `filtra({stato, canale, q})` e `altre()`, che aggiunge 50 righe fino a 200.
    - `apri(id|null)`.
  - **Risposte.**
    - `rispondi(conversazione_id, testo)`: con un testo vuoto dopo `trim` non fa nulla.
    - `riprova({id_client, testo, conversazione_id})`: stesso id.
    - `rimanda({testo, conversazione_id})`: id nuovo.
    - `scarta(id_client) → testo`.
    - `inAttesa() → boolean`: c'è una risposta in attesa non conclusa.
    - `bozza(conversazione_id, testo?)`.
  - **Conversazione e cliente.**
    - `cambiaStato(conversazione_id, 'aperta'|'chiusa') → Promise<boolean>`.
    - `collega(conversazione_id, cliente_id|null) → Promise<boolean>`.
    - `cliente(id)`: carica la scheda in `schede[id]`; con 404, `mancante`.
    - `cercaClienti(q) → Promise<Array>`.
  - **Risposte rapide.** `caricaRapide()`, `salvaRapida({id?, titolo, testo}) → Promise<boolean>`, `eliminaRapida(id) → Promise<boolean>`.
- Forma dell'istantanea:

```js
{ elenco: { righe, conteggi: { aperte, chiuse, non_lette }, totale, filtri: { stato, canale, q }, quante, caricato, errore },
  aperta: { id, dati, errore, caricato, mancante },
  inSospeso: [{ id_client, conversazione_id, testo, fase, errore, quando }],
  schede: { [cliente_id]: { dati, errore, caricato, mancante } },
  rapide: { righe, caricate, errore } }
```

  `fase` è `invio`, `attesa` o `rifiutato`.

- Regole:
  - **Risposte del server.** Ogni lettura ha un numero progressivo: si applica solo l'ultima partita per quel tipo. Un dettaglio si applica solo se `aperta.id` è ancora quella conversazione. Dopo una scrittura le letture già in volo si scartano.
  - **Letta.** Dopo un dettaglio applicato, «letta» con `ultimo_visto` = ultimo messaggio mostrato, solo se:
    - `ambiente.visibile()` e `ambiente.inPrimoPiano()`;
    - la conversazione è quella in `ambiente.vista()`;
    - `non_letti > 0`.

    Dopo «letta», `non_letti` va a 0 nella riga dell'elenco e nel dettaglio.
  - **Esito di una risposta.**
    - Un 200 sostituisce la risposta in attesa con il messaggio del server.
    - Rete, 5xx o 409: `attesa`.
    - Altri 4xx: `rifiutato`, con il messaggio.
    - Se un dettaglio contiene l'`id_client` di una risposta in attesa che non è in `invio`, la risposta in attesa si toglie.
    - Una risposta non riuscita mentre la sua conversazione non è aperta dà un avviso.
  - **Chiusura in ritardo.** Un 412 della chiusura dà un avviso con il messaggio del server e la conversazione si rilegge.

- [ ] **Step 1: test che falliscono.** Un `richiesta` finto registra le chiamate e risponde con promesse governate dal test.
  - `elenco: si applica solo la lettura più recente`: due `aggiorna({elenco:true})`, la prima risolta per ultima; restano le righe della seconda.
  - `dettaglio di un'altra conversazione non si applica`: `apri(A)`, poi `apri(B)` prima della risposta di A; `aperta.dati` non è mai A.
  - `letta solo con la pagina visibile e in primo piano`:
    - nascosta: nessun POST `letta`;
    - visibile e in primo piano: POST con `ultimo_visto` = ultimo id, e la riga dell'elenco ha `non_letti` 0.
  - `risposta: stesso id nei nuovi tentativi`: errore di rete, fase `attesa`, poi `riprova` manda lo stesso id e lo stesso testo.
  - `risposta: doppio invio, una sola richiesta`: `rispondi(A,'Ciao')` poi `rispondi(A,'')`; un solo POST.
  - `risposta rifiutata: si riprende il testo`: 400, fase `rifiutato`; `scarta` restituisce il testo e la toglie.
  - `la riga del server sostituisce la risposta in attesa`: dettaglio con lo stesso `id_client`; `unisci` dà una sola bolla e `inSospeso` è vuoto.
  - `rimanda usa un id nuovo`.
  - `chiusura con messaggi nuovi (412): avviso e conversazione riletta`.
  - `errore di rete sull'elenco: righe conservate e messaggio`.
  - `cliente cancellato: scheda mancante`.
  - `badge: conteggi non_lette dalla lettura dei conteggi`.
- [ ] **Step 2:** `node --test verifiche/chat-controllo.test.mjs`. Atteso: FAIL (modulo assente).
- [ ] **Step 3:** implementazione.
- [ ] **Step 4:** stessi test, poi `node --test verifiche/*.test.mjs`. Atteso: tutti OK.
- [ ] **Step 5: commit** `feat(pannello): controllo della casella dei clienti`

### Task 5: pagina «Chats», stile e ritocchi a router e menu

**File:**
- Crea:
  - `frontend/ishtar-lab/chat/chat.js`: pagina, avvio delle letture, badge;
  - `frontend/ishtar-lab/chat/chat.css`.
- Modifica:
  - `frontend/ishtar-lab/index.html`: foglio `/ishtar-lab/chat/chat.css` dopo quello del catalogo;
  - `frontend/ishtar-lab/assets/kit-BLRx7j0_.js`;
  - `frontend/ishtar-lab/assets/index-Bjs79DLG.js`.

**Interfacce:**
- Consuma `creaCasella` (Task 4), più `richiesta` e gli aiuti del Task 3.
- Usa dal kit:
  - **Runtime.** `J` (jsx), `nn` (React), `wt` (stato demo, solo `signedIn`), `It` (naviga).
  - **Componenti.** `d` (testata), `b` (schede con conteggi), `t` (avatar), `p` (pill), `o` (stato vuoto), `m` (ricerca), `q` (icona).
  - **Finestre e avvisi.** `j` (cassetto), `N` (finestra), `A` (conferma), `F` (avviso).
- Produce:
  - `export default function Chats({sub, params})`;
  - `window.IshtarChats` (il controllo, per le prove);
  - `window.IshtarChatBadge` (numero) con l'evento `ishtar:chat-badge`.

**Sostituzioni nei bundle** (testo esatto, ognuna una volta sola):

| File | Da | A |
|---|---|---|
| kit | `` customers:[{id:`people`,label:`People`},{id:`segments`,label:`Segments`}], `` | lo stesso seguito da `` chats:[{id:`open`,label:`Open`},{id:`closed`,label:`Closed`}], `` |
| kit | `` To=[`home`,`orders`,`products`,`customers`, `` | `` To=[`home`,`orders`,`products`,`customers`,`chats`, `` |
| index | `` customers:()=>Ct(()=>import(`./customers-CqnBilLb.js`),__vite__mapDeps([7,1,8])), `` | lo stesso seguito da `` chats:()=>Ct(()=>import(`../chat/chat.js`),__vite__mapDeps([1])), `` |
| index | `` {key:`customers`,page:`customers`,label:`Customers`,icon:`users`,subs:!0}, `` | lo stesso seguito da `` {key:`chats`,page:`chats`,label:`Chats`,icon:`chat`,count:()=>IshtarChatCount(),hot:!0,subs:!0}, `` |
| index | `` customers:`Customers`,analytics:`Analytics` `` | `` customers:`Customers`,chats:`Chats`,analytics:`Analytics` `` |
| index | `` help:`Help`},At= `` | `` help:`Help`},IshtarChatSub=e=>(addEventListener(`ishtar:chat-badge`,e),()=>removeEventListener(`ishtar:chat-badge`,e)),IshtarChatCount=()=>window.IshtarChatBadge\|0,At= `` |
| index | `` function zt({page:e,sub:t}){y(); `` | `` function zt({page:e,sub:t}){y(),(0,k.useSyncExternalStore)(IshtarChatSub,IshtarChatCount); `` |

**Pagina** (testi in inglese).
- **Testata e schede.**
  - Titolo `Chats`, sottotitolo `Customer messages from your channels, with their orders alongside.`, azione `Quick replies`.
  - Schede del kit `Open`/`Closed` con i conteggi.
- **Disposizione.**
  - Sopra i 1280 px tre colonne `card`: elenco, conversazione, scheda del cliente.
  - Fra 761 e 1279 px due colonne; la scheda si apre nel cassetto dal pulsante `Customer`.
  - Fino a 760 px una colonna (elenco oppure conversazione, con il pulsante `Back`).
- **Elenco.**
  - Ricerca `Name, message or contact` (300 ms) e canale `All channels` più i sei canali.
  - Righe con avatar, nome, orario, anteprima, non letti, canale, `Waiting` se `in_attesa`.
  - `Show more` finché `totale` supera le righe.
  - Vuoti:
    - `No open chats` / `When a customer writes to the shop's Telegram bot, the chat appears here.`;
    - `No closed chats`;
    - `No chats match` / `Try another name or word.`.
- **Conversazione.**
  - **Testata.** Avatar, nome, canale e stato. Azioni `Close` / `Reopen`, più `Customer` sotto i 1280 px.
  - **Messaggi.** In un `role="log"`, testo semplice con gli a capo. Sotto ogni risposta, autore, orario e `statoRisposta`, con i pulsanti `Retry`, `Send again`, `Edit` e `Discard`. `Send again` chiede prima conferma: `The customer may already have this reply. Send it again as a new message?`.
  - **Risposte rapide.** Chip sopra la casella di scrittura: inseriscono il testo, non inviano. Ultimo chip `Manage`; se non ce ne sono, `Add quick reply`.
  - **Scrittura.**
    - Casella `Reply to <nome>…` con massimo 4000 caratteri; Invio manda, Maiusc+Invio va a capo.
    - Pulsante `Send`.
    - Conversazione chiusa: `This chat is closed.` con `Reopen`.
  - **Senza conversazione.** `Pick a chat` / `Choose a conversation to read and reply.`; `Chat not found` con `Back to chats`.
  - **Senza collegamento.** `Chats are offline` più il motivo e `Trying again…`.
- **Scheda del cliente.**
  - **Non collegata.**
    - Nome e canale del contatto.
    - `Not linked to a shop customer.`, pulsante `Link to customer`.
    - Finestra di ricerca `Name, email or phone`, con le righe e il pulsante `Link`.
    - Conferma `Link this chat?` / `Link <contatto> to <cliente> (<email>)? The chat will show their details and orders. Check that it is the same person.`
  - **Collegata.**
    - Nome, email, telefono, città, chip `Regular` / `New` / `Reseller` / `Newsletter`.
    - `Orders`, `Spent`, `Last order`.
    - `Recent orders`: fino a 5, con numero, stato e totale.
    - Nota del cliente se c'è.
    - `Unlink`, con conferma `Unlink <cliente>?` / `The chat stays, but it will not show this customer's details and orders.`
  - **Cliente cancellato.** `This customer no longer exists.` più `Unlink`.
- **Finestra `Quick replies`.**
  - Elenco con `Edit` e `Delete`; `Delete` chiede `Delete this quick reply?`.
  - Modulo `Title` (60) e `Text` (1000), pulsanti `Add` / `Save`.
- **Letture.**
  - Nella pagina: dettaglio ogni 5 s, elenco ogni 10 s.
  - Altrove: conteggi ogni 30 s.
  - Solo con la demo «entrata» e la pagina visibile.
  - Subito al ritorno della pagina, della finestra in primo piano, della rete o all'ingresso in `#/chats`.
  - In caso di errore, attesa crescente come il catalogo (`attesaRiprova` di `catalogo/collegamento.mjs`).
  - `beforeunload` chiede conferma se `inAttesa()`.

- [ ] **Step 1:** sostituzioni nei bundle con uno script che verifica le occorrenze, e `index.html`.
- [ ] **Step 2:** `chat.js` e `chat.css`.
- [ ] **Step 3:** controllo sintattico dei tre moduli come ES (`vm.SourceTextModule`). Atteso: 0 errori.
- [ ] **Step 4: prova rapida in Chrome senza testa.**
  - `#/chats` porta a `#/chats/open`.
  - Nel menu, `Chats` sta dopo `Customers`; titolo `Open · Chats — Ishtar Lab`.
  - Nessuna eccezione nella console; le altre pagine si aprono come prima.
- [ ] **Step 5:** `node --test verifiche/*.test.mjs` e `python3 -m unittest verifiche/test_ponte.py`. Atteso: tutti OK.
- [ ] **Step 6: commit** `feat(pannello): pagina Chats con scheda del cliente`

### Task 6: prova completa nel browser, regressioni e documenti

**File:**
- Crea: `strumenti-prova/e2e-chat.mjs` e `strumenti-prova/telegram-finto.mjs`, fuori dal repository come le altre prove;
- Crea: `verifiche/crm-tappa2-2026-11-13.json`.
- Modifica:
  - `PROJECT.md`, `CHANGELOG.md`;
  - `tools/prepara-consegna.py` (PROOFS);
  - nel vault: «Stato delle funzioni», [[Consegna tecnica al collaboratore]] (percorsi del ponte), [[CRM omnicanale - progetto]] (tappa 2 fatta).

**Prova completa:**
- **Preparazione.**
  - Backup del database.
  - API riavviata con `TELEGRAM_API_BASE` verso il Telegram finto (getMe, getUpdates con attesa e offset, sendMessage con risposte governabili: ok, 400, 403, 500).
  - Connettore collegato con un token finto e un cliente di prova, con `medusa exec`.
  - Pannello riavviato (il ponte si carica all'avvio).
- **Casi:**
  - **C1. Menu e pagina.** Menu, schede, pagina vuota, nessuna eccezione.
  - **C2. Messaggio in arrivo.** Arriva dal Telegram finto e compare nell'elenco con il non letto. Badge nel menu anche da un'altra pagina.
  - **C3. Lettura.** Aperta la conversazione, il non letto sparisce (anche nel database).
  - **C4. Una sola risposta.** Risposta con Invio, «Sent» e un solo sendMessage; doppio clic: ancora uno solo.
  - **C5. Risposte rapide.** Creata dalla finestra, il chip inserisce il testo senza inviarlo, poi l'invio ne manda uno.
  - **C6. Esiti dell'invio.**
    - 500 dà «Not confirmed» e nessun nuovo tentativo da solo.
    - 403 dà «Not sent» e `Retry`; con Telegram di nuovo ok, uno solo in più.
  - **C7. API spenta durante l'invio.**
    - Prima «Not sent yet».
    - Con l'API riaccesa, `Retry` manda una volta sola.
    - La riga del server non si duplica.
  - **C8. Chiusura in ritardo.** Letture ferme, nuovo messaggio, chiusura: 412, avviso, conversazione aperta con il messaggio nuovo.
  - **C9. Chiusura e riapertura.** Chiusura, scheda «Closed», casella disattivata; poi riapertura.
  - **C10. Cliente.** Collegamento del cliente di prova con conferma, scheda con ordini e speso; poi scollegamento.
  - **C11. Filtri.** Ricerca e filtro del canale.
  - **C12. Testi ostili.** `<img src=x onerror=…>` resta testo; 4000 caratteri senza spazi non allargano la pagina.
  - **C13. Telefono.** Larghezza 390 px: elenco, conversazione e `Back`, cassetto della scheda.
  - **C14. Pagina nascosta.** Nessuna «letta»; al ritorno, letta.
- **Regressioni:** `e2e-catalogo`, `e2e-collegamento`, `e2e-blocco3a`, `e2e-blocco3b`, e tutte le pagine e schede del pannello senza eccezioni.
- **Fine:** database ripristinato dal backup, API riavviata senza `TELEGRAM_API_BASE`, script temporanei rimossi.

- [ ] **Step 1:** Telegram finto e prova completa. Atteso: tutti i casi OK.
- [ ] **Step 2:** regressioni. Atteso: come prima della tappa.
- [ ] **Step 3:** ripristino del database e controllo che non resti nulla delle prove.
- [ ] **Step 4:** documenti e rapporto.
- [ ] **Step 5: commit** `docs(crm): pagina Chats, verifiche e cronologia`

## Lasciato a chi costruisce

Nomi interni dei componenti, struttura di `chat.css`, testi secondari non elencati sopra, ordine dei casi nella prova completa.

## Dopo la revisione

Revisione avversariale dell'intero ramo (quattro revisori e quattro verificatori): 29 rilievi, 27 confermati, 21 distinti, tutti corretti con un test che falliva prima o con un caso della prova nel browser. Cambiano il piano in questi punti:

- **Ordine dei messaggi (backend).** La conversazione si mostra nell'ordine di arrivo nella casella (`created_at`, poi `id`, costante `ORDINE_MESSAGGI` in `regole.ts`) e `nuoviDopo` conta i messaggi del cliente dopo l'ultimo mostrato nello stesso ordine (`filtroNuoviDopo`). Prima un messaggio registrato in ritardo compariva sopra la risposta già partita, restava non letto per sempre e «Close» dava sempre 412.
- **Ordini recenti del cliente (backend, `clienti/lib/ordini.ts`).** Ordinati per data: le date di query.graph sono oggetti Date e confrontarle come testo le ordinava per nome del giorno.
- **Controllo della casella.**
  - Risposta non riuscita mentre lo schermo mostra altro: avviso e segno in `esiti` (anche nel badge) finché la conversazione non si apre.
  - `ultimo_visto` per conversazione, preso dall'ultima lettura del server.
  - «Letta» solo con il registro in fondo (`vista().inFondo`) e mai ripetuta per la stessa coppia; dopo una «letta» l'elenco e il badge si rileggono.
  - `rimandate` per le risposte incerte già rimandate.
  - `cercaClienti` restituisce `{righe, conteggio}`.
  - Un esito che non è un 4xx (escluso il 409) non è mai «rifiutato».
- **Pagina.**
  - **Retry e chiusura.** Sulla bolla si vede l'esito del nuovo tentativo; in una chat chiusa nessun pulsante, con il motivo; «Close chat» disattivato durante l'invio e con conferma se ci sono risposte non partite.
  - **Registro.** «New messages» con il registro scorso in su.
  - **Collegamento al cliente.** La ricerca parte vuota e il nome del contatto è solo un suggerimento; la conferma chiede dettagli che solo quel cliente conosce.
  - **Altri stati.** Niente letture né «letta» con la demo «uscita»; stato d'errore al posto di «Loading messages…»; risposte rapide rilette dopo un errore; invito a riavviare Ishtar Lab se il server del pannello è più vecchio della pagina.
  - **Dimensioni e fuoco.** Altezza dal margine del pannello; fuoco a una colonna.
- **Bundle principale.** Ottavo ritocco: la voce Chats nella ricerca del pannello (⌘K), lista `gt`.
- **Server del pannello.** `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`; `Cache-Control: no-store` sulle risposte del ponte.

Verifiche finali:
- node 123/123, ponte 15/15, jest 272/272, typecheck 0;
- prova nel browser 67/67 da database pulito;
- pannello 18/18, 32/32, 8/8 e 20/20.

Rapporto: `verifiche/crm-tappa2-2026-11-13.json`.

