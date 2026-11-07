---
title: "Analisi vendite e visite"
updated: 2026-11-07
type: documentazione-progetto
tags: [ishtar-lab, piano, ana]
---

# Analisi vendite e visite

## Stato reale al 7 novembre 2026

Dashboard, grafici vendite, visitatori e analisi sono DEMO nel browser. Non sono dati del sito Ishtar Hub. Plausible e Google compaiono nei connettori, ma non provano l'acquisizione di visite/eventi né report economici reali.

Evidenze: assets/home-Cg7QG5Xk.js; assets/analytics-D8Gaon-6.js; catalogo connettori; verifiche/pagine-ripristinate.json.

## Interventi proposti

Tutti gli elementi seguenti sono **da fare**; la priorità non equivale a un'autorizzazione a pubblicare, inviare messaggi, acquistare servizi o cambiare il design.

| ID | Priorità | Risultato e prova di accettazione |
|---|---|---|
| ANA-01 | P1 | **Definizioni condivise degli indicatori** — Per ricavi, ordini, conversione, valore medio e margine indicare formula, fonte, valuta, fuso, esclusioni e aggiornamento. |
| ANA-02 | P1 | **Cruscotto vendite da ordini reali** — Totali giornalieri e per SKU/canale riconciliati con righe, sconti e rimborsi; il confronto con la sorgente torna al centesimo. |
| ANA-03 | P1 | **Acquisire visite dal sito scelto** — Un provider approvato restituisce visite, sessioni e pagine su date note; mostrare ritardo e indisponibilità senza sostituirli con numeri inventati. |
| ANA-04 | P1 | **Misurare il percorso prodotto-carrello-acquisto** — Eventi view_item, add_to_cart, begin_checkout, purchase e refund con identificativi deduplicati; un ordine reale non viene contato due volte. |
| ANA-05 | P1 | **Indicatori reali, demo e mancanti riconoscibili** — Ogni widget indica fonte, ultimo aggiornamento e stato; assenza di dati, zero e errore non sono intercambiabili. |
| ANA-06 | P2 | **Confronti e segmenti coerenti** — Periodi precedenti, canali, dispositivo, paese e clienti nuovi/ricorrenti con filtri persistenti e fusi corretti. |
| ANA-07 | P2 | **Rendimento di prodotti e scorte** — Rotazione, giorni di copertura, sell-through, invenduto e resi per variante con definizioni e campioni verificati. |
| ANA-08 | P2 | **Esportazioni e report riproducibili** — Lo stesso intervallo produce tabella e grafico coerenti, esportabili; permessi limitano costi e dati personali. |
| ANA-09 | P2 | **Attribuzione marketing e spesa** — UTM, sorgenti e costi pubblicitari con modello esplicito; ROAS non viene confuso con profitto o causalità dimostrata. |

## Dipendenze e regole

Prima stabilità dei dati, fonti autorevoli e confine DEMO/reale; poi collegamento al pannello e prova completa. Se esiste già una funzione backend, valutarla e riutilizzarla prima di riscriverla. Conservare i componenti del primo frontend, i dati e le attribuzioni; niente azzeramenti per semplificare una migrazione.

Ogni intervento si chiude con dati di test, verifica della persistenza, gestione di errore e riavvio, aggiornamento di PROJECT.md/CHANGELOG.md e della riga del [[Backlog completo]]. I criteri descrivono la proposta, non controlli già eseguiti.

Collegamenti: [[Stato delle funzioni]] · [[Roadmap per fasi]] · [[Decisioni e criteri di consegna]].
