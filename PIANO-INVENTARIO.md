# Ishtar Lab — piano del catalogo e dell’inventario

## Stato implementato e verificato — 7 novembre 2026

Questo aggiornamento sostituisce lo stato “da implementare” delle sezioni storiche sotto. Gli 82 prodotti demo sono nel database Ishtar Lab, con offerte/prezzi/scorte native. Funzionano creazione/modifica, caricamento foto nel bucket, campi personalizzati persistenti e importatore CSV con anteprima, mappatura e controllo degli SKU. Il trascinamento apre lo stesso importatore nell’area catalogo; verificato il selettore file e il percorso completo di importazione, non il trascinamento fisico da Esplora file.

Su correzione esplicita dell’utente sono stati ripristinati i componenti originali di dashboard, catalogo e inventario. I pulsanti CSV/campi si integrano nella testata esistente; nessuna nuova griglia o grande area di upload sostitutiva. Gli strumenti usano i token e il vetro originali. Le 28 pagine principali si aprono; le altre sezioni sono ripopolate con dati dimostrativi coerenti nel browser, non integrate con il backend ordini/clienti.

Restano evoluzioni: più varianti nella stessa scheda prodotto, lotti transazionali annullabili, download controllato delle immagini remote e associazione assistita dei materiali locali, integrazione reale degli altri moduli. Il caricamento locale foto è verificato; un URL foto esterno viene conservato come URL, non scaricato automaticamente nel bucket. Dettagli e prove in PROJECT.md e verifiche/.

Aggiornato il 6 novembre 2026. Specifica preparata sulla richiesta dell’utente, sull’analisi del CSV e dei materiali locali e sulle fonti ufficiali elencate sotto. Le funzioni di questo piano sono **da implementare**, salvo quelle indicate come già verificate. Non costituisce un’importazione effettuata.

Aggiornamento successivo della richiesta: l’utente autorizza dati fittizi per completare il catalogo e ribadisce **trascinamento del CSV e personalizzazione dei campi**. Preparata e verificata una copia in `outputs/ishtar-catalogo-20261106/inventario-demo.csv`: 82 record, 25 colonne, tutti marcati DEMO e bozza. Dati sintetici e trasformazioni sono elencati per record in `provenienza-demo.json`; sorgente invariata. I vincoli di non inventare dati descritti sotto valgono per una futura importazione reale; la copia dimostrativa usa invece i valori sintetici esplicitamente autorizzati.

Per la copia demo sono stati aggiunti identificatori al posto dei 52 SKU-URL, nomi per i 22 prodotti senza nome, descrizioni, categorie proposte, colori, taglie mancanti, materiali dimostrativi, fornitori, valuta EUR e codici a barre interni DEMO (non GTIN commerciali). Prezzi vendita zero e costi zero sono integrati **solo nella demo** con valori sintetici coerenti; non sono valutazioni di mercato. Le 76 giacenze zero sono conservate. I link foto originali restano; dove mancano, un segnaposto locale dichiara “Foto da associare”. I link prodotto fittizi usano example.invalid e non sono siti reali.

## Risultato richiesto

Conservare il design del primo pannello e trasformare la pagina prodotti in un catalogo per abbigliamento uomo/donna, pellicce, borse, scarpe e accessori. Caricamento singolo rapido, importazione di inventari, foto per prodotto/variante, campi configurabili e giacenze reali. Non usare la console Multi Outfit come interfaccia sostitutiva.

Già applicato: indirizzo `/ishtar-lab/`, aggiornamento dei launcher, rimozione del sottotitolo sotto Ishtar Lab. La vecchia URL reindirizza alla nuova conservando la pagina dopo `#`; i dati del browser mantengono lo stesso spazio di salvataggio. Il catalogo delle candele è ancora il contenuto dimostrativo recuperato: non va rinominato o riclassificato fingendo che siano prodotti dell’utente.

## Materiali verificati e problemi da gestire

Fonte CSV: `C:/Users/reda_/Desktop/inventario_2026-06-21.csv`. Copia locale identica in `dati/sorgenti/`; dettagli riproducibili in `dati/analisi-2026-11-06/inventario-analisi.json`.

- 82 record, 12 colonne, UTF-8 e separatore virgola. 82 valori SKU diversi, senza duplicati esatti nel file.
- 52 record hanno un URL sia in SKU sia in Link Foto: sono URL di immagini, non codici prodotto affidabili. Non esiste una colonna separata per il link della pagina prodotto.
- 52 categorie assenti; 22 record con nome “Senza Nome”; descrizioni e taglie presenti soltanto in 8 record. Codice a barre e fornitore sempre vuoti.
- 22 prezzi di vendita, 52 costi e 76 quantità hanno valore esplicito zero. Gli zero non vanno sostituiti con valori inventati; per i dati incompleti serve uno stato “da verificare”. Il file di giugno non dimostra le scorte attuali.
- Categorie valorizzate: Scarpe 1, Borse 2, Accessori 3, Abbigliamento 2; visone 7, volpe 5, zibellino 3, cincilla 3, ermellino 2, astrakan 2. Le ultime sei sono tipi di materiale/pelliccia da separare dalla categoria commerciale.

Fonte immagini: `C:/Users/reda_/Desktop/Gemini/Workflow Agent E-commerce/media-runs/`.

- 39 immagini PNG/JPG, tutte leggibili; 16 contenuti distinti per hash. Non equivalgono a 39 prodotti: più workflow riutilizzano lo stesso input.
- 13 file sono denominati output e 26 input. È una classificazione dei nomi, non una certificazione del contenuto o dell’associazione a SKU.
- Visionati due output rappresentativi: una borsa con chiave e una tavola a sei viste di una borsa viola con rivestimento in pelo. Il nome della cartella “pelliccia” non basta quindi per classificare il prodotto come cappotto.
- Manifest con dimensioni, hash e percorsi relativi in `dati/analisi-2026-11-06/immagini-manifest.json`. I 72 JSON dei workflow non sono stati letti né pubblicati. Originali immutati; nessun caricamento su servizi esterni.
- I link remoti del CSV sono stati analizzati come testo; raggiungibilità e corrispondenza a prodotti reali non ancora verificate.

## Categorie e campi per il tuo catalogo

Categorie principali modificabili: **Pellicce, Abiti, Parte sopra, Parte sotto, Completi, Borse, Scarpe, Accessori**. “Uomo / Donna / Unisex” è un campo separato e un filtro trasversale, per evitare categorie duplicate. Il valore può restare non specificato in una bozza; non dedurlo da foto o nomi.

| Categoria | Sottotipi iniziali suggeriti | Campi specifici configurabili |
|---|---|---|
| Pellicce | Cappotto, giacca, gilet, mantella | Materiale dichiarato; naturale/sintetico/non specificato; tipo (visone, volpe, ecc.); lunghezza; spalle, torace, manica; fodera; cappuccio/collo; chiusura; lavorazione |
| Abiti | Corto, midi, lungo, tuta intera | Busto, vita, fianchi, lunghezza; scollo; maniche; chiusura; vestibilità |
| Parte sopra | Camicia, blusa, maglia, felpa, giacca, top | Spalle, torace, lunghezza, manica; scollo; chiusura; composizione e vestibilità |
| Parte sotto | Pantalone, jeans, gonna, shorts | Vita, fianchi, cavallo, interno gamba, lunghezza; taglio; vestibilità |
| Completi | Giacca/pantalone, giacca/gonna, coordinato | Numero e nomi dei pezzi; taglie anche diverse per pezzo; componenti collegati; vendita insieme o separata |
| Borse | A mano, a spalla, tracolla, tote, zaino, pochette | Larghezza/altezza/profondità in cm; manico e tracolla; chiusura; tasche; esterno/fodera; finiture metalliche |
| Scarpe | Sneakers, stivali, décolleté, mocassini, sandali | Numero e sistema taglie; lunghezza piede se dichiarata; calzata; tacco e plateau in cm; tomaia, fodera, suola; chiusura |
| Accessori | Cintura, portafoglio, portamonete, cappello, sciarpa, occhiali, tracolla | Campi variabili per sottotipo: misura/regolabilità, larghezza, lunghezza, circonferenza, dimensioni, materiale, finitura |

Per un capo con più materiali conservare composizione e percentuali quando fornite, senza attribuirle dalle immagini. “Pelliccia” come rivestimento di una borsa resta un materiale della categoria Borse.

Campi comuni: identificatore interno; SKU; nome; categoria/sottotipo; brand; genere di destinazione; descrizione; stato (bozza, da verificare, attivo, archiviato); collezione/stagione; materiali; colori; taglie; prezzo, valuta e costo; fornitore; codice a barre facoltativo; foto e link prodotto/origine; note operative. Prezzo, costo e valuta restano distinti; l’attuale GBP della demo non determina la valuta dei dati reali.

Prodotto e variante sono livelli diversi. Il modello contiene i dati comuni; ogni combinazione realmente venduta di taglia/colore/materiale ha identità e SKU propri, foto e giacenza. Non creare automaticamente tutte le combinazioni teoriche. Conservare taglia originale e sistema IT/EU/UK/US/alfabetico; non convertire numeri senza tabella dichiarata dal fornitore.

Per i completi: un articolo venduto e contato come set ha una giacenza di set; un insieme composto da articoli venduti separatamente deriva la disponibilità dai componenti. Evitare conteggio doppio. Gli outfit suggeriti possono essere raggruppamenti editoriali senza una seconda giacenza; questa opzione non è un prerequisito per importare i singoli prodotti.

## Scheda prodotto veloce e campi personalizzabili

Su desktop aprire un **pannello laterale destro con scorrimento verticale**, mantenendo visibile il catalogo. Su schermo piccolo usare una scheda a tutta larghezza. Sezioni a tab: **Dettagli, Varianti, Foto, Scorte e prezzi, Campi personalizzati**. Comandi Salva bozza / Salva e successivo sempre raggiungibili; segnalare modifiche non salvate senza perdere la compilazione passando tra tab.

Colori in un pop-up compatto: ricerca per nome, campioni con etichetta, preferiti, selezione di più colori, aggiunta di un nome personalizzato e codice colore facoltativo. Non limitarsi al solo campione visivo: tastiera e nomi leggibili. L’elenco colori è riutilizzabile, ma cambiare il nome visualizzato non cambia l’identità delle varianti.

Taglie, materiali e categorie con ricerca e selezione rapida. Misure con unità esplicita; tabella delle varianti per modificare più scorte/prezzi insieme. Mostrare solo i campi pertinenti alla categoria e rendere visibili gli errori anche nelle tab non aperte. La galleria permette foto principale, riordino, didascalia/testo alternativo e assegnazione a una variante.

Gestore “Personalizza campi”: aggiungere, rinominare, riordinare, nascondere o archiviare un campo; scegliere tipo testo, numero con unità, data, sì/no, scelta singola/multipla, colore, URL, riferimento o allegato; impostare categorie applicabili, gruppo/tab, obbligatorietà e valori iniziali. Identificatore tecnico stabile separato dall’etichetta. Archiviare una definizione preserva i valori storici; cambiare tipo richiede una migrazione con anteprima. Conservare anche colonne CSV non riconosciute proponendo un campo personalizzato, invece di scartarle.

Campi di catalogo e contabilità devono avere visibilità configurabile: costo, fornitore e note interne non diventano pubblici per errore. Le regole di validazione proteggono i dati senza imporre campi non pertinenti per salvare una bozza.

## Importazione e aggiornamenti dell’inventario

Pulsante “Importa inventario” nella pagina Prodotti e area **trascina qui il CSV**, con selettore file equivalente per tastiera e dispositivi mobili. Il trascinamento deve aprire l’anteprima senza scrivere subito sul DB. Flusso: selezione/trascinamento CSV → riconoscimento colonne → anteprima e problemi → scelta dei record → esecuzione con avanzamento e riepilogo. Supportare virgola/punto e virgola, virgolette, righe con ritorni a capo e BOM. Salvare un profilo di mappatura per riutilizzare i file successivi dello stesso fornitore. Durante la mappatura, ogni colonna nuova può diventare un campo personalizzato con tipo e categoria scelti dall’utente.

| Colonna ricevuta | Destinazione proposta | Trattamento |
|---|---|---|
| SKU | SKU variante o identificatore originale | 52 URL restano come origine grezza; assegnare nuovi codici interni stabili con una mappa persistente. Non usare l’URL foto come chiave unica definitiva. |
| Nome | Nome prodotto | Le 22 righe “Senza Nome” restano da verificare. |
| Descrizione | Descrizione | Conservare vuoto se assente; non produrre caratteristiche tecniche inventate. |
| Prezzo Vendita | Prezzo variante | Valuta e trattamento fiscale da configurare; non leggere il valore come GBP perché lo è la demo. |
| Costo Acquisto | Costo interno | Separato da prezzo pubblico; conservare zero e segnalare eventuale incompletezza. |
| Quantita Stock | Giacenza iniziale per variante e ubicazione | Aggiornamento come valore assoluto solo nel profilo scelto; non sommare ogni reimportazione. |
| Categoria | Categoria + attributo materiale quando pertinente | Proposta per i 22 tipi di pelliccia; quelle assenti restano da classificare. Abbigliamento richiede un sottotipo. |
| Taglia/Variante | Valore originale e opzioni normalizzate | Preservare il testo e non inventare taglie/varianti mancanti. |
| Link Foto | Origine immagine | Importazione e associazione con esito per immagine; non usarlo come link pagina prodotto. |
| Codice a Barre | Barcode/EAN/GTIN opzionale | Trattare come testo preservando zeri iniziali; non generarne uno falso. |
| Fornitore | Fornitore | Può restare vuoto; successivamente selezionabile e riutilizzabile. |
| Note | Note interne | Conservare integralmente, con eventuali proposte di estrazione separate e verificabili. |

Anteprima: nuovi/aggiornati/ignorati/conflitti, campi mancanti, valori non validi e foto non raggiungibili, tutti riferiti al record sorgente. Predefinire “aggiungi nuovi” senza cancellazioni automatiche. Modalità aggiornamento con chiave e campi scelti esplicitamente; una cella vuota non cancella un dato esistente salvo scelta nel profilo.

Una seconda importazione dello stesso lotto non deve duplicare prodotti né sommare scorte. Registrare lotto, hash fonte, mappatura, identificativi assegnati ed esiti. Scrittura a blocchi riprendibile con annullamento; annullare un lotto senza sovrascrivere modifiche successive indipendenti. Gestire errori per riga e ripetere solo gli elementi falliti. Nessuna pubblicazione verso siti o marketplace implicita nell’importazione.

Prima prova: pochi record rappresentativi, includendo una variante scarpa, una borsa, un materiale pelliccia e una riga con SKU-URL. L’interfaccia permette di risolvere le ambiguità prima del caricamento completo; dati incompleti possono entrare come bozze se il profilo lo prevede.

## Foto locali e da URL

Caricamento multiplo con selettore o trascinamento e libreria immagini. Importazione da cartella con anteprima; associazione prima per SKU/identificatore esplicito, poi proposta per nome con verifica. Non associare in automatico la borsa viola a una pelliccia solo per il nome della cartella. Un collage a sei viste è un singolo file: non promettere sei foto separate; suddivisione eventuale è una funzione distinta.

Deduplicare gli stessi byte, mantenendo più associazioni quando necessarie. Distinguere input di lavoro, output e immagine effettivamente scelta per il catalogo. Originali conservati; copie di utilizzo nel bucket dedicato Ishtar Lab e miniature generate senza alterare la sorgente. Materiali creativi non equivalgono a prova di esistenza, materiale o disponibilità di una variante.

Per URL remoti: download controllato con verifica DNS/IP a ogni destinazione, HTTPS, redirect rivalidati, limiti di dimensione e timeout, verifica del tipo reale e decodifica dell’immagine. Conservare la query di versione nei link forniti. Riutilizzare i controlli di rete esistenti, predisponendo un trasporto specifico per immagini invece del limite JSON di 1 MiB del test connettori. Errori di foto non devono trasformarsi in prodotti duplicati.

## Ordine di implementazione e prove di accettazione

| Passo | Lavoro concreto | Quando è verificato |
|---|---|---|
| 0 — concluso | Percorso Ishtar Lab, sottotitolo, analisi sorgenti e piano | Nuova URL e vecchi bookmark funzionano; nessun reset dei dati browser. |
| 1 — prossimo | Modello categorie/campi/varianti e collegamento del primo pannello alle API 9273 | Creazione/modifica di un prodotto reale, ricarica pagina e dati persistiti nel DB isolato. Stato vuoto reale distinto dalla demo. |
| 2 | Pannello laterale, tab, selettori e gestore dei campi | Un campo personalizzato viene aggiunto a una sola categoria, riordinato e compilato; valore e definizione restano dopo il riavvio. Flusso utilizzabile con tastiera. |
| 3 | Upload foto e libreria collegata al bucket | Foto locale e URL associati al prodotto/variante, riordinati e visibili dopo ricarica; errori recuperabili e originali invariati. |
| 4 | Importatore CSV con anteprima, mappatura e lotti | Campione controllato, poi file completo; ripetizione senza duplicati, stock invariato al secondo passaggio, anomalie rendicontate. |
| 5 | Operazioni quotidiane | Filtri categoria/genere/taglia/colore, ricerca SKU/barcode, modifica multipla, esportazione corretta e cronologia movimenti stock. Prove su casi dell’utente. |

Prerequisiti tecnici: il primo frontend recuperato è compilato; introdurre componenti modificabili conservandone stile e comportamento, invece di ampliare indefinitamente modifiche al bundle. Riutilizzare moduli Medusa per prodotti/opzioni/varianti/inventario/file e permessi; verificare i modelli personalizzati esistenti prima di aggiungere tabelle. Per campi estensibili prevedere definizioni validate e valori versionati; evitare campi arbitrari non validati e valori contabili dispersi in note.

Prove specifiche richieste: trascinare il CSV demo sul bersaglio, vedere 82 righe nell’anteprima e nessuna modifica prima di “Importa”; poter ottenere lo stesso risultato dal selettore file; aggiungere una colonna sconosciuta e creare il relativo campo dal mapping; salvare/riaprire i valori personalizzati e usare il pop-up colori. Le funzioni devono essere reali e persistenti prima di essere dichiarate completate.

Il mirror contiene un pulitore generico di overlay/cookie: valutarne la rimozione prima di introdurre i nuovi pop-up, perché può intervenire su classi di blocco dello scorrimento. Non fa parte delle funzioni aziendali richieste. Conservare il salvataggio storico e le attribuzioni durante la preparazione dei sorgenti modificabili.

Non serve installare ora altri plugin o servizi. PostgreSQL, bucket, autenticazione e API indipendenti sono già predisposti. Non usare il vecchio database, non importare con il seed dimostrativo e non pubblicare materiali o prodotti come conseguenza della sola lettura di questo piano.

## Fonti e decisioni

La distinzione tra prodotto e varianti e i campi colore, taglia, sistema taglie, materiale, genere e identificatore di gruppo sono coerenti con la [specifica ufficiale Google Merchant Center](https://support.google.com/merchants/answer/7052112?hl=en), consultata il 6 novembre 2026. Qui servono come riferimenti di interoperabilità: le condizioni di pubblicazione sui singoli canali non diventano blocchi per salvare bozze in Ishtar Lab.

I campi che dipendono dalla categoria e i valori riutilizzabili per colori/opzioni sono documentati da [Shopify, Category metafields](https://help.shopify.com/en/manual/custom-data/metafields/category-metafields). L’adattamento a pannello laterale, tab e campi liberamente configurabili è una proposta specifica per la richiesta dell’utente, senza obbligo di usare Shopify.

Anteprima delle colonne, identificatori stabili e foto importabili da URL sono riferimenti del [flusso CSV ufficiale WooCommerce](https://woocommerce.com/document/product-csv-importer-exporter/). Il piano aggiunge gestione delle anomalie effettivamente trovate nei dati locali e ripetibilità dell’importazione. Nessuna dipendenza da WooCommerce introdotta.

Misure specifiche, tassonomia commerciale e gestione dei completi sono scelte proposte per Ishtar Lab, da mantenere modificabili; non sono caratteristiche dedotte per i singoli prodotti del CSV.

## Collegamento al vault — 7 novembre 2026

La pianificazione trasversale è in piani di implementazione/00 Inizia qui.md. Per inventario consultare Catalogo e varianti, Importazione CSV e immagini e Magazzino e acquisti; per dipendenze e sequenza consultare Roadmap per fasi. Questo documento resta la specifica approfondita storica del catalogo: non spostato o cancellato. Il vault distingue ciò che è già operativo dai 107 interventi futuri, senza sostituire il design o il catalogo esistente.
