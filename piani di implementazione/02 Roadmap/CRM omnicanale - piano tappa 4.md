---
title: "CRM omnicanale - piano tappa 4"
updated: 2026-11-14
type: documentazione-progetto
tags: [ishtar-lab]
---

# CRM tappa 4: chat del sito nella casella dei clienti — piano

> **Per chi esegue:** sotto-skill richiesta: superpowers:subagent-driven-development (consigliata) oppure superpowers:executing-plans, un task alla volta. I passi usano le caselle (`- [ ]`).

**Obiettivo:** chi visita il sito del negozio scrive nella chat del sito; il messaggio entra nella pagina «Chats» e il team risponde dal pannello; la risposta arriva al visitatore nella chat. Mai un messaggio perso o doppio, mai una risposta mandata due volte, mai il PC di Reda esposto su Internet.

**Architettura:**
- **Casella nel cloud.** Un progetto Supabase dedicato alla chat (regione eu-central-1). Tabelle in uno schema privato `chat`, mai esposto; si entra solo da funzioni RPC nello schema `public`. Il visitatore entra come utente anonimo di Supabase Auth (con il captcha Turnstile, al primo invio) e può chiamare solo le funzioni del visitatore; Ishtar Lab chiama solo le funzioni del negozio, con una chiave segreta usata solo da lui.
- **Lettura a intervalli.** Ishtar Lab fa solo chiamate in uscita, come per Telegram e IMAP: un job ogni minuto, con giri ogni 5 secondi circa, preleva i messaggi nuovi, li registra e conferma quelli registrati. Il prelievo aggiorna il «battito»: il widget dice «online» o «away».
- **Invio.** Ramo «sito» nella consegna delle risposte: scrittura idempotente nella casella per `id_client`; una risposta incerta si chiarisce rileggendo la casella.
- **Widget.** Un solo file JavaScript costruito con `bun build`, con supabase-js dentro, caricato dal sito del negozio: Shadow DOM, testo sempre come testo, accessibile, telefono.
- **Prove.** Supabase locale con la CLI (Postgres, Auth, PostgREST, Kong), casella finta in Node per i guasti, negozio finto locale, prove nel browser come nelle tappe 2 e 3.

**Tecnologie e dipendenze nuove (approvate da Marco il 14/11):**
- `@supabase/supabase-js` 2.118.0 (MIT), versione esatta, solo dentro il file del widget;
- CLI `supabase` 2.122.0 (MIT) con le sue immagini Docker, solo per le prove locali.

**Progetto:** [[CRM omnicanale - progetto]], tappa 4. Ricognizione del 14/11 (backend, contesto, architetture, widget, sintesi) nel rapporto finale.

## Scelte (di satria64, su delega di Marco; Reda può cambiarle)

- **Casella su Supabase, progetto dedicato** (Marco, 14/11): non il progetto del sito, che resta com'è. Il PC di Reda resta su 127.0.0.1; l'indirizzo HTTPS pubblico è quello di Supabase.
- **Identificativi dalla casella.** In Ishtar Lab entrano solo uuid generati dalla casella, mai valori scelti dal browser. L'`id_client` del widget serve solo a non scrivere due volte lo stesso messaggio ed è unico per visitatore.
- **Conferma dopo la registrazione.** Un messaggio resta «da importare» finché Ishtar Lab non conferma di averlo registrato; nessun cursore (le sequenze di Postgres possono saltare).
- **Un solo lettore.** La casella accetta una sola istanza di Ishtar Lab alla volta (identificativo dell'istanza): due istanze collegate per errore si dividerebbero i messaggi senza accorgersene.
- **Stato del negozio.** «Online» se Ishtar Lab ha letto negli ultimi 2 minuti, altrimenti «away» con un testo onesto («We're away right now: leave a message and we'll reply here»). Nessuna risposta automatica salvata.
- **Visitatore.** Scrive subito; nome ed email facoltativi dopo il primo messaggio, mostrati nel pannello come «typed by the visitor, not verified». Mai proposte automatiche di cliente per il sito: il collegamento lo fa una persona.
- **Continuità.** La conversazione vale nella scheda del browser (sessionStorage); l'opzione «Remember this chat on this device» (localStorage) si attiva dalla configurazione del sito.
- **Testi del widget** in un dizionario: inglese e italiano pronti, lingua scelta dalla configurazione (la decide Reda).
- **Tempo reale.** Nella prima versione letture ogni 4 secondi a chat aperta e ogni 60 secondi a chat chiusa con una conversazione, con attesa crescente e una parte casuale; Supabase Realtime è una miglioria successiva.
- **Fuori da questa tappa:** email ai visitatori, Realtime, più siti con un solo connettore, pulizia pianificata attiva (le durate di conservazione sono cancellazioni: le decide Reda; la funzione di pulizia c'è, il calendario no).

## Vincoli globali

- **Ramo e file protetti.** Ramo `crm-tappa4` dal main e0e1bd3. Non toccare `LICENSE.md`, `LICENSING-SCOPE.md`, `THIRD_PARTY_NOTICES.md`, `licensing/`, `frontend/legal/`: le licenze nuove si elencano nella PR; l'avviso MIT di supabase-js resta nel file del widget.
- **Percorsi.** Backend relativi a `backend/piattaforma/packages/api/`; casella e widget in `chat-sito/` alla radice del repository. Testi per l'interfaccia ed errori in inglese, commenti in italiano.
- **Rete.** Indirizzo della casella solo `https://<rif>.supabase.co` (rif di 20 lettere minuscole); `http://127.0.0.1:<porta>` solo con `SITO_PROVE_LOCALI=1` e NODE_ENV diverso da production (Supabase locale e casella finta).
- **Segreti.** La chiave segreta va solo nelle intestazioni (`apikey`; per una chiave JWT anche `Authorization: Bearer`), mai nell'indirizzo, nei log, negli errori o nelle risposte. Errori con testi fissi.
- **Permessi della casella.** Tabelle in `chat`, RLS attiva senza policy, `revoke all` ad `anon` e `authenticated`; funzioni `security definer` con `search_path` vuoto; funzioni del visitatore solo per `authenticated`, funzioni del negozio solo per `service_role`; `revoke execute ... from public` su ogni funzione.
- **Mai perso o doppio.** Chiave del messaggio `sito:<rif>:<uuid della casella>`; conferma solo dopo `registraInArrivo`; al primo errore il giro si ferma e il resto si rilegge.
- **Mai due volte.** Lucchetto e chiave unica come nelle tappe 1–3; «tentato» prima della scrittura; incerti riconciliati con la casella; un nuovo tentativo con lo stesso `id_client` non duplica.
- **Comandi.** Test da `backend/`: jest con `infra/jest-security.cjs`; typecheck come nelle tappe 1–3; dalla radice `node --test verifiche/*.test.mjs` e `python3 -m unittest verifiche/test_ponte.py`; casella: `npx supabase@2.122.0 test db` (pgTAP) nella cartella `chat-sito/casella`.
- **Prove dal vivo** sull'istanza locale: backup prima e ripristino alla fine; nessun account creato, niente pubblicato, nessuna modifica al sito fino alle risposte di Reda.
- **Commit e PR.** Commit con l'email noreply di satria64 e la riga `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; PR con la dichiarazione di `CONTRIBUTING.md`, le licenze nuove e la riga finale di Claude Code.

## Da tenere d'occhio nella revisione

1. **Permessi della casella:** una funzione del negozio eseguibile da `anon` o `authenticated`, una tabella raggiungibile dall'API, un `search_path` non vuoto: chiunque abbia la chiave pubblicabile leggerebbe tutte le conversazioni. Prove nel Task 2.
2. **Messaggio perso o doppio, o nella conversazione di un altro:** conferma persa, caduta fra registrazione e conferma, stesso `id_client`, due lettori. Prove nei Task 2, 5 e 9.
3. **Risposta doppia o data per fallita quando è arrivata:** caduta dopo la scrittura, riconciliazione degli incerti, doppio clic. Prove nel Task 6.
4. **Abusi su un punto pubblico:** raffiche di visitatori anonimi, messaggi a raffica, testi enormi, casella piena. Prove nel Task 2 (limiti) e nel Task 9.
5. **XSS e segreti nel sito del negozio:** testo del visitatore e del team mai come HTML, nessun segreto nel widget (solo la chiave pubblicabile). Prove nei Task 8 e 9.

---

### Task 1: regole pure del canale sito

**File:** crea `src/modules/conversazioni/canali/sito-regole.ts`; test `__tests__/sito-regole.unit.spec.ts`.

**Interfacce:**
- `controllaCasella(url): { base: string; rif: string }` — solo `https://<rif>.supabase.co` (senza percorso, credenziali o porta) o, con `SITO_PROVE_LOCALI=1` fuori produzione, `http://127.0.0.1:<porta>` (rif «locale»); altrimenti `ErroreSito` con «Enter the project URL, for example https://abcdefghijklmnopqrst.supabase.co».
- `rigaInArrivo(riga, rif): InArrivo` — `{ canale: "sito", account: rif, id_contatto: riga.visitatore, nome: riga.nome, recapito: riga.email, id_messaggio: riga.id, testo, quando: riga.creato_il, dettagli: { pagina, dichiarato: true } }`; testi puliti come le email (NUL, surrogati spaiati, lunghezze).
- `classificaRisposta(status, corpo): "ok" | "credenziali" | "lettore" | "richiesta" | "servizio" | "rete"` — 401/403 credenziali; errore «reader_busy» lettore; altri 4xx richiesta; 5xx servizio.
- `intestazioniChiave(chiave)` — `apikey` sempre; `Authorization: Bearer` solo per una chiave JWT (tre parti separate da punti).

- [ ] **Step 1: test che falliscono:** indirizzi buoni e cattivi (http, porta, percorso, credenziali nell'URL, IP privato, sottodominio sbagliato, modalità locale in produzione); riga con nome ed email lunghissimi o ostili; chiavi `sb_secret_…` e JWT; classificazione degli stati.
- [ ] **Step 2:** FAIL. **Step 3:** implementazione. **Step 4:** verdi.
- [ ] **Step 5: commit** `feat(conversazioni): regole della chat del sito`

### Task 2: casella SQL

**File:** crea `chat-sito/casella/supabase/config.toml`, `chat-sito/casella/supabase/migrations/20261114000000_casella.sql`, `chat-sito/casella/supabase/tests/*.sql` (pgTAP), `chat-sito/casella/package.json` con `supabase` 2.122.0 esatto (solo per le prove).

**Interfacce (protocollo, versione 1):**
- **Tabelle** (schema `chat`): `negozio` (una riga: `versione`, `lettore`, `battito`, `nome`); `visitatore` (`id` = `auth.uid()`, `nome` ≤ 100, `email` ≤ 254, `creato_il`); `messaggio` (`id` uuid, `visitatore`, `direzione` entrata/uscita, `id_client` `^[A-Za-z0-9_-]{8,80}$`, `testo` 1–4000, `pagina` ≤ 500, `firma` ≤ 100, `creato_il`, `importato_il`). Indici unici parziali: (`visitatore`, `id_client`) in entrata, (`id_client`) in uscita.
- **Funzioni del visitatore** (`authenticated`):
  - `chat_scrivi(p_id_client, p_testo, p_pagina, p_nome, p_email) → { id, creato_il }` — idempotente; limiti per visitatore (20 messaggi in 10 minuti, 200 al giorno) sotto advisory lock; tetto globale (5000 messaggi da importare: «busy»);
  - `chat_leggi(p_dopo, p_limite) → [{ id, direzione, testo, firma, creato_il, importato }]` — solo i propri, al massimo 50;
  - `chat_stato() → { online, nome }`.
- **Funzioni del negozio** (`service_role`):
  - `chat_versione() → { versione: 1, nome }`;
  - `chat_preleva(p_lettore, p_limite) → [{ id, visitatore, testo, pagina, nome, email, creato_il }]` — aggiorna il battito; lettore unico (un altro lettore con battito più giovane di 10 minuti: errore `reader_busy`); messaggi in entrata non importati, in ordine;
  - `chat_conferma(p_lettore, p_ids) → numero` — idempotente;
  - `chat_rispondi(p_visitatore, p_id_client, p_testo, p_firma) → { id, creato_il }` — idempotente per `id_client`;
  - `chat_verifica(p_id_client) → { id, creato_il } | null`;
  - `chat_pulizia(p_giorni_importati, p_giorni_anonimi) → numeri` — definita, non pianificata.
- **config.toml:** progetto «ishtar-chat-sito», accesso anonimo attivo, captcha Turnstile con le chiavi di prova di Cloudflare, provider email spento, schemi esposti solo `public`.

- [ ] **Step 0:** CLI pronta (`npx supabase@2.122.0`, binario da GitHub; immagini Docker solo dei servizi necessari, `-x` per Studio, Storage, Realtime, Edge Functions, analytics). Atteso: `supabase start` con API su 127.0.0.1:54321.
- [ ] **Step 1: test pgTAP che falliscono:**
  - il visitatore A non legge né scrive i messaggi di B;
  - `anon` e `authenticated` non eseguono le funzioni del negozio; nessuna tabella di `chat` raggiungibile da PostgREST;
  - stesso `id_client` due volte: un solo messaggio; risposta con lo stesso `id_client`: una sola;
  - limiti per visitatore e tetto globale; testi oltre 4000; `id_client` non valido;
  - due lettori; conferma ripetuta; pulizia che non tocca mai i messaggi non importati;
  - `search_path` vuoto e `security definer` su ogni funzione.
- [ ] **Step 2:** FAIL. **Step 3:** SQL. **Step 4:** verdi (`supabase test db`).
- [ ] **Step 5: commit** `feat(chat-sito): casella della chat su Supabase`

### Task 3: casella finta per le prove

**File:** crea `strumenti-prova/casella-finta.mjs` (fuori dal repository) e `src/modules/conversazioni/__tests__/finti/casella.ts` (per jest).

**Interfacce:** le stesse funzioni RPC su `POST /rest/v1/rpc/<nome>` con la chiave del negozio, più `/_prova/*` (guasti: 401, 500, lentezza, caduta dopo la scrittura, conferma persa, lettore occupato; registro delle chiamate; messaggi del visitatore aggiunti a mano).

- [ ] **Step 1:** test di contratto che chiamano la finta e la Supabase locale con le stesse richieste e confrontano forma delle risposte ed errori.
- [ ] **Step 2: commit** `test(conversazioni): casella finta della chat del sito`

### Task 4: connettore «Site chat»

**File:** `src/modules/connectors/catalogo.ts` (voce `chat_sito`, categoria «messaggi»); crea `src/modules/conversazioni/canali/sito.ts` (client).

**Interfacce:**
- **Campi:** «Project URL» (`url`, `legatoAlSegreto`), «Secret key» (`chiave`, segreto), «Name shown to visitors» (`nome`, facoltativo).
- **Prova personalizzata:** `chat_versione`, versione 1 richiesta; account = rif del progetto. Errori fissi: chiave rifiutata, versione diversa («Run the latest chat SQL on the project»), indirizzo non valido, casella irraggiungibile.
- **Client** `clientCasella({ url, chiave }, fetch?)`: `versione()`, `preleva(lettore, limite)`, `conferma(lettore, ids)`, `rispondi(visitatore, id_client, testo, firma)`, `verifica(id_client)`; attesa massima 15 s; errori `ErroreSito` con il codice di `classificaRisposta`.

- [ ] **Step 1: test che falliscono** con la casella finta: prova riuscita, chiave sbagliata, versione 2, indirizzo cattivo, chiave mai nei registri della finta né negli errori; cambio dell'URL senza riscrivere la chiave rifiutato (regola della tappa 3).
- [ ] **Step 2:** FAIL. **Step 3:** implementazione. **Step 4:** verdi.
- [ ] **Step 5: commit** `feat(connettori): chat del sito`

### Task 5: lettura

**File:** crea `src/modules/conversazioni/ricezione-sito.ts`, `src/jobs/ricevi-sito.ts`; `prepara-ambiente`/istanza per l'identificativo del lettore (`ISHTAR_INSTANCE_ID` o il nome dell'istanza).

**Interfacce:**
- `elaboraSito(righe, { registra, conferma }) → { registrati, errore }` — in ordine; conferma solo gli id registrati; al primo errore si ferma.
- `riceviDaSito(container, { giri, attesa })` — lucchetto `conversazioni:ricevi:sito` (timeout 1); credenziali da `credenzialiCollegate("chat_sito")`; `giri` prelievi distanziati di `attesa` secondi. Errori: credenziali → `segnaErrore`; lettore occupato → `segnaErrore` («Another Ishtar Lab is reading this site chat»); rete e servizio → solo il registro, con testi fissi.
- **Job:** ogni minuto, 10 giri a 5 s.

- [ ] **Step 1: test che falliscono:** due messaggi registrati e confermati una volta; lettura doppia senza doppioni; conferma persa (si rilegge, nessun doppione grazie alla chiave unica); caduta fra registrazione e conferma; errore del database a metà (il resto resta da importare); 401 e lettore occupato sul connettore; nessun testo del visitatore nei registri.
- [ ] **Step 2:** FAIL. **Step 3:** implementazione. **Step 4:** verdi.
- [ ] **Step 5: commit** `feat(conversazioni): lettura della chat del sito`

### Task 6: invio

**File:** `src/modules/conversazioni/invio.ts` (ramo «sito»), `ricezione-sito.ts` (riconciliazione), `regole.ts` (regola dei canali rileggibili).

**Interfacce:**
- **Ramo «sito» di `consegna`:** senza casella collegata «Site chat is not connected»; `primaDellInvio`; `rispondi(id_contatto, id_client, testo, firma)`; 2xx «inviato» con `id_esterno` = id della casella; 401/403 «fallito» e connettore in errore; altri 4xx «fallito»; rete, timeout, 5xx «incerto».
- **Riconciliazione** (nel job di lettura): le risposte del sito «incerte» e quelle «in coda» già tentate si verificano con `verifica(id_client)`: trovata → «inviato»; non trovata dopo 2 minuti dal tentativo → «fallito» (un nuovo tentativo con lo stesso id non duplica). `regolaRileggibile(stato, tentato_il, trovata, adesso)` pura in `regole.ts`.

- [ ] **Step 1: test che falliscono:** risposta consegnata una volta; caduta dopo la scrittura (incerto, poi «inviato» dalla riconciliazione); caduta prima (incerto, poi «fallito» dopo 2 minuti, e il nuovo tentativo non duplica); 401; doppio invio dello stesso id insieme.
- [ ] **Step 2:** FAIL. **Step 3:** implementazione. **Step 4:** verdi.
- [ ] **Step 5: commit** `feat(conversazioni): risposte nella chat del sito`

### Task 7: vista e pagina «Chats»

**File:** `src/api/admin/conversazioni/lib/elenco.ts` (`vistaMessaggio.sito`); `frontend/ishtar-lab/chat/casella.mjs`, `chat.js`, `chat.css`; test `verifiche/chat-casella.test.mjs`.

**Interfacce:**
- `vistaMessaggio(m).sito`: `{ pagina }` solo con i dettagli del sito.
- `nomeContatto`: per il sito senza nome, «Visitor XXXX» (4 caratteri dall'id dell'identità).
- Scheda: nome ed email del sito con «typed by the visitor, not verified»; nessuna proposta di cliente; pagina d'origine sotto la bolla; stato vuoto che cita la chat del sito.

- [ ] **Step 1: test che falliscono** degli aiuti (`nomeContatto`, testo della nota, pagina mostrata solo come testo).
- [ ] **Step 2:** FAIL. **Step 3:** pagina e stile. **Step 4:** verdi e prova rapida nel browser.
- [ ] **Step 5: commit** `feat(pannello): chat del sito nella pagina Chats`

### Task 8: widget

**File:** crea `chat-sito/widget/` (`package.json` con `@supabase/supabase-js` 2.118.0 esatto, `src/stato.mjs` puro, `src/testi.mjs`, `src/widget.mjs`, `src/avvio.mjs`, `costruisci.mjs`, `dist/ishtar-chat.js` costruito); test `verifiche/chat-sito-widget.test.mjs`.

**Interfacce:**
- **Configurazione** dallo script: `data-url`, `data-chiave` (pubblicabile), `data-turnstile` (chiave del sito), `data-lingua` (`en`/`it`), `data-ricorda`, `data-email` (per «Offline: email us»).
- **Stato puro** (`stato.mjs`): coda dei messaggi con `id_client`, unione con le letture deduplicata per id, attesa crescente con parte casuale, stati «Sending», «Sent» solo dopo la risposta della casella, «Not sent» con «Retry» sullo stesso id, «Away», «Offline».
- **Pagina:** pulsante e finestra non modale (Escape chiude, fuoco gestito), `role="log"`, testo solo con `textContent`, Shadow DOM, 320 px, zoom 200%; Turnstile e accesso anonimo solo al primo invio; nome ed email facoltativi dopo il primo messaggio.
- **Costruzione:** `bun build` in un solo file minimizzato, supabase-js caricato solo all'apertura della chat, avviso MIT in testa al file.

- [ ] **Step 1: test che falliscono** dello stato puro: doppio clic (un solo messaggio), «Sent» solo dopo la conferma, nuovo tentativo con lo stesso id, unione delle letture senza doppioni e in ordine, attesa crescente, testi in due lingue.
- [ ] **Step 2:** FAIL. **Step 3:** implementazione e costruzione. **Step 4:** verdi.
- [ ] **Step 5: commit** `feat(chat-sito): widget della chat per il sito del negozio`

### Task 9: prova completa e regressioni

**File:** `strumenti-prova/e2e-sito.mjs`, `strumenti-prova/negozio-finto/` (pagina con CSP rigorosa e CSS aggressivo).

- [ ] **Prova completa** con la Supabase locale, l'istanza Ishtar Lab con `SITO_PROVE_LOCALI=1` e il connettore collegato con `medusa exec`:
  - messaggio dal widget nella pagina Chats con la pagina d'origine; risposta dal pannello nella chat del visitatore; «online» e «away»;
  - doppio clic; rete persa; API ferma (il «PC spento»: la casella accetta lo stesso, i messaggi entrano alla ripartenza); casella irraggiungibile; limiti; 4000 e 4001 caratteri; HTML ostile; due schede; solo tastiera; 320 px;
  - risposta incerta riconciliata; secondo lettore rifiutato; connettore con la chiave sbagliata.
- [ ] **Regressioni:** jest, node, ponte; Chats con Telegram ed email (`e2e-chat.mjs`, `e2e-email.mjs`); pannello.
- [ ] Ripristino del database e confronto con un'istantanea.

### Task 10: guide, documenti, revisione e PR

- [ ] Guida per Reda (`chat-sito/GUIDA.md`): progetto, regione, accesso anonimo, Turnstile, provider email spento, chiave segreta, SQL, connettore; istruzioni per chi gestisce il sito (script, CSP, versione fissa); bozza dell'avviso nel widget e dell'informativa da far validare.
- [ ] `PROJECT.md`, `CHANGELOG.md`, vault (stato delle funzioni, progetto), rapporto `verifiche/crm-tappa4-<data>.json`, prove nel pacchetto di consegna.
- [ ] Revisione avversariale dell'intero ramo; correzioni con test che falliscono prima.
- [ ] PR con le licenze nuove e la dichiarazione di `CONTRIBUTING.md`; recap breve a Reda.
- [ ] **Dopo le risposte di Reda:** prova sul suo progetto Supabase con una copia del sito, chiave inserita da Marco nella console › Connettori; messa in linea decisa da Reda.

## Lasciato a chi costruisce

Nomi interni, testi secondari, forma esatta dei registri, struttura dei server finti, ordine dei casi della prova completa, aspetto del widget dentro i limiti di accessibilità.
