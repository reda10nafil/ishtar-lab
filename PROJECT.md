# Recupero del primo pannello

Aggiornato: 12 novembre 2026 (Europe/Berlin).

**Proposta del 12 novembre (ramo `avvio-linux` di satria64, autorizzata dal titolare nella issue #1 e in attesa di revisione):** avvio su Linux, riferimento RustFS pubblico e preparazione protetta. Seconda proposta (ramo `correzioni-dati-csv`): dati demo separati dalle scorte reali e import CSV conservativo. Terza proposta (ramo `affidabilita-salvataggi`): modifiche conservate con il server spento, ricollegamento automatico e ponte più chiaro. Quarta proposta (ramo `sicurezza-riservatezza`): costo d'acquisto e dati interni fuori dal negozio online e dai ruoli senza margini, connettori, console di sviluppo e carte regalo. Dettagli nelle sezioni finali. Finché non vengono integrate, lo stato seguente resta quello delle consegne del titolare.

**Ultimo stato:** consegna al collaboratore ampliata con la seconda app in `versione 2/`, sorgenti backend e tre nuove guide nel vault. Prima app conservata, nessuna correzione applicativa applicata in questa consegna. Stato di pubblicazione e verifiche nel rapporto `verifiche/consegna-versione2-2026-11-12.json`; leggere l'ultimo aggiornamento in fondo. Il tentativo locale di audit dell'8 novembre non è iniziato; l'analisi esterna fotografata è distinta.

## Obiettivo e ambito

Conservare il design del primo pannello mostrato dall’utente, originariamente aperto su `http://127.0.0.1:4173/lumelle#/home`, e adattarlo a Ishtar Lab con catalogo moda e dati dell’utente. Non sostituirlo con la seconda console Multi Outfit né con una nuova interfaccia. Catalogo e inventario sono integrati alle API; gli altri moduli conservano la UI e dati dimostrativi nel browser.

Cartella scelta: `C:/Users/reda_/Desktop/redx`. Origine: `C:/Users/reda_/Desktop/Progetti suddivisi/pannello di amministrazione del negozio`.

## File conservati e decisioni

- `frontend/`: i 32 file del pannello funzionante, copiati da `captures/lumelle/mirror` tramite il salvataggio, compresi JavaScript, CSS, icone e font. Sono i file effettivamente eseguibili, non una ricostruzione statica della foto.
- `Recupero-pannello-2026-11-06/originale/`: copia storica di 2.554 file (138,27 MiB) del progetto esistente, inclusi sorgenti, documentazione, catture, vecchi backup e Multi Outfit. Quest'ultimo rimane solo come conservazione aggiuntiva e non viene avviato.
- `Recupero-pannello-2026-11-06/MANIFEST-SALVATAGGIO.json`: elenco dei file e SHA-256, confrontati con l'origine prima e dopo la copia. Nessun file instabile o errore rilevato nella copia.
- Escluse solo dipendenze/cache rigenerabili: `node_modules`, `.cargo-target`, `.medusa` e altre directory di cache se presenti; elenco effettivo nel manifest. Nessuna dipendenza del progetto originale è necessaria per aprire il front-end recuperato.
- `verifiche/riferimento-utente.png`: immagine fornita dall'utente; `verifiche/integrita-frontend.json`: identità dei 32 file con il salvataggio.
- `avvia_pannello.py` e `Apri pannello recuperato.cmd`: server locale separato, Python standard già disponibile, porta 4273. Il server pubblica esclusivamente `frontend/`, non backup o configurazioni private.

Il salvataggio fotografa lo stato trovato oggi, non certifica com'erano i file prima delle modifiche dell'altro assistente. La cartella originale non è stata modificata e i suoi processi non sono stati fermati. Tutte le attribuzioni e i nomi sono conservati.

## Avvio

Fare doppio clic su **Apri pannello recuperato.cmd**. Lasciare aperta la finestra di avvio mentre si usa la copia. Indirizzo: `http://127.0.0.1:4273/lumelle/#/home`.

In alternativa, da questa cartella: `python avvia_pannello.py` e aprire l'indirizzo. Non utilizzare i vecchi launcher archiviati: puntano ai servizi del progetto originale.

## Stato delle verifiche

- Verificato: salvataggio senza errori, 2.554 file stabili durante la copia; identità dei 32 file nella copia del front-end.
- Verifica browser del pannello originale: apre Overview e mostra menu, grafico, coda ordini e prodotti.
- Verificato nel browser: avvio della copia, schermata Overview, Ordini, ricerca ordini (Yuki: 12 risultati), catalogo Prodotti e Impostazioni. Nessun ordine o prodotto modificato. Risultati in `verifiche/esito-controlli.json`.
- Verificato via HTTP: tutti i 32 file serviti dalle porte 4173 e 4273 coincidono con la copia conservata; i documenti del backup non sono esposti dal server (404). Dettagli in `verifiche/confronto-http.json`.
- Controllo statico preliminare del solo front-end in `verifiche/controllo-preliminare.json`: nessun eseguibile nativo, WebSocket, EventSource, sendBeacon, eval o service worker rilevato tramite ricerca dei relativi costrutti. Gli URL presenti e i riferimenti fetch/XHR sono elencati nel rapporto; non è una garanzia di assenza di codice dannoso.
- La restrizione incontrata inizialmente riguardava le connessioni locali dell’ambiente di esecuzione, non un blocco accertato nel pannello. Server separato avviato con i permessi necessari, PID 51012 alla verifica; il PID può cambiare negli avvii successivi.
- Backend estratto separatamente in `backend/` e controllato come descritto nella sezione successiva. Ora avviato su servizi indipendenti; non ancora integrato con il primo pannello. Nessuna pubblicazione eseguita.

## Limiti del salvataggio

- La copia del codice non comprende automaticamente i dati salvati nel browser dell'utente (`localStorage`, cookie o sessioni). La nuova porta ha uno spazio di salvataggio separato. I dati dimostrativi possono cambiare per animazioni, orario o preferenze del browser.
- Non è stato eseguito un dump dei database o dei volumi Docker. Non eliminare volumi o profili browser originali per ripulire il vecchio progetto.
- I file del pannello sono JavaScript/CSS compilati. Sono stati conservati anche i progetti di supporto presenti, senza promettere che i componenti React generati ricostruiscano il sorgente originale.
- I controlli funzionali svolti qui saranno indicati esplicitamente; non si certificano pagamenti, invio email, stampa o integrazioni reali.

## Prossimo passo

Recupero e controlli di avvio conclusi. Nella nuova sessione partire da questa cartella e concordare gli elementi da riportare allo stato desiderato dall'utente, mantenendo il salvataggio storico intatto. Non sostituire la prima interfaccia con la console Multi Outfit.

## Risorse valutate

Consultati AGENTS.md e RISORSE.md della raccolta e la memoria del progetto originale. REA valutato ma non necessario: i file effettivamente serviti sono presenti sul disco; non serve ricostruirli mediante reverse engineering. prompts.chat e nuovi plugin non necessari per questa copia. Riutilizzati Python e gli strumenti browser disponibili; nessuna installazione e nessun bootstrap globale, per rispettare la conservazione dell'origine.


## 6 novembre 2026 — Backend estratto e verificato

Richiesta successiva dell’utente: conservare anche il backend e controllare restrizioni o problemi; in seguito fornirà percorsi di dati, CSV e materiali del brand. Nessun dato reale importato.

- `backend/` contiene la copia completa di `multi-outfit/` del salvataggio, inclusi workspace e applicazioni di supporto richieste dal suo sistema di build. Non sostituisce la prima interfaccia in `frontend/`.
- Integrità verificata: 729 file inizialmente identici al manifest. Dopo la scansione l’indice Git della sola copia, aggiornato dallo strumento, è stato ripristinato dal salvataggio; verifica finale di tutti i 729 file senza differenze. Nessun sorgente applicativo corretto.
- Verifica mirata con Codex Security, scan `1f5b4912-cffd-4f3f-ac40-34734fdaf49f`, conclusa con copertura complessiva parziale. Tutti i 144 file TypeScript delle API personalizzate sono stati letti dal revisore baseline; controllati inoltre configurazione, permessi, connettori, seed e parti di autenticazione/esportazione della console. Non sono stati auditati integralmente tutti i modelli, migrazioni, viste secondarie, dipendenze o binari.
- Rapporto canonico: `C:/Users/reda_/.codex/state/plugins/codex-security/scans/backend/9b815bdc63aa6a7541fd9f92341a76e175927dde_20261106T185247Z_1mvukcit/report.md`. Nella stessa cartella: coverage.json, findings.json e threatmodel.md; evidenze in artifacts/verifiche/.
- Non individuati controlli di attivazione commerciale, kill switch o comandi da input HTTP nelle API custom esaminate. I controlli su ruoli, aziende, inviti, scorte e OAuth sono funzioni di accesso e validazione; nessuna protezione rimossa. Questo non certifica assenza di malware in tutto il computer o nelle dipendenze.

### Problemi e limiti accertati

1. **Isolamento non predisposto:** `.env`, Compose (`name: multi-outfit`), porte e nomi dei volumi puntano ancora ai servizi del progetto originale. Non eseguiti `avvia.ps1`, `ferma.ps1`, seed, migrazioni o prove che modificano servizi. Prima di avviare la copia, assegnare progetto, porte, volumi, database, bucket e chiavi indipendenti.
2. **Seed dimostrativo:** crea aziende approvate con password condivisa senza guard per ambiente demo. Il rischio è condizionato all’esecuzione e al mantenimento degli account; non verificata la loro presenza nel database attuale.
3. **WooCommerce:** la verifica del sito filtra l’hostname testualmente, non gli IP risolti. Potenziale SSRF limitata a proprietario, HTTPS valido e risposta ridotta; nessuna richiesta di rete eseguita.
4. **CSV della console di supporto:** CR interno non quotato può creare un record aggiuntivo con formula. Riprodotto con helper originale in ambiente temporaneo e parser CSV, non con Excel e non tramite database. Questo riguarda l’esportatore della console conservata col backend, non un componente sostitutivo della prima interfaccia.
5. **Accesso automatico locale:** la console di sviluppo ha `/__accesso-locale`, che usa le credenziali locali per ottenere un token admin. Non classificato come bypass remoto dimostrato; non attivo nella build statica. L’utente non ha ancora scelto se conservarlo. Non dedurre il consenso storico dal codice.
6. **Configurazione futura:** segreti JWT/cookie hanno fallback costanti se le variabili mancano (le variabili locali recuperate sono presenti); connettore demo dipende dalla sola variabile CONNECTORS_DEMO_URL; cache revalidate punta al root di localhost:3000 senza controllo dello stato HTTP. Prima di pubblicazione o uso reale, rivedere queste impostazioni.

I tre rilievi nel rapporto storico erano di gravità **bassa nel contesto locale e con i prerequisiti descritti**. Sono stati corretti nella fase successiva, documentata sotto; il rapporto storico sigillato non è stato riscritto.

### Verifiche realmente eseguite

- Parsing sintattico TypeScript 5.9.3: 352 file TS/TSX senza errori; Node --check: 25 file JS/MJS senza errori; due launcher PowerShell analizzati senza errori. Non è un typecheck completo.
- Due gruppi di test puri, in una cartella temporanea, con sette file copiati e senza database/rete: 32 superati, 1 fallito. Il test fallito costruisce un account simulato “Multi Outfit” ma si aspetta “Ishtar Lab” (nel test “riconosce una chiave valida e indica l’account” di `connectors.unit.spec.ts`). Non dimostra un errore dell’API Stripe reale.
- Primo tentativo dei test con SWC fermato per binding nativo non caricabile; test poi eseguiti compilando le stesse fonti con TypeScript. Nessuna installazione e nessuna dipendenza originale modificata.
- Nessuna prova completa di avvio API, autenticazione framework, caricamento file, provider reali, invio email, pagamenti, DB o importazioni effettuata.

### Prossimo passo aggiornato

Ricevere i percorsi dei dati, CSV e materiali del brand. Prima analizzarli in sola lettura: colonne, codici prodotto/SKU, varianti, prezzi, scorte, immagini e dati da mantenere. Non importare automaticamente. Preparare l’ambiente backend separato, definire la mappatura e verificare gli eventuali account demo prima di ripopolare i dati. Il primo frontend resta quello già recuperato; la sua integrazione con il backend è ancora da realizzare.


## Stato attuale — 6 novembre 2026: Ishtar Lab isolato e personalizzato

**Implementato e verificato:** isolamento operativo, correzioni dei tre rilievi, marchio Ishtar Lab e monogramma IH con stella. **Non ancora implementato:** collegamento del primo pannello al backend reale e importazione dei dati dell’utente. Nessun CSV o inventario reale importato.

### Ambiente indipendente pronto

- Progetto Docker `ishtar-lab-redx`; rete `ishtar_lab_redx_private`; quattro servizi nuovi verificati. Volumi dedicati `ishtar_lab_redx_postgres`, `ishtar_lab_redx_redis`, `ishtar_lab_redx_storage`, diversi dai volumi multi-outfit originali.
- Porte: pannello 4273 (invariato nella copia), API 9273, PostgreSQL 55730, Redis 56730 con password, S3 59730/console 59731, email 58730/SMTP 51730. Console di supporto 5283 opzionale, non avviata.
- Database nuovo `ishtar_lab_redx`, tabelle migrate, proprietario locale con password generata, bucket nuovo `ishtar-lab-assets`. Catalogo nuovo verificato vuoto. Nessuna copia, pulizia o migrazione del vecchio DB.
- File .env rigenerati con chiavi diverse dall’archivio originale; CORS pronto per il primo pannello. Connettore demo e revalidate del vecchio sito disattivati nella configurazione della copia. Il generatore non stampa segreti.
- Launcher nuovi: `Avvia Ishtar Lab.cmd`, `Ferma backend Ishtar Lab.cmd`. I wrapper backend avvia/ferma/migra e gli script package dev/start puntano alla copia. Stop con PID e percorso verificati, senza arresti per numero di porta. Stato/processi e log sono in backend/.runtime/.
- Risolto errore osservato del watcher Medusa su Windows: l’avvio stabile usa `start` con NODE_ENV development e non usa il watcher backend. Per applicare modifiche al backend arrestare/riavviare soltanto la copia. Nessuna modifica alle dipendenze del vecchio progetto.

### Correzioni verificate

- WooCommerce: parsing URL senza userinfo/query/fragment, sottocartella WordPress e porta HTTPS preservate; controllo A/AAAA nel lookup della connessione, IP verificati senza seconda risoluzione. Esclusi indirizzi speciali IPv4/IPv6 e prefissi non pubblici anche se risolti da DNS. Nessun redirect, TLS predefinito e timeout; gestione di risposte HTTP non standard senza eccezioni fuori dal promise.
- Seed demo: guard all’inizio prima delle modifiche; richiede ambiente test/development, opt-in esplicito e password fornita individualmente. Nessun valore di password demo incorporato nel seed. Il setup reale non lo esegue.
- CSV della console di supporto: quota anche CR, conserva protezione formule, Unicode e valori numerici. Corretto il test che si aspettava un nome diverso da quello simulato.
- Proprietario: inizializzazione recuperabile dopo fallimento parziale di registrazione/collegamento; metadati conservati e nessuna riassegnazione ad altri utenti. Segreti JWT/cookie obbligatori, senza fallback costante.

### Marchio applicato al primo pannello

- Nome software **Ishtar Lab**, nome negozio **Ishtar Hub**, logo IH con stella in bianco nel riquadro rosa esistente. Aggiornati sidebar, versione mobile, accesso, titolo dinamico delle pagine e favicon (anche ICO e icona Apple).
- Asset canonici in `brand/`: `ishtar-mark.svg`, `ishtar-icon.svg`, `ishtar-icon.png`, `ishtar-icon.ico`; copie servite in frontend/brand/. Adattamento vettoriale basato sulle foto fornite, senza modificare le foto originali; riferimenti in brand/riferimenti/.
- Conservate le attribuzioni originali nel commento iniziale dell’HTML. Percorso tecnico /lumelle e namespace dei dati conservati per non perdere lo stato del browser. Migrazione del solo nome dimostrativo Saltmarsh verso Ishtar Hub, lasciando inventario e preferenze esistenti.
- Conferma browser dopo reload: titolo Overview — Ishtar Lab, monogramma caricato, testo Ishtar Lab / Ishtar Hub, favicon nuova. Prova visiva in `verifiche/ishtar-lab-brand.jpg`.

### Verifiche finali

- Rapporto delle correzioni e dei limiti: `C:/Users/reda_/.codex/state/plugins/codex-security/scans/backend/artifacts-9785f2db587c420ae3dbcc3ecff1a6ba96888cc2d5d4cabc8765c58179bbc457/artifacts/fixes/ishtar-lab-2026-11-06.md`. Conserva separato il rapporto storico della scansione sigillata.
- 80 test unitari passati, inclusi DNS/IP speciali, retest impostazioni salvate, redirect, HTTP 600, seed, recupero proprietario e calcoli outfit; `verifiche/test-correzioni.json`.
- 13 casi CSV verificati con helper originale e parser Python indipendente.
- Typecheck API senza errori; typecheck e build della console di supporto completati; bundle del primo pannello controllati sintatticamente e asset SVG validi.
- 11 controlli pratici su servizi nuovi: health, anonimo negato, accesso proprietario, permessi, catalogo vuoto, connettori, demo assente, upload/lettura/rimozione del file di prova, chiavi distinte. Esiti in `verifiche/isolamento-servizi.json`.
- Arresto/riavvio reale della sola copia e secondo avvio senza duplicati verificati. Vecchi container multi-outfit rimasti attivi (uptime di ore) e volumi distinti confermati. I log conservano anche l’errore storico del watcher, precedente al nuovo avvio stabile.

### Priorità per la ripresa

1. Ricevere i percorsi dei dati, CSV e materiali del brand indicati dall’utente; analizzarli in sola lettura e definire mappatura, duplicati, varianti, prezzi, scorte e immagini.
2. Collegare il primo pannello alle API indipendenti con autenticazione e flussi reali, preservando il design scelto. Ora il pannello contiene ancora dati locali/dimostrativi e non riflette il DB nuovo.
3. Eseguire una prova di importazione controllata e revisione dei risultati prima di ripopolare tutto. Non usare il seed demo e non toccare il vecchio DB.

## Catalogo moda, materiali e piano aggiornato — 6 novembre 2026

Richiesta: rimuovere il nome tecnico precedente dall’indirizzo e il sottotitolo sotto Ishtar Lab; progettare inventario moda, importazione CSV con trascinamento, foto e campi configurabili con selettori rapidi, tab e pannello laterale verticale. Successiva autorizzazione esplicita dell’utente a integrare nomi e dati mancanti con valori fittizi.

Implementato e verificato:

- Frontend spostato nella sola copia operativa a `frontend/ishtar-lab/`. Riferimenti HTML, CSS e caricamento dinamico aggiornati, launcher e istruzioni di avvio allineati. `/lumelle` reindirizza al percorso nuovo; in browser il bookmark `#/products` è rimasto sulla pagina corretta. Server locale della sola copia riavviato con identità del processo verificata.
- Rimossa la seconda riga sotto il marchio nella sidebar e nel menu mobile. Titolo Ishtar Lab e logo conservati, nessun reset di inventario o preferenze nel browser. Screenshot in `verifiche/ishtar-lab-senza-sottotitolo.jpg`.
- CSV originale letto e copiato in `dati/sorgenti/inventario_2026-06-21.csv`, SHA-256 `24bc4d7dc7534e9601ef3fe711be148d54d260416e45c09b59ff51540dac813c`. Analisi in `dati/analisi-2026-11-06/`: 82 record, 52 SKU che sono URL foto, 52 categorie assenti, 22 nomi “Senza Nome”.
- Cartella `C:/Users/reda_/Desktop/Gemini/Workflow Agent E-commerce/media-runs` analizzata in sola lettura: 39 immagini leggibili, 16 contenuti unici; 13 output e 26 input da nome file. Due esempi visionati; nessuna associazione automatica a SKU. JSON dei workflow non letti né pubblicati.
- Copia dimostrativa creata con Artifact Tool: `outputs/ishtar-catalogo-20261106/inventario-demo.csv`, 82 SKU unici e 25 colonne tutte compilate; Tipo Dati DEMO, stato bozza, campi fittizi segnalati. Materiali, categorie, genere, colori e prezzi proposti sono valori per le prove, non schede verificate. Tre valori di genere rappresentati; codice a barre interno DEMO, senza inventare GTIN commerciali. Prezzi/costi zero integrati nella sola demo; stock originale conservato.
- I 52 URL foto sorgenti rimangono invariati; 30 foto mancanti hanno un segnaposto locale dichiarato. Nessun CSV importato nel DB e nessuna immagine caricata nel bucket. Registro dei cambiamenti e degli identificatori in `provenienza-demo.json`; spiegazione in LEGGIMI.md accanto al CSV.
- Verifiche in `verifiche/percorso-ishtar-lab.json` e `verifiche/catalogo-demo.json`: redirect, asset/font/favicon e bundle prodotti raggiungibili; JS controllato sintatticamente; CSV riletto con parser Python indipendente, 82 record, nessuno SKU-URL, nessun campo vuoto, stock e link originali preservati. Originale esterno e copia sorgente identici.

**Piano pronto, funzioni non ancora implementate:** `PIANO-INVENTARIO.md` contiene tassonomia di otto categorie, campi specifici, variante distinta dal prodotto, gestore di campi con tipi/unità/ordine/visibilità, pannello laterale, tab, pop-up colori, foto locali/URL, drag and drop CSV, mapping riutilizzabile, deduplicazione, lotti riprendibili ed esiti per riga. Consultate fonti ufficiali Google Merchant Center, Shopify e WooCommerce; documentate come riferimenti, senza nuove dipendenze o blocchi commerciali.

**Prossimo passo concreto:** implementare modello e API del catalogo moda e collegare il primo pannello al DB indipendente, preparando componenti modificabili che ne conservino il design. Seguire le prove di accettazione del piano; usare il CSV demo prima dei dati reali. Il catalogo candele ancora visibile resta dimostrativo finché il collegamento non è realizzato. Non dichiarare il trascinamento o i campi configurabili già operativi.

## 7 novembre 2026 — Catalogo operativo e ripristino del design originale

L’utente ha chiarito che voleva funzioni nell’app, non soltanto file e piano. Dopo una prima implementazione con layout alternativo ha chiesto esplicitamente di ripristinare l’interfaccia originale in tutte le pagine. Questa indicazione è vincolante: leggere `.ai-style-rules.md` e non sostituire nuovamente i componenti originali.

### Implementato

- API autenticata `/admin/ishtar/catalogo` protetta dai permessi, con validazione di prodotti e campi. I dati principali sono prodotti/varianti/offerte/inventario Medusa/Mercur; definizioni dei campi nei metadati dello store, attributi estesi nei metadati prodotto. Azienda Ishtar Lab e otto categorie predisposte con script idempotente; nessun dato del vecchio progetto modificato.
- Ponte locale `catalog_bridge.py` su 4273: inoltra soltanto catalogo e upload verso 9273. Credenziali solo server-side, Host/Origin/Fetch-Site e intestazione locale controllati. Modalità locale a singolo proprietario; non è una soluzione di login per una futura pubblicazione multiutente.
- 82 articoli demo importati, 82 SKU unici, quantità complessiva 72. Importazione iniziale registrata in `verifiche/importazione-demo-database.json`. Catalogo reale della copia distinto dagli altri dati dimostrativi del browser.
- Ripristinati i componenti originali di catalogo, inventario e home: tab, filtri, schede/lista, tabella e grafici. `catalogo/catalogo.js` è ora un adattatore al modello originale e un controller degli strumenti, non una pagina sostitutiva. Foglio CSS di base identico al backup; nuovi dialog usano glass, token e controlli esistenti.
- Creazione e modifica prodotto, scelta categoria/taglia/colore, prezzo/costo/scorte, foto multiple caricate nel bucket e campi configurabili persistenti. Configurazione corrente: 14 campi, compreso Altezza (cm) per Borse. Conteggi e modifiche rapide della tabella originale salvano nelle offerte reali.
- CSV da pulsante o trascinamento nell’area catalogo, anteprima, mappatura, creazione di campi per colonne nuove, controllo di nomi/SKU/categorie/numeri e modalità ignora/aggiorna per SKU. La reimportazione di 82 SKU esistenti è stata provata nell’interfaccia senza duplicazione. Il trascinamento fisico da Esplora file non è stato provato.
- Recuperati e ripopolati gli altri moduli dimostrativi, preservando le loro pagine. I riferimenti prodotto di ordini, collezioni e vetrina sono coerenti con il catalogo moda. Clienti denominati Cliente Demo, email example.invalid. Questi dati restano nel browser: non sono ordini/clienti importati nel DB.
- Risolti due errori introdotti durante l’integrazione: azzeramento dello stato prima che la risposta API fosse pronta e riferimenti a prodotti mancanti che causavano pagina bianca nella vetrina. L’avvio resta leggibile durante un’interruzione API e riprova il collegamento. Backup locali `ishtar:backup-candele` e `ishtar:backup-prima-ripopolamento-v5`; migrazione ripristino versione 5. Nessun database originale cancellato.

### Verificato

- 28 pagine principali aperte nel browser con ricaricamento completo, titolo e componenti visibili: dashboard; ordini/all/drafts/returns; prodotti/catalogue/inventory/collections; clienti/people/segments; analisi/sales/traffic/builder; marketing/campaigns/automations; sconti/codes/gift; canali/storefront/till/wholesale; app/installed/browse; impostazioni/store/team/shipping/alerts/appearance/data; help. Esiti in `verifiche/pagine-ripristinate.json`.
- Creazione da GUI di un prodotto temporaneo con PNG caricato e campo Altezza=32, verifica della persistenza nel DB e lettura dell’immagine dal nuovo archivio. Rimosso soltanto l’articolo QA; catalogo riportato a 82. Foto caricata conservata nel bucket. Esito in `verifiche/qa-catalogo-operativo.json`.
- Incremento di una scorta nella tabella originale, lettura dal backend e ripristino del valore iniziale. Accesso backend anonimo negato e richieste al ponte senza intestazione/origine locale respinte.
- Cinque test parser CSV superati, sintassi JS e typecheck API completati senza errori. CSS di base e attribuzione confrontati con backup: `verifiche/integrita-design.json`.
- Dashboard originale confermata visivamente; prova in `verifiche/dashboard-ripristinata.jpg`. Le prime prove prima della correzione hanno registrato errori storici della vetrina: non confonderli con l’esito finale.

### Avvio con BAT

`Avvia Ishtar Lab.bat` nella radice di redx, con helper `tools/apri-ishtar-lab.mjs`. Controlla Python/Docker, avvia Docker Desktop se necessario, avvia la sola istanza ishtar-lab-redx, attende l’API e il pannello e apre `http://127.0.0.1:4273/ishtar-lab/#/home`. Il CMD esistente rimanda allo stesso BAT. Test del BAT con `--no-browser` concluso con codice 0 e istanza già attiva, senza duplicati. Non provato l’avvio a freddo dopo un riavvio completo di Windows o con Docker inizialmente spento.

### Ripresa

Prima confrontare le pagine effettive con il design originale e leggere le prove. Le evoluzioni ancora previste sono in PIANO-INVENTARIO.md: più varianti nella stessa scheda, importazioni annullabili per lotto, immagini remote scaricate/associate con controlli e collegamento reale degli altri moduli. Non modificare layout o cancellare liste per queste attività. Nessuna pubblicazione esterna eseguita.

## 7 novembre 2026 — Licenza e vault dei piani di implementazione

Su richiesta dell'utente predisposta una licenza personale non commerciale per gli eventuali destinatari dei contributi originali Ishtar: nome/crediti conservati, invio privato delle modifiche entro 30 giorni dal primo uso, anche privato, e concessione al titolare del diritto di riutilizzarle. Non aggiunti blocchi, scadenze, telemetria o invii automatici. Il titolare mantiene l'uso dei propri contributi per l'attività, nel rispetto delle licenze dei terzi.

**Stato della licenza: bozza, non distribuita.** Nome legale/ragione sociale e recapito modifiche chiesti all'utente, ancora non confermati. Nome pubblico provvisorio Ishtar Hub, senza presumere una persona giuridica. Canonici LICENSE.md, LICENSING-SCOPE.md, THIRD_PARTY_NOTICES.md, CONTRIBUTING.md e licensing/LICENSOR.json. Fare verifica professionale prima della consegna a terzi.

Verifica legale mirata: index.html conserva © 2026 Hasib (OVERSHOOT) e rinvia a LICENSE.md non trovato nel materiale campionato. Accesso web alla pagina originaria e alla licenza non riuscito; non accertati diritti di redistribuzione o prezzo di 90 dollari. La licenza Ishtar non può rilicenziare quel materiale. Manifest API MIT preservato. I LICENSE installati di Medusa/framework 2.22.3 dichiarano un regime misto MIT/Enterprise, riscontrato nelle fonti ufficiali del tag: prima di distribuire inventariare i percorsi effettivi. Non affermare che tutto il backend sia MIT, né dedurre automaticamente che il modulo custom permessi sia l'RBAC Enterprise.

Creato e aperto nell'app Obsidian il vault **piani di implementazione**, indice 00 Inizia qui.md: 27 note, 12 categorie funzionali, 107 interventi con ID/priorità/criteri di accettazione, roadmap per fasi, architettura e Canvas, usi/vantaggi, fonti e prove selezionate, sezione licenza. I conteggi sono della creazione; aggiornare dopo modifiche. I moduli esistenti sono distinti tra operativo, parziale, DEMO e codice presente non integrato. Catalogo/inventario collegati; home/ordini/clienti/analisi e altri moduli restano demo browser. Nessuna nuova integrazione o ricerca mercato eseguita.

Configurazione locale Obsidian con strumenti core, senza plugin community, cloud o pubblicazione. Vault registrato tramite Apri cartella come vault e indice visibile. Verificati collegamenti interni, configurazione JSON/Canvas, ID unici, identità delle copie dei testi legali e impronte di dieci file applicativi immutati. Rapporti verifiche/vault-licenza.json e vault-manifest.json. Nessuna modifica all'app, al DB o al design per questa attività.

Prossimo passo: confermare titolare/recapito e chiarire diritti per eventuali consegne; sul prodotto partire da backup completo con ripristino verificato, varianti e lotto reale controllato, poi scegliere il primo sito da collegare. Consultare il vault insieme al piano inventario esistente, senza rigenerare/sovrascrivere le note curate.

### Aggiornamento titolare e recapito — 7 novembre 2026

L'utente ha comunicato **Reda Zahloul** e **ralreda54@gmail.com**. Compilati LICENSE.md, scheda titolare, guida contributi e copie/note nel vault. Credito richiesto: Ishtar Lab — progetto Ishtar Hub — Reda Zahloul. Stato: testo compilato per i soli contributi legittimamente disponibili, non pubblicato. Nessuna email inviata; recapito fornito dall'utente, non testato. LEG-01 parziale: resta la gestione dell'accettazione dei destinatari. Diritti frontend e licenze dei terzi restano da chiarire prima di distribuire il pacchetto completo. Nessuna modifica a UI, servizi o DB.


## 7 novembre 2026 — Consegna privata GitHub e licenza 1.1

Il titolare ha autorizzato app e vault su GitHub privato e un pacchetto scaricabile, senza attendere il suo rientro. Account verificato reda10nafil; repository privato creato: https://github.com/reda10nafil/ishtar-lab . Il caricamento e la release vengono confermati nel rapporto verifiche/consegna-github.json: la sola creazione del repository non prova che i file siano già caricati.

Licenza 1.1: modifiche solo con permesso scritto preventivo di Reda Zahloul; uso commerciale consentibile soltanto mediante suo permesso e accordo scritto separato; restituzione sorgenti a ralreda54@gmail.com, senza dati privati. Aggiunto schema commerciale non firmato. Diritti dei terzi e MIT preservati, nessun trasferimento della titolarità del titolare e nessun blocco nell'app. La richiesta di questa chat autorizza il lavoro di consegna.

Copia pulita in consegne/Ishtar-Lab, separata dal backend Git esistente e dall'archivio storico. Include codice, frontend compilato, backend sorgente, comandi BAT, note Obsidian, istruzioni di collaborazione e configurazione iniziale. Esclude credenziali/env, DB/volumi, dati sorgenti privati, log, cache, dipendenze e salvataggi storici. Dataset CSV dimostrativo della sola consegna anonimizzato nei nomi/fornitore/foto; nessuna modifica al catalogo sul PC del titolare. Compose della sola consegna usa il digest pubblico della stessa immagine RustFS invece del tag locale.

Prepara Ishtar Lab.bat e tools/prepara-installazione.mjs preparano un nuovo PC con Node/Python/Bun/Docker già installati, installando dal lockfile senza lifecycle script, generando chiavi nuove e inizializzando DB/catalogo. Verificati sintassi e controllo prerequisiti; non eseguito bootstrap completo su un PC pulito. I cinque test CSV restano superati. Non si presenta lo ZIP come EXE autonomo.

Vault ora con 29 note (schema commerciale e guida GitHub aggiunti), 107 attività invariate. Accesso al collaboratore non assegnato: nome utente GitHub chiesto e ancora mancante. Nessun invito a un'identità presunta. Per proseguire, usare ramo e pull request nella copia clonata; preservare UI e leggere GUIDA-COLLABORATORE.md. Il progetto operativo resta redx, nessun originale modificato.


### Istruzione finale GitHub — 7 novembre 2026

L'utente ha ordinato esplicitamente di rendere il repository **pubblico**, scaricabile da chiunque, e di non mandare inviti a nessuno. Questa istruzione sostituisce la precedente visibilità privata e la richiesta del nome del collaboratore, che è annullata. Pubblicare app+vault e pacchetto pulito, mantenendo avvisi/licenze dei terzi e senza affermare che la visibilità conceda diritti ulteriori. Non caricare credenziali, DB, dati sorgenti privati, log o archivio storico. Il titolare prevede di poter cambiare in seguito la visibilità: nessuna modifica futura automatica viene programmata.


### Caricamento sorgenti verificato — 7 novembre 2026

Repository pubblico https://github.com/reda10nafil/ishtar-lab, ramo main, prima consegna 56c2291d449585f54cf4c5dfc8ed47e2a494cddd. Push concluso e visibilità pubblica verificata. 615 file, codice app/backend, 29 note del vault e licenza 1.1. Nessun invito. Controllo sugli oggetti Git: nessuna corrispondenza con i nove segreti della configurazione campionata; esclusi file env/credenziali, DB/volumi, archivi e dati sorgenti privati. Test CSV 5/5 e controllo prerequisiti del setup passati; bootstrap pulito non provato. Pacchetto ZIP e release in preparazione; esito finale nel rapporto di consegna. Le segnalazioni whitespace di Git appartengono a testo/bundle recuperati e non sono state usate per riscrivere il design.

### Consegna completata e verificata — 7 novembre 2026

Repository pubblico: https://github.com/reda10nafil/ishtar-lab . Release: https://github.com/reda10nafil/ishtar-lab/releases/tag/v0.1.0-preview-20261107 . ZIP Windows: https://github.com/reda10nafil/ishtar-lab/releases/download/v0.1.0-preview-20261107/Ishtar-Lab-Windows-2026-11-07.zip . Snapshot del pacchetto: c551bed7cdb290af134a438cdb76f275b9e7d5ae, 615 file, 1.637 MiB, SHA-256 b221fab00ba60b5050a5224c9d64c3297051e9f6906bdf76aac30ce3c27875b5. Controllati integrità ZIP e hash di tutti i file del manifest; scaricamento anonimo riuscito e checksum identico al file locale. Main può ricevere questi aggiornamenti documentali successivi al tag; MANIFEST-CONSEGNA.json riguarda lo snapshot della release, non i successivi rapporti.

Inclusi app frontend/backend, BAT, preparazione e vault con 29 note. Esclusi segreti, DB/volumi, dati sorgenti privati e archivio storico. Non è un EXE autonomo: su un nuovo PC leggere README/GUIDA-COLLABORATORE ed eseguire la preparazione con Node/Python/Bun/Docker disponibili. Setup a macchina pulita non testato integralmente. I diritti dei componenti terzi restano distinti; nessun sistema di blocco aggiunto. Per ordine finale del titolare il repository è pubblico e non sono stati inviati inviti. L'app locale e il suo database sono rimasti intatti.

Copia Git di consegna: consegne/Ishtar-Lab con remoto origin. ZIP locale: consegne/Ishtar-Lab-Windows-2026-11-07.zip, checksum a fianco. Rapporto: verifiche/consegna-github.json. Non usare vecchi launcher o salvataggi storici per riprendere. Prossime evoluzioni nelle note del vault; nessuna automazione futura o cambio automatico di visibilità è stato creato.

## Aggiornamento — 8 novembre 2026: avviso e provenienza

L'utente contesta che gli avvisi possano essere stati inventati dall'assistente precedente. La sola presenza di un copyright non basta per certificare autore o titolarità. Verifica mirata: gli avvisi Hasib/OVERSHOOT sono nei commenti di index.html e 11 CSS, senza quelle stringhe fuori dai commenti nei file campionati. Non sono istruzioni eseguibili né prova di infezione.

Il manifest storico di site-to-desktop indica la cattura del 6 novembre da https://demo.codeandchill.store/lumelle/ . L'8 novembre una lettura diretta della pagina pubblica ha restituito HTTP 200 e lo stesso nome/avviso, anch'esso in un commento. La pagina HTML attuale ha contenuto diverso dal manifest; i due vecchi URL CSS/JS provati rispondono 404, quindi non è stato rifatto il confronto integrale dei byte con l'origine remota. Il lettore web non riusciva ad aprire il sito: il controllo è stato eseguito con una richiesta HTTP in sola lettura, senza eseguire il contenuto.

Questi riscontri sostengono l'origine indicata dai registri, ma non sono una ricostruzione di tutta la storia o una certificazione dei diritti. Non è dimostrato che l'assistente abbia inventato gli avvisi e non è stato accertato malware per la loro presenza. Nessuna scritta cancellata, nessun controllo di licenza rimosso e nessuna modifica a app, database o GitHub. Rapporti in verifiche/provenienza-remota-2026-11-08.json e verifiche/verifica-avvisi-2026-11-08.json.

## 8 novembre 2026 — Identita Ishtar e richiesta audit separato

Su richiesta esplicita dell'utente ripuliti i nomi di branding/contatti dimostrativi del precedente negozio nel pannello operativo. Profilo dimostrativo proprietario Reda Zahloul, email fornita, collaboratori con nomi DEMO neutri. Migrazione mirata mantiene ID, relazioni e schede prodotto, non modifica il database commerciale. Per le migrazioni future salva lo stato browser precedente prima delle sostituzioni; backup dei file anteriore in verifiche/prima-identita-ishtar-2026-11-08.zip. Gli ID tecnici e i namespace del browser restano compatibili per non perdere dati. Archivio storico e progetto originale intatti.

Le 12 intestazioni ripetute HTML/CSS sono state centralizzate in frontend/legal/AVVISI-COMPONENTI.txt, con testo originale e riferimento dai file; rimangono anche in THIRD_PARTY_NOTICES.md. Non sono state cancellate le licenze/commenti obbligatori delle librerie, né attribuito il codice altrui a Reda. Rimosso il commento di cattura del sito dalla pagina operativa e aggiornati metadati, vecchie email, testi receipt/gift/export e password della sola schermata dimostrativa in ishtar-demo (non autenticazione API).

Aggiunti link discreto Reda Zahloul · Licenza nella sidebar e dialog glass con condizioni, email e testo completo della licenza, servito in frontend/legal/LICENSE-Ishtar.txt. Credito limitato ai contributi Ishtar. Regole CSS originali identiche rimuovendo i commenti; nessun ridisegno di dashboard o inventario.

Verificati sette test (CSV e migrazione identita), sintassi JS, copia identica della licenza, otto pagine con ricaricamento completo, profilo e dialog visibili. Primo tentativo browser usava una pagina rimasta aperta con server ormai fermo: riavviata soltanto questa copia con il launcher, poi verifica riuscita. Le prime letture SPA senza reload erano premature, escluse dalla prova finale. Rapporto verifiche/identita-ishtar-2026-11-08.json.

L'utente ha chiesto una nuova chat dedicata ai security audits. L'audit deve verificare vulnerabilita e comportamenti indesiderati senza presumere che avvisi di copyright siano malware; nessuna garanzia di sicurezza viene dedotta da questa pulizia. Scopo e istruzioni in verifiche/BRIEF-AUDIT-SICUREZZA.md. Stato della chat e aggiornamento GitHub da registrare dopo la creazione/pubblicazione effettive.

### Chat audit creata — 8 novembre 2026

Creata su richiesta esplicita la chat «Ishtar Lab — audit di sicurezza», thread 01a1b96e-ca82-7cf3-a1cf-df5551840130, host local, progetto redx. Incarico audit Standard con prove non distruttive, nessuna correzione automatica. L’audit non è dichiarato completato: seguire la nuova chat e il suo rapporto.

### Identita pubblicata — 8 novembre 2026

Aggiornamento caricato su GitHub, commit d5235b84b5f2078294c953bda5cea9a89c7ba708. Release v0.1.1-preview-20261108 pubblicata e ZIP scaricato senza autenticazione, hash SHA-256 verificato: f82fd1dd0f263050f6236318bbe030d0a6e6e7fab94ef53dc1fa06b0674d5a73. Download: https://github.com/reda10nafil/ishtar-lab/releases/download/v0.1.1-preview-20261108/Ishtar-Lab-Windows-2026-11-08.zip . Otto pagine e sette test superati, stile originale conservato. Audit richiesto nella nuova chat 01a1b96e-ca82-7cf3-a1cf-df5551840130 attivo, non concluso. Gli avvisi obbligatori restano separati dal branding e non sono stati attribuiti a Ishtar.

## 12 novembre 2026 — Allineamento GitHub e stato effettivo dell'audit

Su richiesta dell'utente verificato il repository pubblico `reda10nafil/ishtar-lab`, ramo `main`, con base `c3684c2746871fadac76abcb1061eb91f1977536`. La copia Git di consegna è `consegne/Ishtar-Lab`; la radice operativa redx non è un repository Git.

Il confronto della selezione pubblicabile non ha trovato nuove funzioni o modifiche applicative da caricare. Conservati gli adattamenti della sola consegna: digest pubblico RustFS, percorso del CSV importabile e anonimizzazione di nomi, fornitori e foto. Non copiare indiscriminatamente il backend o il CSV operativo sopra la consegna.

Corretta la precedente indicazione di audit «attivo»: la nota `verifiche/audit-sicurezza-2026-11-08/STATO.md` documenta che l'avvio del plugin è fallito prima di ottenere scanId/scanDir. Nessuna analisi o conclusione di sicurezza prodotta da quel tentativo. La nota viene inclusa nella revisione documentale insieme agli aggiornamenti del vault; non si avvia un nuovo audit in questa sessione.

Verifiche del 12 novembre: sette test CSV/identità superati nella copia di consegna; codice e design conservati. Nessun avvio, arresto, importazione o modifica del database. Segreti, dati sorgenti privati e archivio storico restano esclusi. I dettagli della pubblicazione e dei controlli sui file sono registrati localmente in `verifiche/aggiornamento-github-2026-11-12.json` dopo l'esito effettivo.

Questa revisione aggiorna la documentazione del ramo principale; non genera una nuova release applicativa. Il pacchetto Windows più recente resta `v0.1.1-preview-20261108`; `MANIFEST-CONSEGNA.json` descrive lo snapshot di quel pacchetto, non i successivi aggiornamenti documentali. Per app e vault con le note correnti usare il ramo main o il suo archivio ZIP.

Prossimo passo: risolvere l'errore di apertura della scansione prima di riprendere l'audit richiesto; poi seguire le priorità del vault. Il backup completo di DB/foto con ripristino provato resta da realizzare: il repository pubblico non lo sostituisce.

## 12 novembre 2026 — Seconda app e consegna tecnica al collaboratore

Richiesta successiva dell'utente: condividere il backend, tutti i piani e una copia dell'altra applicazione dalla raccolta principale, sotto il nome `versione 2`, nello stesso GitHub. Le correzioni applicative saranno curate dal collaboratore. Interpretazione verificata sulle fonti: l'altra app è `pannello di amministrazione del negozio/multi-outfit`, il cui README la chiama Ishtar Lab; non è il motore Site to Desktop né il frontend recuperato.

Copiati 685 file selezionati in `versione 2/`, identici con SHA-256 della sorgente prima/dopo e della destinazione. Nessun launcher/hook/seed eseguito, sorgente e servizi originali intatti. Manifest `versione 2/MANIFEST-ORIGINE.json`. Esclusi Git annidato, env/credenziali (anche template originali), database, dipendenze, cache, log e build. Aggiunti modelli esplicitamente non operativi, memoria e istruzioni della copia. Regola .gitattributes per preservare anche i byte CRLF della sorgente nella consegna.

Il backend principale era già incluso. L'API è Node host; Docker esegue PostgreSQL/Redis/S3/email. Non è un servizio remoto condiviso dal solo upload. Versione 2: 149 file route, 9 directory moduli, 163 TSX console; prima base: 98, 7, 112. Seconda base con 52 percorsi ulteriori, marketing e negozio-online; API /admin/ishtar/catalogo presente soltanto nella prima. Nessuna fusione automatica tra backend.

Tre nuove note nel vault (ora 32 note Markdown) spiegano architettura, configurazione, porte, accesso pubblico/fork/PR, problemi Linux, rischio di rigenerazione segreti, differenze e triage delle segnalazioni. Inventari statici in piani di implementazione/99 Fonti. Le cinque immagini ricevute sono fonti private non caricate su GitHub. Il numero di 84 problemi appartiene all'analisi esterna fotografata: rapporto completo non disponibile, non verificato autonomamente qui e distinto dal tentativo locale Codex Security fallito.

Risorse condivise: AGENTS.md/RISORSE.md della raccolta consultati; REA e prompts.chat non necessari per copia e inventario. Riutilizzati Python standard, Git e controlli locali; nessuna nuova installazione. Ambiente della seconda copia predisposto come sorgenti per sviluppo, non come nuova istanza attiva. Avvio completo e Linux restano da provare; il collaboratore deve isolare identità, volumi e porte prima dei test.

La consegna per GitHub usa la copia pulita consegne/Ishtar-Lab. Esito effettivo, commit, verifiche e pacchetto sono registrati localmente in verifiche/consegna-versione2-2026-11-12.json. I manifest dei pacchetti precedenti restano storici; non vanno riscritti come se descrivessero la nuova revisione. Nessun invito, messaggio diretto o accesso a credenziali del titolare viene effettuato.

Prossimo passo: il collaboratore salva il proprio lavoro, legge Consegna tecnica al collaboratore e confronta la base usata nell'analisi con la nuova consegna; poi ambiente separato, rapporto completo, verifica dei problemi e PR con test/migrazioni/rollback. Nessuna delle 107 attività è chiusa dalla copia.

## 12 novembre 2026 — Avvio su Linux (versione modificata da satria64)

Proposta di modifica di satria64, autorizzata da Reda Zahloul nella issue #1 (commento del 12 novembre 2026) e in attesa di revisione prima dell'integrazione. Licenza Ishtar, titolarità e avvisi dei terzi restano invariati, come richiesto dal permesso. Lavoro svolto su un clone del repository pubblico (ramo `avvio-linux`, base `bf7bf01`) su Ubuntu 26.04, con Docker Engine 29.1.3 e Compose 2.40.3, Node.js 22.23.3, Python 3.14.4 e Bun 1.4.4. Istanza nuova con gli 82 articoli DEMO del CSV della consegna; nessun dato del titolare usato.

- **Preparazione bloccata su ogni PC nuovo, corretta.** Il riferimento RustFS della consegna (`sha256:d30c5e04…`) era l'ID locale dell'immagine e Docker Hub rispondeva 404. Ora è `rustfs/rustfs:1.0.5@sha256:b81d16a9…`, build pubblicata il 10/11/2026 e diversa da `rustfs/rustfs:local-d30c5e04efc4` della copia operativa. Corretta anche la sostituzione in `tools/prepara-consegna.py`. **Non copiare `compose.yaml` nella copia operativa** senza verificare prima i dati RustFS già presenti nel volume.
- **Runtime portabile.** `backend/infra/processi.mjs` riconosce e arresta i soli processi della copia anche su Linux (`/proc`) e macOS (`ps`); su Windows restano la query PowerShell e `taskkill /T /F`. `runtime.mjs` va sempre riportato insieme a `processi.mjs`.
- **Launcher Linux e macOS.** `prepara-ishtar-lab.sh`, `avvia-ishtar-lab.sh` e `ferma-ishtar-lab.sh`; `tools/ferma-ishtar-lab.mjs` ferma pannello, API e servizi. L'avvio registra il PID del pannello in `backend/.runtime/pannello.json` (log del pannello solo fuori da Windows), riusa un pannello già attivo e apre il browser con xdg-open o open.
- **Preparazione protetta, anche su Windows.** Registro `backend/.runtime/preparazione.json` e opzione `--riprendi`; arresto con indicazioni se manca un solo .env o se esistono già i volumi di un'altra copia. `prepara-ambiente.mjs` conserva le chiavi esistenti, ricava le password dei servizi dagli URL di `packages/api/.env`, non sovrascrive mai le credenziali del proprietario, avvisa se cambiano le chiavi dei connettori e salva copie `.env.*` (permessi 600) dei file che cambiano.

Verifiche in `verifiche/avvio-linux-2026-11-12.json`: preparazione a macchina pulita; avvio in circa 11 s; secondo avvio senza duplicati; arresto e riavvio con dati conservati; import demo; controlli del ponte; foto caricata e riletta con RustFS 1.0.5; ripresa della preparazione con chiavi invariate; 21 verifiche sui segreti; simulazione del ramo Windows; test 7 + 13 + 80 e typecheck API. Catalogo e Inventario visibili in Chrome senza errori. Revisione indipendente in quattro prospettive con verifica avversariale; i rilievi confermati sono stati corretti. Non provati: Windows dopo la modifica, macOS, avvio dopo un riavvio del sistema.

Osservazioni emerse dall'analisi e non corrette in questa proposta: le azioni demo di cassa, ordini e resi modificano le scorte reali nel DB tramite `ishtar:legacy-change`; l'import CSV in modalità «Aggiorna» riporta i prodotti a valori predefiniti (stato bozza, foto e campi assenti dal file); `numberCSV` legge «1.200» come 1,2.

## 12 novembre 2026 — Dati demo e import CSV (versione modificata da satria64)

Seconda proposta di satria64 (ramo `correzioni-dati-csv`, sopra `avvio-linux`), autorizzata da Reda Zahloul nella issue #1 e in attesa di revisione. Riguarda solo il codice del browser in `frontend/ishtar-lab/catalogo/`; bundle originali, licenza e avvisi invariati.

- **Scorte reali e demo separate.** Tutte le azioni del pannello passano da `os()` del kit ed emettono `ishtar:legacy-change`; cassa, nuovo ordine (anche dal menu globale sopra la pagina Prodotti), conversione di bozze e reso ricevuto cambiavano lo stock e l'adattatore lo scriveva nel database. Nuovo `catalogo/sincronizza.mjs`: si scrivono solo le modifiche della pagina Prodotti che non toccano ordini, resi o bozze; per le altre i valori del database tornano nello stato demo e compare un avviso.
- **Import CSV «Aggiorna» conservativo.** Nuovo `catalogo/importa.mjs`: per uno SKU esistente si parte dal prodotto salvato e cambiano solo le celle piene delle colonne associate; stato, foto, descrizione e campi personalizzati restano; il segnaposto non sostituisce foto vere; flag demo e stato solo con valori espliciti; intestazioni riconosciute anche con accenti e simboli. Il catalogo viene riletto dal database prima dell'anteprima, che mostra la colonna «Modifiche»; le righe invariate non vengono riscritte; per aggiornare non serve più la colonna categoria.
- **Numeri.** `numberCSV`: «1.200» = 1200, «1.234,50» = 1234,5, «1,200.50» = 1200,5, virgola decimale italiana invariata, cella vuota = non indicato, rifiutati 1e3 e 0x10.

Revisione indipendente (3 prospettive con verifica avversariale): 15 rilievi confermati e corretti, tra cui un campo numerico salvato vuoto che il backend avrebbe rifiutato, numeri ambigui decisi per colonna, foto del file in copertina, conversione di genere, Sì/No, scelte e date, CSV Windows-1252, «Pour» della Home salvato. La prova end-to-end ha trovato anche un blocco della coda dei salvataggi introdotto durante le correzioni, risolto prima della consegna.

Verifiche in `verifiche/correzioni-dati-csv-2026-11-12.json`: 46 test `node --test` (13 CSV, 20 import, 11 sincronizzazione, 2 identità); 18/18 scenari end-to-end in Chrome headless con i bundle reali e catalogo ripristinato identico; sul codice precedente la prova a 15 scenari dava 8/15. Test backend 80/80 e typecheck invariati.

## 12 novembre 2026 — Affidabilità dei salvataggi (versione modificata da satria64)

Terza proposta di satria64 (ramo `affidabilita-salvataggi`, sopra `correzioni-dati-csv`), autorizzata da Reda Zahloul nella issue #1 e in attesa di revisione. Riguarda `frontend/ishtar-lab/catalogo/`, `catalog_bridge.py` e `avvia_pannello.py`; bundle originali, licenza e avvisi invariati.

- **Coda dei salvataggi.** Prima un solo salvataggio fallito, anche per un server spento per pochi secondi, svuotava tutta la coda: le modifiche in attesa sparivano. Nuovo `catalogo/collegamento.mjs`: la coda contiene solo i campi cambiati (scorte, prezzi, stato, merce in arrivo, soglia), il corpo si compone al momento dell'invio dalla versione più recente del prodotto e una modifica esce dalla coda solo dopo la conferma del server. Rete assente, server spento, conflitto 409 o credenziali da correggere: si riprova fino a 30 s di attesa; errore interno 500: fino a 5 volte; dato rifiutato: si scarta solo quella modifica e il prodotto torna ai valori del database, con un solo avviso finale.
- **Ripresa e coerenza.** Dopo un'interruzione la coda rilegge il catalogo prima di inviare, così non cancella ciò che è stato salvato nel frattempo dalla scheda o da un'altra finestra; la scheda «Modifica prodotto» completa prima la coda; una rilettura mantiene i campi in attesa; l'import CSV aspetta che la coda sia vuota; chiudendo la scheda con salvataggi in attesa il browser chiede conferma.
- **Collegamento.** Il caricamento non si arrende più dopo 12 tentativi: riprova senza limite e subito al ritorno della rete o della scheda. Nella pagina Prodotti un avviso fisso indica, con il motivo, catalogo non collegato o modifiche in attesa; un cambio di scorte, prezzi o stato fatto senza catalogo collegato viene segnalato come non salvato.
- **Ponte e server.** Errori del ponte sempre in JSON con un messaggio leggibile (prima pagine HTML che il pannello mostrava come «Richiesta non riuscita (403)»). Con un 401 il token del proprietario viene rinnovato una sola volta. `localhost:4273` viene reindirizzato a `127.0.0.1:4273`, l'unico host accettato dal ponte, conservando la pagina; `.mjs` servito come JavaScript.
- **Finestre.** Dopo «Salva prodotto», «Salva campi» o Esc la finestra restava sullo schermo con «Salvataggio…», perché `.modal` del pannello impone `display:flex`: trovato dalle schermate della prova end-to-end e corretto in `catalogo.css`.

Revisione indipendente con il solo codice: 11 rilievi verificati sul codice e sui bundle, 9 corretti (il più grave: una copia intera del prodotto rimasta in coda poteva riportare indietro descrizione e foto salvate dalla scheda) e rieseguiti sul banco simulato del revisore. Restano documentati: un salvataggio scaduto nel ponte dopo 180 s che si completa in ritardo e due finestre che cambiano gli stessi campi (vale l'ultimo salvataggio), entrambi da chiudere con il controllo di versione del blocco 3. Chi apriva il pannello da `localhost` vede ora i dati dimostrativi del browser salvati per `127.0.0.1`.

Verifiche in `verifiche/affidabilita-salvataggi-2026-11-12.json`: 62 test `node --test`, 8 test del ponte (`verifiche/test_ponte.py`) contro un'API finta, 32/32 scenari end-to-end in Chrome headless con l'API fermata e riavviata e catalogo identico alla fine, 18/18 della prova precedente. Non provati Windows, una rete realmente assente, il database spento con l'API accesa e due schede reali.

## 12 novembre 2026 — Sicurezza e riservatezza (versione modificata da satria64)

Quarta proposta di satria64 (ramo `sicurezza-riservatezza`, sopra `affidabilita-salvataggi`), autorizzata da Reda Zahloul nella issue #1 e in attesa di revisione. Riguarda il backend in `backend/piattaforma/packages/api`, la console di sviluppo e l'import CSV del primo pannello; bundle originali, licenza e avvisi invariati.

- **Costo d'acquisto.** `GET /admin/ishtar/catalogo` lo restituiva con il solo `products:view`, mentre il resto del catalogo lo riserva al permesso `margini`: ora esce solo con `vedeMargini` e sempre dall'offerta (`vista.ts`). Il pannello del proprietario non cambia. La `POST` salva in `metadata.ishtar_v1` solo i campi senza un'altra fonte; nel pannello entrano solo i prodotti con un'offerta di Ishtar Lab, e una scheda malformata non blocca più il catalogo.
- **Negozio online.** In Mercur 2.4.1 `metadata` è tra i campi predefiniti di `GET /store/products`: la scheda Ishtar dei prodotti pubblicati (costo, note interne, fornitore, merce in arrivo, soglie) era leggibile da chiunque. Ora il middleware di `/store/*` toglie `ishtar_v1`; provato dal vivo con un prodotto demo pubblicato per pochi secondi. Nell'import CSV le colonne del prezzo d'acquisto vanno nel campo costo.
- **Dopo l'unione:** eseguire una volta, con il pannello chiuso, da `backend/piattaforma/packages/api`: `npx medusa exec ./src/scripts/pulisci-metadati-ishtar.ts controlla` (conta i prodotti da ripulire), poi lo stesso comando senza `controlla`. Lo script scrive solo la scheda Ishtar; le altre chiavi dei metadati restano.
- **Connettori.** Tag AES-GCM a 16 byte obbligatorio; una credenziale illeggibile appare «da sistemare» invece di bloccare pagina, rinnovo orario e nuovo inserimento.
- **Console di sviluppo.** `/__accesso-locale` richiede host locale e porta della console (prima un sito esterno con un suo nome puntato a 127.0.0.1 riceveva il token del proprietario); la console non si apre dentro pagine di altri siti.
- **Carte regalo.** Con la sola lettura la ricerca guarda solo nome ed email del destinatario, non più il codice.

Revisione indipendente con il solo codice: 5 rilievi sulle correzioni (il più importante: la scheda pubblica nel negozio online) e 2 problemi preesistenti, tutti corretti e riprovati. Restano documentati: qualunque programma locale può chiedere il token della console di sviluppo (non avviarla con `--host`); i campi personalizzati creati a mano restano visibili ai ruoli con `products:view`.

Verifiche in `verifiche/sicurezza-riservatezza-2026-11-12.json`: jest 100/100, 67 test `node --test`, typecheck 0 errori, prove sul database vero e prove end-to-end del pannello 18/18 e 32/32. Non provati Windows, un utente reale senza permesso sui margini e il rinnovo verso un servizio esterno reale.

