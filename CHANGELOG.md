# Cronologia del recupero

## 2026-11-06 — Conservazione del primo pannello

- Richiesta: salvare nella cartella redx la prima interfaccia mostrata dall'utente, senza modificarne l'origine; precisazione esplicita di non usare la console Multi Outfit.
- Salvati 2.554 file del progetto esistente (138,27 MiB), con SHA-256 dell'origine prima/dopo la copia e della destinazione: zero errori e zero file instabili. Dipendenze e cache escluse sono elencate nel manifest.
- Preparata la copia utilizzabile del primo pannello in `frontend/`: tutti i 32 file identici al salvataggio. Multi Outfit conservato solo nel backup.
- Aggiunti launcher e server Python locale sulla porta 4273, senza dipendenze aggiuntive, per aprire il front-end separatamente dai servizi originali.
- Conservata la foto dell'utente in `verifiche/`. Predisposte istruzioni di continuità e limiti espliciti per dati browser e database, che non sono inclusi automaticamente nella copia dei file.
- Cartella e processi originali lasciati inalterati dall'assistente. Verifiche finali di avvio e navigazione da aggiungere dopo l'esecuzione.

## 2026-11-06 — Verifica finale della copia

- Server locale separato avviato su 127.0.0.1:4273; problema iniziale di connessione dovuto ai permessi dell’ambiente di esecuzione, risolto senza intervenire sull’app originale.
- Browser: Overview con grafico, Ordini e ricerca Yuki (12 risultati), Prodotti e Impostazioni verificati. Ricerca svuotata e ritorno a Overview; nessun ordine o prodotto modificato.
- Confronto HTTP: 32/32 file del front-end identici sia sull’origine 4173 sia sulla copia 4273. Documenti del backup non esposti dal nuovo server (404).
- Controllo preliminare statico del solo front-end: nessun eseguibile nativo o costrutto WebSocket/EventSource/sendBeacon/eval/service worker trovato; non è un audit di sicurezza completo. Rapporti in verifiche/.
- Recupero concluso; prossima sessione: partire da redx/PROJECT.md per decidere eventuali ripristini o modifiche, lasciando intatto il salvataggio storico.

## 2026-11-06 — Estrazione e controllo del backend

- Su richiesta dell’utente estratti 729 file in backend/ dal salvataggio, conservando il workspace di supporto senza sostituire la prima interfaccia. Verifica finale degli hash senza differenze; preservato anche l’indice Git storico dopo l’aggiornamento di metadati effettuato dallo scanner.
- Controllo mirato Codex Security concluso, copertura complessiva parziale e tre rilievi di gravità bassa nel contesto locale: credenziali fisse del seed dimostrativo, validazione destinazione WooCommerce e quoting CR dell’esportatore CSV. Rapporto e limiti collegati da PROJECT.md.
- Nessun blocco di licenza individuato nelle API custom esaminate; controlli di ruolo/tenant conservati. Nessuna garanzia estesa a dipendenze e computer.
- Sintassi: 352 TS/TSX, 25 JS e due launcher senza errori. Prove pure isolate: 32 superate, 1 fallita per nomi incoerenti nel test connettori. Nessun test mutante o servizio originale eseguito.
- Verificato che vecchi launcher e configurazioni riuserebbero porte e dati originali; non eseguiti. Nessuna correzione applicativa o importazione. Prossimo passo: percorsi dati/CSV/brand, mappatura e ambiente separato prima dell’importazione.

## 2026-11-06 — Correzioni, isolamento operativo e marchio Ishtar Lab

- Su autorizzazione dell’utente corretti seed demo, destinazione HTTPS/DNS WooCommerce e quoting CR del CSV; test incoerente riallineato. Revisione indipendente del candidato, corretti ulteriori casi IPv6/HTTP non standard e recupero del proprietario.
- Preparati e avviati servizi Docker e volumi nuovi per Ishtar Lab, DB vuoto con schema e proprietario locale, bucket dedicato e chiavi diverse. Aggiornati porte, comandi e wrapper; arresto basato sull’identità del processo. Vecchi servizi rimasti attivi, nessun dato reale importato.
- Risolto errore del watcher su Windows scegliendo avvio stabile senza watcher backend; testati stop/start e riavvio senza duplicati.
- Applicati al primo pannello nome Ishtar Lab, negozio Ishtar Hub e logo vettoriale IH/stella nel riquadro rosa. Aggiornate icone SVG/PNG/ICO e titolo scheda; conservati namespace dei dati, percorsi tecnici e attribuzioni.
- Verifiche: 80 test unitari, 13 casi CSV, typecheck API, typecheck/build console, 11 controlli pratici servizi; browser con branding confermato dopo reload. Esiti e prossimi passi in PROJECT.md.
- Prossimo passo: dati/CSV/brand dell’utente, mappatura e collegamento del primo pannello alle API reali prima dell’importazione.

## 2026-11-06 — Percorso Ishtar Lab, inventario moda e dati demo autorizzati

- Rinominato il percorso operativo in /ishtar-lab/, con redirect compatibile e aggiornamento dei launcher; rimossa la seconda riga sotto il marchio in sidebar e menu mobile. Verificati pagina prodotti, asset e bookmark. Backup dei file modificati in verifiche/prima-percorso-ishtar-lab.zip.
- Analizzati CSV e immagini forniti in sola lettura: anomalie rendicontate e manifest locale senza leggere i JSON dei workflow. Conservata copia CSV identica alla sorgente.
- Su successiva autorizzazione dell’utente creato inventario-demo.csv con 82 record e 25 campi, marcatori DEMO/bozza e registro delle integrazioni fittizie. SKU-URL sostituiti nella copia, nomi e dati mancanti integrati, foto mancanti con segnaposto; stock e URL foto originali conservati. Verifica indipendente del CSV conclusa.
- Salvato PIANO-INVENTARIO.md: categorie moda, campi specifici e configurabili, selettori colori/taglie, pannello laterale e tab, upload foto, importazione CSV tramite trascinamento e mappatura personalizzabile. Queste funzioni restano da implementare; nessuna importazione DB effettuata.

## 2026-11-07 — Funzioni nel pannello, ripristino UI e launcher BAT

- Collegato il primo pannello alle API isolate e importati 82 articoli demo con offerte/scorte. Aggiunti creazione/modifica prodotto, foto, campi personalizzati e importazione CSV con anteprima e gestione SKU.
- Su correzione dell’utente eliminata la pagina alternativa e ripristinati componenti originali di catalogo, inventario e dashboard. Conservato il CSS base, integrati i pulsanti nella testata e adattati gli strumenti ai dialog glass originali.
- Ripopolati i moduli dimostrativi del browser, riparati i riferimenti prodotto ed eliminati gli errori di caricamento che lasciavano pagine vuote. Nessun database originale toccato. Regole di conservazione in .ai-style-rules.md.
- Verificate 28 pagine, creazione/foto/campo personalizzato persistenti, conteggio stock e reimportazione senza duplicati. Cinque test CSV e typecheck API superati; rapporti in verifiche/. Prodotto QA rimosso e catalogo finale a 82.
- Creato Avvia Ishtar Lab.bat con avvio dei servizi e apertura della home; il vecchio CMD rimanda al BAT. Prova con --no-browser conclusa con codice 0. Limiti e istruzioni in PROJECT.md.

## 2026-11-07 — Licenza personalizzata e piani in Obsidian

- Predisposti LICENSE.md, perimetro, avvisi terzi, guida contributi e scheda titolare: uso personale per i destinatari, nome conservato e sorgenti modificati al titolare entro 30 giorni. Bozza non distribuita; identità/recapito e diritti del frontend da finalizzare. Nessun blocco o controllo tecnico aggiunto.
- Riscontrato il copyright del frontend recuperato e la mancanza del testo richiamato; non confermato alcun prezzo. Conservati avvisi e manifest MIT; documentata licenza mista MIT/Enterprise di Medusa 2.22.3 con fonti versionate.
- Creato piani di implementazione come vault Obsidian, aperto e indice verificato: 27 note, 12 categorie, 107 attività con priorità/prove, architettura, usi, limiti e roadmap. Distinti dati reali del catalogo da altri moduli demo e codice backend non integrato.
- Controllati link interni, JSON/Canvas, ID, copie della licenza e hash dei file applicativi invariati. Nessuna modifica a interfaccia, database o progetto originale.

## 2026-11-07 — Titolare e canale per le modifiche

- Ricevuti dall'utente nome Reda Zahloul ed email ralreda54@gmail.com; compilati testo di licenza, credito, scheda titolare e istruzioni di restituzione, mantenendo identiche le copie Obsidian.
- Aggiornati stato e backlog: dati del titolare presenti, accettazione destinatari e perimetro terzi ancora aperti. Nessun invio email o distribuzione.


## 2026-11-07 — Preparazione consegna GitHub privata

- Su istruzione del titolare aggiornata licenza 1.1 con permesso scritto preventivo per modifiche e accordo separato per uso commerciale; schema non firmato e vault allineati.
- Creato repository privato reda10nafil/ishtar-lab e copia pulita app+vault, esclusi segreti/dati privati/archivi/dipendenze. Aggiunti guida collaboratore e setup Windows; solo nella consegna digest RustFS portabile e CSV demo anonimizzato.
- Controllo prerequisiti e sintassi del setup, cinque test CSV e scansione contro i valori segreti della configurazione senza riscontri. Bootstrap a macchina pulita non eseguito. Push/release da confermare con rapporto finale; username collaboratore non ancora disponibile.


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

## 2026-11-12 — Revisione GitHub e correzione dello stato dell'audit

- Confrontati i file operativi pubblicabili con la copia Git di consegna e verificato il ramo remoto main: nessuna nuova modifica applicativa rispetto all'8 novembre.
- Conservati dataset demo anonimizzato, digest RustFS portabile e percorso CSV della consegna; nessun dato privato, database, dipendenza o archivio storico aggiunto.
- Inclusa la nota di stato del tentativo di audit dell'8 novembre: errore del plugin prima della creazione della scansione, nessuna analisi eseguita. Rettificata l'indicazione storica «attivo», senza inventare risultati o applicare correzioni.
- Aggiornate memoria e note del vault su GitHub, sicurezza e backlog; nessuna attività di prodotto dichiarata completata. Sette test CSV/identità superati nella copia di consegna.
- Revisione limitata alla documentazione del ramo principale; pacchetto applicativo dell'8 novembre e relativo manifest conservati. Esito della pubblicazione e commit nel rapporto locale `verifiche/aggiornamento-github-2026-11-12.json`.

## 2026-11-12 — Consegna della seconda applicazione e guida backend

- Su richiesta dell'utente copiata la seconda app Ishtar Lab/Multi Outfit in versione 2: 685 file sorgenti identici con hash, senza segreti, DB, dipendenze o build. Originale non modificato né avviato/arrestato.
- Aggiunti memoria, istruzioni e modelli di configurazione non operativi. Preservati manifest/licenze upstream; nessuna fusione con il backend della prima app.
- Preparati inventari delle due basi (98/149 file route) e tre guide nel vault: passaggio tecnico, origine/differenze e segnalazioni ricevute. Chiarito API su Node host, servizi dati in Docker, limiti Linux e rischio di configurazione parziale. Nessuna nuova funzione o correzione dichiarata.
- Aggiornati indice, istruzioni, README e riferimenti della roadmap. Conversazione e fotografie private escluse; 84 problemi segnalati esternamente non convertiti in rilievi autonomamente confermati.
- Pubblicazione, controlli e pacchetto della consegna tracciati nel rapporto locale verifiche/consegna-versione2-2026-11-12.json. Nessun invito o invio di credenziali al collaboratore.

## 2026-11-12 — Avvio su Linux (versione modificata da satria64, proposta)

- Permesso scritto di Reda Zahloul nella issue #1 (12 novembre 2026) per correggere i problemi individuati e proporli con pull request da un fork; licenza, titolarità e avvisi dei terzi invariati.
- Corretto il riferimento RustFS della consegna: `sha256:d30c5e04…` era l'ID locale dell'immagine (Docker Hub 404) e fermava al pull ogni preparazione nuova. Ora `rustfs/rustfs:1.0.5@sha256:b81d16a9…`, build del 10/11/2026 diversa dall'immagine locale del titolare. Aggiornato anche `tools/prepara-consegna.py`, che include ora i launcher .sh e il nuovo rapporto.
- Runtime portabile con `backend/infra/processi.mjs` (`/proc` su Linux, `ps` su macOS, PowerShell invariato su Windows). Arresto ordinato con SIGTERM al gruppo e SIGKILL dopo 15 s; stato conservato se l'arresto fallisce; avviso se un processo non riconosciuto risponde sulla 9273; uscita anticipata se l'API termina durante l'avvio; corretti i messaggi con doppia codifica UTF-8.
- Nuovi `prepara-ishtar-lab.sh`, `avvia-ishtar-lab.sh`, `ferma-ishtar-lab.sh` e `tools/ferma-ishtar-lab.mjs`. `apri-ishtar-lab.mjs` usa python3 fuori da Windows, controlla la configurazione, registra il PID del pannello, lo riusa se già attivo e apre il browser con xdg-open/open. Su Windows resta una sola chiamata a docker info e l'uscita del pannello resta scartata come prima.
- Preparazione riprendibile (`backend/.runtime/preparazione.json`, `--riprendi`) e protetta: indicazioni se manca un solo .env, rifiuto se esistono volumi di un'altra copia. Chiavi conservate dal file che le contiene, password dei servizi ricavate dagli URL, credenziali del proprietario mai sovrascritte, permessi 600 e copie `.env.*` dei file modificati.
- README, GUIDA-COLLABORATORE, backend/README e note del vault aggiornati per Linux; rapporto `verifiche/avvio-linux-2026-11-12.json`. Prove su Ubuntu 26.04: preparazione a macchina pulita, avvio/arresto/riavvio, import demo, foto con RustFS 1.0.5, test 7 + 13 + 80 e typecheck API. Non provati Windows dopo la modifica e macOS.

## 2026-11-12 — Dati demo e import CSV (versione modificata da satria64, proposta)

- Le azioni dimostrative (cassa, nuovi ordini anche dal menu globale, bozze convertite, resi ricevuti) non modificano più le scorte reali: `catalogo/sincronizza.mjs` scrive solo le modifiche della pagina Prodotti che non toccano ordini, resi o bozze e ripristina le altre nello stato demo con un avviso.
- Import CSV «Aggiorna» conservativo con `catalogo/importa.mjs`: cambiano solo le celle piene; stato, foto, descrizione e campi restano; catalogo riletto prima dell'anteprima; colonna «Modifiche»; righe invariate non riscritte; aggiornamento possibile anche senza colonna categoria.
- `numberCSV` riconosce le migliaia («1.200» = 1200, «1,200.50» = 1200,5), mantiene la virgola decimale italiana, distingue la cella vuota dallo zero e rifiuta 1e3/0x10.
- Dopo la revisione indipendente: convenzione numerica per colonna con avviso dei valori ambigui, celle di soli simboli rifiutate, valori già salvati non riconvertiti, URL foto in copertina (più URL, massimo 30), genere/Sì-No/scelte/date convertiti, CSV Windows-1252, «Pour» della Home salvato, coda dei salvataggi attesa prima di rileggere il catalogo.
- Verifiche: 46 test node, 18/18 scenari end-to-end in Chrome con i bundle reali (8/15 sul codice precedente), test backend e typecheck invariati. Rapporto `verifiche/correzioni-dati-csv-2026-11-12.json`.

## 2026-11-12 — Affidabilità dei salvataggi (versione modificata da satria64, proposta)

- Con il server momentaneamente spento le modifiche non vanno più perse: prima il primo salvataggio fallito svuotava l'intera coda. Ora la coda (`catalogo/collegamento.mjs`) contiene solo i campi cambiati, compone il corpo dalla versione più recente del prodotto e toglie una modifica solo dopo la conferma del server. Rete assente, server spento, conflitto 409 o credenziali da correggere: si riprova con attesa crescente fino a 30 s; errore interno 500: fino a 5 volte. Un dato rifiutato scarta solo quella modifica e riporta il prodotto ai valori del database.
- Caricamento del catalogo senza limite di tentativi (prima si fermava dopo 12, circa due minuti), con nuovo tentativo immediato al ritorno della rete o della scheda. Avviso fisso nella pagina Prodotti con il motivo, finché il catalogo non è collegato o ci sono modifiche in attesa; avviso se si cambiano scorte, prezzi o stato senza catalogo collegato; un solo avviso finale per ogni giro di salvataggi.
- Dopo un'interruzione la coda rilegge il catalogo prima di inviare; la scheda «Modifica prodotto» completa prima la coda; import CSV rifiutato finché la coda non è vuota; conferma del browser se si chiude la scheda con salvataggi in attesa. Le finestre del catalogo chiuse dopo un salvataggio o con Esc non restano più sullo schermo.
- Ponte: errori sempre in JSON con un messaggio leggibile, anche con testi del backend non codificabili; token del proprietario rinnovato una sola volta se l'API lo rifiuta (prima restava in uso fino a 30 minuti). Server: `localhost:4273` reindirizzato a `127.0.0.1:4273`, l'unico host accettato dal ponte; `.mjs` servito come JavaScript come `.js`.
- Revisione indipendente: 11 rilievi verificati; corretti 9, tra cui una copia vecchia in coda che poteva riportare indietro la descrizione salvata dalla scheda. Gli altri due sono documentati e rimandati al salvataggio atomico (blocco 3). Verifiche: 62 test node, 8 test del ponte, 32/32 scenari end-to-end con API fermata e riavviata, 18/18 della prova precedente. Rapporto `verifiche/affidabilita-salvataggi-2026-11-12.json`.

## 2026-11-12 — Sicurezza e riservatezza (versione modificata da satria64, proposta)

- Costo d'acquisto: `GET /admin/ishtar/catalogo` lo restituiva a chiunque avesse `products:view`; ora esce solo con il permesso sui margini e sempre dall'offerta. La `POST` copiava tutta la scheda, costo compreso, in `metadata.ishtar_v1`: ora salva solo i campi senza un'altra fonte. Script `src/scripts/pulisci-metadati-ishtar.ts` per i prodotti già salvati, da eseguire una volta.
- Negozio online: in Mercur `metadata` è tra i campi predefiniti di `GET /store/products`, quindi la scheda Ishtar (costo, note interne, fornitore, merce in arrivo) era pubblica per i prodotti pubblicati. Ora `/store/*` toglie `ishtar_v1`; le colonne CSV del prezzo d'acquisto vanno nel campo costo, protetto.
- Connettori: controllo di integrità AES-GCM a 16 byte obbligatorio (prima bastavano 4 byte); una credenziale illeggibile non blocca più la pagina, il rinnovo orario degli accessi e il nuovo inserimento; una `CONNECTORS_KEY` scritta male resta un errore di configurazione.
- Console di sviluppo: `/__accesso-locale` consegnava il token del proprietario anche a un sito esterno tramite DNS rebinding; ora servono host locale e porta della console, e la console non si apre dentro pagine di altri siti.
- Carte regalo: con la sola lettura la ricerca non guarda più il codice, che si poteva ricostruire un carattere alla volta.
- Verifiche: jest 100/100, 67 test node, typecheck 0 errori, prove sul database vero (negozio, pulizia, carte, connettori, console) e prove end-to-end 18/18 e 32/32. Revisione indipendente: 5 rilievi e 2 problemi preesistenti, corretti. Rapporto `verifiche/sicurezza-riservatezza-2026-11-12.json`.

## 2026-11-12 — Salvataggi atomici, blocco 3 parte A (versione modificata da satria64, proposta)

- Salvataggio «tutto o niente»: creazione e modifica dal pannello diventano due workflow unici (`src/workflows/catalogo/salvataggio-prodotto.ts`) invece di tre o quattro run separati. Un errore a metà non lascia più prodotti senza scheda Ishtar (invisibili e con lo SKU occupato) né prezzo nuovo con scorte vecchie. Un passo dedicato rimette il prodotto com'era, perché la compensazione di Medusa non ripristina metadati e categorie. `creaProdotto` è condivisa con console e portale aziende.
- Esito distinto fra «annullato» e «a metà», con il falso «failed» dei workflow annidati riconosciuto; lucchetto Redis per prodotto e per SKU, anche per il primo deposito di un'azienda.
- Campi personalizzati obbligatori aggiunti dopo: richiesti alla creazione, entrando nella categoria del campo o svuotando un valore; non bloccano più scorte, prezzo e stato dei prodotti esistenti (server, import CSV e scheda).
- Stato, categoria, materiale e genere letti dai campi nativi: il pannello non annulla più le modifiche della console; la scheda conserva un genere della console fuori elenco.
- Scorte scritte solo se cambiano, livello di magazzino creato nello stesso salvataggio, errore esplicito con più depositi o senza voce di magazzino; offerta aggiornata solo per ciò che cambia, nessun prezzo di 0 € al posto di uno assente.
- La scheda prodotto conserva i valori che non sa mostrare (scelta tolta dall'elenco, colore mai scelto, numero non valido, genere vuoto); uno SKU già usato da una voce di magazzino viene rifiutato prima di creare.
- Revisione avversariale (4 revisori e 4 verificatori): 31 rilievi confermati; corretti quelli di questa parte, compreso il ripristino di metadati e categorie dopo un annullamento. Verifiche: jest 131/131, 69 test node, typecheck 0 errori, guasti provocati sul database vero, prove end-to-end 18/18, 32/32 e 8/8, catalogo identico a quello di partenza. Restano alla parte B conflitti, movimenti di scorte, in arrivo e riordino. Rapporto `verifiche/salvataggi-atomici-2026-11-12.json`.

## 2026-11-13 — Conflitti e movimenti di scorte, blocco 3 parte B (versione modificata da satria64, proposta)

- Copia vecchia del pannello: il salvataggio invia solo i campi cambiati, ciascuno con il valore da cui è partito (`POST /admin/ishtar/catalogo` con `{modifica}`). Se intanto il valore è cambiato altrove, la modifica non si salva (412), il pannello mostra il valore attuale e ricarica il catalogo. Una scheda intera con id, da una finestra con il codice di prima, riceve l'invito a ricaricare la pagina.
- Scorte: +/−, «Ricevi» e «Ordina»/«Pour» diventano variazioni con un id, sommate a quelle del server sotto il lucchetto della voce di magazzino (lo stesso di evasioni e resi) e non contate due volte se il pannello le rimanda; la quantità della scheda e del CSV è un conteggio valido solo se le scorte sono ancora quelle lette. Ogni variazione va nello storico del Magazzino, firmata con l'email; un doppio «Ricevi» non carica la merce due volte; con più depositi le scorte sono bloccate nel pannello.
- «In arrivo» e «Riordino» diventano le unità in arrivo del livello di magazzino e la soglia di sicurezza del Magazzino; `src/scripts/pulisci-metadati-ishtar.ts` sposta i valori vecchi dalla scheda (da eseguire una volta dopo l'unione).
- Nell'offerta si scrive solo ciò che cambia (dei metadati solo il costo); al cambio di categoria restano le categorie della console fuori dal catalogo Ishtar; giacenza negativa lasciata da un'evasione gestita; configurazione dei campi salvata solo se è ancora quella di partenza.
- Pannello: un rifiuto toglie dalla coda solo la parte rifiutata (il resto riparte con gli stessi id), l'«Undo» degli avvisi resta collegato dopo un riallineamento, il campo prezzo del dettaglio si allinea al prezzo nuovo.
- Revisione avversariale (4 revisori e 4 verificatori): 22 rilievi confermati (18 distinti), corretti o motivati. Verifiche: jest 190/190, 80 test node, typecheck 0 errori, prove sul database vero (guasto provocato, concorrenza con le evasioni, secondo deposito, giacenza negativa, migrazione), prove end-to-end 18/18, 32/32, 8/8 e 20/20 con due finestre vere; database ripristinato dal backup alla fine. Rapporto `verifiche/conflitti-movimenti-2026-11-13.json`.

## 2026-11-13 — Proposte di satria64 unite nel main

- Le PR dalla #2 alla #7 sono unite nel main in ordine, con «Create a merge commit» (ultimo commit 25415d6), dopo che il titolare ha dato a satria64 l'accesso in scrittura.

## 2026-11-13 — Scorte della console e del Magazzino delle aziende (versione modificata da satria64, PR #8)

- Finestra varianti della console: si scrive solo ciò che è cambiato, ciascun campo con il valore da cui la finestra si è aperta; un valore cambiato intanto altrove non viene riscritto (412 con il valore attuale e l'azienda). La quantità è un conteggio sotto il lucchetto della voce di magazzino, firmato nello storico del Magazzino; variante, prezzi e scorte vanno in un solo workflow con il lucchetto del prodotto, lo stesso del pannello. Una giacenza sotto zero non blocca più la finestra.
- Magazzino delle aziende: «Change» è una variazione con un id, sommata sotto il lucchetto e mai contata due volte; «New quantity» e il conteggio valgono solo se la giacenza è ancora quella mostrata. Il conteggio è «tutto o niente» in un solo workflow: una riga cambiata mentre si contava perde il numero contato e resta segnata da ricontare.
- Con un conflitto le finestre restano aperte con il valore attuale nel campo cambiato e il resto conservato. Uno SKU o un EAN già usato dà di nuovo il messaggio di Medusa; un salvataggio rimasto a metà lo dice e nel log elenca le voci da sistemare.
- Primo deposito di un'azienda sotto il suo lucchetto; proposte di prezzo e prezzi delle aziende scrivono nell'offerta solo le chiavi che cambiano.
- Revisione avversariale (4 revisori e 4 verificatori): 19 rilievi confermati (12 distinti), 11 corretti, 1 rimandato con motivo (le schede prodotto della console mandano ancora tutti i valori: difetto che c'era già). Verifiche: jest 233/233, 80 test node, typecheck di API e console 0 errori, 30/30 prove con le rotte vere, prove end-to-end nella console 6/6 e 7/7, pannello 18/18, 32/32, 8/8 e 20/20; database ripristinato dal backup. Rapporto `verifiche/scorte-console-magazzino-2026-11-13.json`.
