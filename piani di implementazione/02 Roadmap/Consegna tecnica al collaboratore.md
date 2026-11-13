---
title: Consegna tecnica al collaboratore
updated: 2026-11-12
type: guida-consegna
tags: [ishtar-lab, backend, collaborazione]
---

# Consegna tecnica al collaboratore

Questa è la guida di ingresso per chi riprende lo sviluppo. La richiesta del titolare del 12 novembre è condividere codice, backend, seconda applicazione e piani su GitHub. Le correzioni applicative verranno curate dal collaboratore: questa consegna non le dichiara già eseguite.

## Scaricare la copia corretta

- Repository pubblico: [reda10nafil/ishtar-lab](https://github.com/reda10nafil/ishtar-lab).
- [ZIP aggiornato del ramo main](https://github.com/reda10nafil/ishtar-lab/archive/refs/heads/main.zip): comprende le revisioni successive ai vecchi pacchetti dell'8 novembre.
- Per chi usa Git: `git clone https://github.com/reda10nafil/ishtar-lab.git`, oppure aggiornare la propria copia dopo avere salvato le modifiche locali in un ramo/commit. Non sovrascrivere il lavoro già iniziato.
- La nuova consegna è identificata come `v0.2.0-handoff-20261112`; la pubblicazione effettiva si verifica dalla pagina Releases. È una consegna di sorgenti per sviluppo, non una certificazione di stabilità o compatibilità Linux.

Il repository è leggibile senza invito. La richiesta di scaricare non assegna accesso in scrittura: usare un fork e una pull request per proporre modifiche. Non sono condivise password dell'account GitHub, credenziali del negozio o chiavi di provider. Questa nota non inventa un'identità GitHub del collaboratore.

## Mappa dei file

| Percorso relativo alla radice | Contenuto e uso |
|---|---|
| `frontend/ishtar-lab/` | Primo pannello scelto dal titolare: bundle recuperati, identità/branding e adattatore catalogo |
| `frontend/ishtar-lab/catalogo/` | Controller, dialog, importazione CSV e integrazione al modello UI esistente |
| `avvia_pannello.py`, `catalog_bridge.py` | Server locale e ponte autenticato verso il backend; non un backend commerciale completo |
| `backend/piattaforma/packages/api/` | **Backend già incluso**, sorgenti Medusa/Mercur, moduli, API, migrazioni e test |
| `backend/infra/` | Docker Compose, configurazione, runtime isolato e script di verifica |
| `backend/piattaforma/apps/console/` | Console di supporto della copia principale, con sorgenti; non sostituisce il primo pannello |
| `backend/piattaforma/apps/admin/`, `apps/vendor/` | Workspace dei pannelli Mercur, distinti dalla console e dal primo frontend |
| `versione 2/` | Seconda applicazione dalla raccolta principale, con il proprio backend e console, più estesi e differenti |
| `versione 2/LEGGIMI-PRIMA.md` | Limiti della copia e regole di avvio prima di usare i vecchi launcher |
| `piani di implementazione/` | Vault completo: indice, funzionalità, architettura, roadmap, backlog, fonti e licenze |

## Dove gira davvero il backend

```text
Browser -> Python 127.0.0.1:4273 -> catalog_bridge.py -> API Node Medusa/Mercur :9273
               |                                      |
               +-- frontend statico                   +-- PostgreSQL, Redis, S3, SMTP in Docker
```

Docker avvia PostgreSQL, Redis, RustFS e Mailpit. **L'API applicativa non ha un container in questo Compose: gira sul computer tramite Node.** Avere Docker acceso senza avviare l'API non basta. Pubblicare i sorgenti su GitHub non avvia un server remoto e non mette a disposizione il database del titolare. Anche tutti i riferimenti `127.0.0.1` del clone indicano il computer del collaboratore.

Il catalogo della prima app usa `/api/catalogo` e `/api/foto` sul server Python, inoltrati rispettivamente a `/admin/ishtar/catalogo` e `/admin/uploads`. Il ponte legge `.env` e credenziali solo sul server e richiede intestazione locale e origine ammessa. Non esporlo su Internet e non trasformarlo in un proxy generico. Il login visivo della demo non è il login dell'API.

## Prima app: ambiente Windows nuovo

Prerequisiti dichiarati nel progetto: Node >=22.22, Python 3 disponibile come `python`, Bun 1.4.4 e Docker con Compose. Non è un EXE autonomo. Controllare le versioni del proprio ambiente; non usare dipendenze globali diverse al posto del lockfile.

1. Estrarre o clonare in una nuova cartella su un computer di sviluppo, non sopra l'istanza del titolare.
2. Eseguire `node tools/prepara-installazione.mjs --check` per controllare i programmi; non inizializza il DB.
3. **Solo su installazione nuova senza configurazioni/dati preesistenti**, eseguire `Prepara Ishtar Lab.bat`. Installa dal lockfile con script di installazione disabilitati, genera configurazioni locali, scarica le immagini e inizializza schema/proprietario/bucket/catalogo vuoto.
4. Eseguire `Avvia Ishtar Lab.bat`. Home: `http://127.0.0.1:4273/ishtar-lab/#/home`. API: `http://127.0.0.1:9273/health`.
5. Un DB nuovo non ha gli 82 prodotti del PC del titolare. Per le prove importare dalla UI `frontend/catalogo/inventario-demo.csv`, anonimizzato. Non eseguire il seed storico.

Se manca soltanto una configurazione di una precedente installazione, **non rigenerare alla cieca**. `backend/infra/prepara-ambiente.mjs` conserva le chiavi soltanto quando riconosce la coppia di identità API/infra: una configurazione parziale può far generare nuove chiavi incompatibili con volumi esistenti o connettori cifrati. Fermarsi e recuperare configurazioni/backup coerenti prima di una reinizializzazione. Non cancellare volumi per risolvere un errore di accesso.

### Configurazioni necessarie, senza condividere segreti

| File locale escluso da Git | Ruolo |
|---|---|
| `backend/infra/.env` | Identità istanza e credenziali PostgreSQL, Redis e archivio |
| `backend/piattaforma/packages/api/.env` | URL DB/Redis, JWT/cookie, chiave cifratura connettori, S3, SMTP, CORS e URL applicativi |
| `backend/.credenziali-locali.env` | Credenziali del proprietario **del nuovo PC**, non dell'account GitHub |
| `backend/piattaforma/apps/{console,admin,vendor}/.env.local` | URL API per i workspace frontend |

Schema e nomi completi sono nel generatore `backend/infra/prepara-ambiente.mjs`; i controlli di identità sono in `istanza.mjs`. Credenziali e configurazioni devono riferirsi allo stesso DB/istanza. Non includere i valori in issue, screenshot, log pubblici o commit.

### Porte della prima app

| Componente | Porta host |
|---|---|
| Primo frontend / API | 4273 / 9273 |
| Console opzionale | 5283 |
| PostgreSQL / Redis | 55730 / 56730 |
| S3 / console S3 | 59730 / 59731 |
| Mailpit web / SMTP | 58730 / 51730 |

Progetto Docker `ishtar-lab-redx`; volumi `ishtar_lab_redx_postgres`, `ishtar_lab_redx_redis`, `ishtar_lab_redx_storage`. Due copie con le stesse identità sullo stesso PC non sono due ambienti isolati. Il frontend principale viene servito da Python, non dal dev server della console.

## Linux: lavoro ancora da fare

Le foto mostrano un ambiente Linux del collaboratore. I BAT e PowerShell sono per Windows; `runtime.mjs` controlla l'identità dei processi con API Windows e usa `taskkill.exe` nello stop. La copia non viene presentata come avviabile integralmente su Linux.

Per il porting riutilizzare Compose e i sorgenti TypeScript; adattare lancio/stop e rilevamento processi, comando `python3`, assenza di Docker Desktop e installazione/versione Bun. Il solo comando `python3 avvia_pannello.py` avvia il frontend, non i servizi o l'API. Il backend può essere studiato e avviato in primo piano dal workspace API tramite la CLI locale Medusa dopo configurazione e migrazioni; progettare il gestore Linux senza assumere che `runtime.mjs stop` funzioni già. Verificare la sequenza su un DB di prova e documentarla nella PR, invece di dare per riuscito il bootstrap.

Nel Compose **pubblicato della prima app** RustFS è già riferito tramite digest pubblico, mentre il Compose operativo sul PC del titolare e quello storico di versione 2 hanno il tag locale `rustfs/rustfs:local-d30c5e04efc4`. Il digest della consegna è `rustfs/rustfs@sha256:d30c5e04efc48cea32dfcf9550ccc5a01840564bc99c113d1a04471d43d4872f`. È una sostituzione già effettuata nella sola consegna principale; disponibilità odierna, architettura e download su Linux vanno controllati. Non è stato rieseguito un pull in questa sessione e la seconda copia resta fedele alla sorgente.

**Aggiornamento del 12 novembre, proposta di satria64 (PR #2, in attesa di revisione):** launcher `prepara-ishtar-lab.sh`, `avvia-ishtar-lab.sh` e `ferma-ishtar-lab.sh`, runtime con `backend/infra/processi.mjs` (riconoscimento e arresto dei soli processi della copia su Linux e macOS) e preparazione riprendibile e protetta, provati a macchina pulita su Ubuntu 26.04 (`verifiche/avvio-linux-2026-11-12.json`). Il riferimento `rustfs/rustfs@sha256:d30c5e04…` è l'ID locale dell'immagine, non un digest del registro: il pull risponde 404 su qualunque PC nuovo. La proposta usa `rustfs/rustfs:1.0.5@sha256:b81d16a9…`.

## Cosa è integrato e cosa deve fare il collaboratore

Catalogo, foto, campi configurabili, CSV e scorte della prima app hanno prove storiche del collegamento al DB. Dashboard, ordini, clienti, analisi, marketing e altri moduli del primo frontend restano dimostrativi; le prove di navigazione non dimostrano flussi commerciali completi. Varianti multiple nella stessa scheda, ordini/pagamenti/spedizioni reali e integrazioni complete richiedono lavoro e verifica.

L'inventario statico attuale conta **18 provider più una voce demo condizionale**, in entrambe le basi: Instagram, Facebook, TikTok, Pinterest, Google/YouTube, LinkedIn, X, WhatsApp, Telegram, Sendcloud, Stripe, Fatture in Cloud, Brevo, Resend, Shopify, WooCommerce, Claude e Plausible. Il numero delle voci non prova un motore di sincronizzazione: salvataggio credenziali, OAuth/prova di accesso, sincronizzazione dati, webhook e pubblicazione sono capacità differenti. Leggere `modules/connectors/catalogo.ts`, `oauth.ts`, `prova.ts`, i middleware e le rotte pertinenti. Nessun account reale risulta collegato da questa consegna.

## Metodo di ripresa e verifiche

1. Leggere [[Versione 2 - origine e differenze]] e [[Segnalazioni ricevute e verifiche]], poi [[Stato delle funzioni]], [[Architettura e dati]] e [[Backlog completo]].
2. Salvare il proprio lavoro in un ramo e annotare commit/versione analizzati. Prima prova: servizi, migrazioni e autenticazione su ambiente separato; poi catalogo e persistenza.
3. Riutilizzare le API esistenti. Non sostituire i bundle o ridisegnare il primo pannello senza istruzione del titolare; valgono `.ai-style-rules.md` e AGENTS.md.
4. Per la prima app, test puri: `node --test verifiche/csv.test.mjs verifiche/identita.test.mjs` dalla radice. Il 12 novembre: 7/7 superati. Typecheck/build/integrazioni delle due basi vanno eseguiti nei rispettivi workspace dopo installazione, senza dichiarare verifiche non fatte.
5. `infra/prova-*`, popolamenti, seed e script di rimozione demo possono modificare dati; eseguirli solo su DB di prova. Non attivare provider, inviare email reali o usare pagamenti reali per un test di consegna.
6. Proporre PR con problema riproducibile, modifiche, prove, migrazioni e ripristino. Aggiornare memoria e note senza chiudere automaticamente tutte le 107 attività.

Gli inventari in `99 Fonti/inventario-api-due-versioni.csv` e `inventario-due-versioni.json` sono mappe dei file, non audit. Licenze e avvisi restano distinti; consultare la documentazione legale della radice. La chat WhatsApp e le fotografie ricevute non sono incluse nel repository pubblico.
