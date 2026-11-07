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
