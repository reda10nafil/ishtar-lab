---
title: "Importazione CSV e immagini"
updated: 2026-11-07
type: documentazione-progetto
tags: [ishtar-lab, piano, imp]
---

# Importazione CSV e immagini

## Stato reale al 7 novembre 2026

CSV con anteprima, mapping, creazione di campi e gestione duplicati SKU verificato dal selettore file. Handler drag and drop implementato, trascinamento fisico non provato. Upload foto locale provato nel bucket; URL esterni conservati come link.

Evidenze: catalogo/csv.mjs; catalogo/catalogo.js; verifiche/csv.test.mjs; verifiche/qa-catalogo-operativo.json.

## Interventi proposti

Tutti gli elementi seguenti sono **da fare**; la priorità non equivale a un'autorizzazione a pubblicare, inviare messaggi, acquistare servizi o cambiare il design.

| ID | Priorità | Risultato e prova di accettazione |
|---|---|---|
| IMP-01 | P0 | **Provare il trascinamento reale da Esplora file** — Trascinando un CSV nella pagina prodotti si apre la stessa anteprima del pulsante; altri file vengono respinti con messaggio leggibile. |
| IMP-02 | P1 | **Importazioni per lotto recuperabili e annullabili** — Un'interruzione a metà import consente ripresa senza duplicati; l'annullamento ripristina soltanto i record del lotto e non gli aggiornamenti successivi. |
| IMP-03 | P1 | **Profili di mapping salvati e versionati** — Un secondo CSV dello stesso fornitore riutilizza associazioni, formato numeri e separatore; campi sconosciuti richiedono revisione. |
| IMP-04 | P1 | **Resoconto per riga e conflitti controllabili** — Record creati, aggiornati, saltati o errati sono scaricabili; zero, vuoto e non disponibile sono distinti e i conflitti non sovrascrivono silenziosamente. |
| IMP-05 | P1 | **Associazione assistita delle immagini locali** — Anteprima dei candidati per SKU/hash/nome; ogni abbinamento ambiguo viene confermato e gli originali non vengono modificati. |
| IMP-06 | P1 | **Validazione server e pulizia dei caricamenti** — Verifica di contenuto e dimensioni, limiti per immagine, nomi sicuri e gestione degli oggetti rimasti senza prodotto; nessuna cancellazione di file condivisi. |
| IMP-07 | P2 | **Copia controllata delle foto remote** — Download con limiti, timeout, DNS/IP sicuri e controllo contenuto; URL non disponibile segnalato, provenienza conservata e nessun accesso a reti private. |
| IMP-08 | P2 | **Galleria per variante e ottimizzazione** — Miniature, ordine, immagine principale, testo alternativo e associazione variante; originali conservati e caricamento veloce. |
| IMP-09 | P2 | **Esportazione del catalogo completo e XLSX** — Export degli effettivi dati DB con campi e varianti; round trip di un campione verificato. Il CSV demo scaricabile non viene chiamato export del catalogo. |
| IMP-10 | P2 | **Versioni dei file e import differenziale** — Hash e origine dei file, validazione dell'intero lotto e anteprima delle sole differenze; report privo di segreti. |

## Dipendenze e regole

Prima stabilità dei dati, fonti autorevoli e confine DEMO/reale; poi collegamento al pannello e prova completa. Se esiste già una funzione backend, valutarla e riutilizzarla prima di riscriverla. Conservare i componenti del primo frontend, i dati e le attribuzioni; niente azzeramenti per semplificare una migrazione.

Ogni intervento si chiude con dati di test, verifica della persistenza, gestione di errore e riavvio, aggiornamento di PROJECT.md/CHANGELOG.md e della riga del [[Backlog completo]]. I criteri descrivono la proposta, non controlli già eseguiti.

Collegamenti: [[Stato delle funzioni]] · [[Roadmap per fasi]] · [[Decisioni e criteri di consegna]].
