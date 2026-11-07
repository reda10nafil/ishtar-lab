---
title: "Magazzino e acquisti"
updated: 2026-11-07
type: documentazione-progetto
tags: [ishtar-lab, piano, inv]
---

# Magazzino e acquisti

## Stato reale al 7 novembre 2026

Le scorte del catalogo persistono nelle offerte/inventario native. Nel backend esistono route per depositi, riserve, movimenti e soglie: la presenza del codice non dimostra che siano collegate e utilizzabili dal primo pannello.

Evidenze: API admin/magazzino; admin/ishtar/catalogo; verifiche/qa-catalogo-operativo.json.

## Interventi proposti

Tutti gli elementi seguenti sono **da fare**; la priorità non equivale a un'autorizzazione a pubblicare, inviare messaggi, acquistare servizi o cambiare il design.

| ID | Priorità | Risultato e prova di accettazione |
|---|---|---|
| INV-01 | P1 | **Registro dei movimenti con causale** — Ogni carico, scarico e rettifica riporta quantità prima/dopo, motivo, data e autore; lo storico è consultabile dal pannello. |
| INV-02 | P1 | **Riserve e concorrenza sulle disponibilità** — Due vendite simultanee dell'ultimo pezzo non generano disponibilità negative; prenotazioni scadute vengono rilasciate e sono tracciabili. |
| INV-03 | P1 | **Depositi, ubicazioni e trasferimenti** — Giacenze per deposito/scaffale, trasferimenti e disponibilità aggregata riconciliati, riutilizzando le API esistenti. |
| INV-04 | P1 | **Ordini di acquisto e ricezione merce** — Ordine al fornitore, arrivi parziali e differenze alimentano quantità in arrivo e carichi reali senza semplice modifica di un contatore. |
| INV-05 | P1 | **Conteggio inventariale e riconciliazione** — Conteggio fisico per SKU, confronto con sistema, approvazione rettifiche e verbale esportabile; nessun reset generale. |
| INV-06 | P1 | **Avvisi di scorta basati sul DB** — Soglie per variante/deposito, avviso comprensibile e rientro dell'allarme; nessun alert dimostrativo presentato come reale. |
| INV-07 | P2 | **Lettura barcode ed etichette** — Scanner o fotocamera trovano lo SKU corretto; ristampa etichetta distingue barcode interno da GTIN. |
| INV-08 | P2 | **Valorizzazione del magazzino** — Metodo di costo dichiarato, quantità e costi riconciliabili; riserve e resi hanno trattamento documentato. |

## Dipendenze e regole

Prima stabilità dei dati, fonti autorevoli e confine DEMO/reale; poi collegamento al pannello e prova completa. Se esiste già una funzione backend, valutarla e riutilizzarla prima di riscriverla. Conservare i componenti del primo frontend, i dati e le attribuzioni; niente azzeramenti per semplificare una migrazione.

Ogni intervento si chiude con dati di test, verifica della persistenza, gestione di errore e riavvio, aggiornamento di PROJECT.md/CHANGELOG.md e della riga del [[Backlog completo]]. I criteri descrivono la proposta, non controlli già eseguiti.

Collegamenti: [[Stato delle funzioni]] · [[Roadmap per fasi]] · [[Decisioni e criteri di consegna]].
