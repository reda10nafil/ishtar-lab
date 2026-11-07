---
title: "Ricerca di mercato"
updated: 2026-11-07
type: documentazione-progetto
tags: [ishtar-lab, piano, mer]
---

# Ricerca di mercato

## Stato reale al 7 novembre 2026

Non è stato identificato un modulo operativo di ricerca mercato: i grafici recuperati non effettuano confronti con concorrenti o analisi della domanda. Questa è un'estensione proposta, non una capacità attuale.

Evidenze: Inventario dei moduli API e pagine: assenza di una pipeline mercato verificata; richiesta dell'utente.

## Interventi proposti

Tutti gli elementi seguenti sono **da fare**; la priorità non equivale a un'autorizzazione a pubblicare, inviare messaggi, acquistare servizi o cambiare il design.

| ID | Priorità | Risultato e prova di accettazione |
|---|---|---|
| MER-01 | P2 | **Definire domande, paesi e concorrenti** — Per categoria e stagione indicare cosa confrontare, mercato, valuta, tasse e qualità del prodotto; evitare confronti tra articoli non equivalenti. |
| MER-02 | P2 | **Fonti autorizzate con provenienza** — API, dataset, fornitori o raccolta manuale con URL, data, termini e frequenza; niente aggiramento di login o protezioni. |
| MER-03 | P2 | **Confronto prezzi comparabili** — Prezzo, promozione, trasporto, condizione, materiale e disponibilità conservati separatamente; confidenza del matching visibile. |
| MER-04 | P2 | **Storico e variazioni del mercato** — Snapshot datati, variazioni e alert riproducibili; dati vecchi marcati come tali, non presentati come prezzi correnti. |
| MER-05 | P2 | **Domanda, tendenze e stagionalità** — Indicatori con fonte, copertura e limiti; volume di ricerca e interesse non vengono equiparati a vendite. |
| MER-06 | P3 | **Proposte di assortimento motivate** — Suggerimenti collegati a domanda, stock e margine, con prove e ipotesi; nessun acquisto o repricing automatico. |
| MER-07 | P3 | **Previsioni valutate su dati storici** — Confronto con baseline stagionale e misura dell'errore; mostrare intervalli e non promettere ricavi futuri. |

## Dipendenze e regole

Prima stabilità dei dati, fonti autorevoli e confine DEMO/reale; poi collegamento al pannello e prova completa. Se esiste già una funzione backend, valutarla e riutilizzarla prima di riscriverla. Conservare i componenti del primo frontend, i dati e le attribuzioni; niente azzeramenti per semplificare una migrazione.

Ogni intervento si chiude con dati di test, verifica della persistenza, gestione di errore e riavvio, aggiornamento di PROJECT.md/CHANGELOG.md e della riga del [[Backlog completo]]. I criteri descrivono la proposta, non controlli già eseguiti.

Collegamenti: [[Stato delle funzioni]] · [[Roadmap per fasi]] · [[Decisioni e criteri di consegna]].
