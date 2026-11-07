---
title: "Ordini vendite e resi"
updated: 2026-11-07
type: documentazione-progetto
tags: [ishtar-lab, piano, ven]
---

# Ordini vendite e resi

## Stato reale al 7 novembre 2026

Ordini, bozze e resi del primo pannello usano dati browser DEMO. Il backend commerciale possiede primitive e API da valutare; non è stato verificato un ciclo di vendita reale da questo frontend.

Evidenze: assets/orders-CDgLPKRx.js; backend API catalogo/offerte e workflow Medusa; PROJECT.md.

## Interventi proposti

Tutti gli elementi seguenti sono **da fare**; la priorità non equivale a un'autorizzazione a pubblicare, inviare messaggi, acquistare servizi o cambiare il design.

| ID | Priorità | Risultato e prova di accettazione |
|---|---|---|
| VEN-01 | P1 | **Collegare ordini e righe ai dati reali** — Ordine importato o creato dal canale compare dopo riavvio con SKU, variante, prezzi, valuta, data e origine; i dati demo restano distinti. |
| VEN-02 | P1 | **Stati ordine e transizioni verificabili** — Bozza, confermato, pagato, preparato, spedito, annullato e reso rispettano regole; transizioni non valide vengono respinte. |
| VEN-03 | P1 | **Totali, tasse e sconti coerenti** — Righe, imposte, trasporto e sconti sommano esattamente al totale in centesimi e valuta; nessun errore da floating point. |
| VEN-04 | P1 | **Pagamenti reali e riconciliazione** — Autorizzazione, cattura, rimborso e fallimenti provati prima in test; eventi duplicati non producono doppi addebiti o ordini. |
| VEN-05 | P1 | **Preparazione, spedizioni e tracking** — Picking, etichetta e tracking aggiornano lo stato con gestione delle spedizioni parziali e degli errori del corriere. |
| VEN-06 | P1 | **Resi e rimborsi collegati a scorte e ricavi** — Restituzione parziale reintegra soltanto merce ricevuta e accettata; note e movimenti economici riconciliabili. |
| VEN-07 | P2 | **Preventivi, bozze e B2B dal pannello** — Riutilizzare trattative/ingrosso backend con listini e approvazioni; conversione in ordine senza duplicazioni. |
| VEN-08 | P2 | **Cassa fisica e modalità di emergenza** — La pagina Shop till esegue una vendita reale con ricevuta e stock, poi riconcilia operazioni offline senza vendere due volte lo stesso pezzo. |

## Dipendenze e regole

Prima stabilità dei dati, fonti autorevoli e confine DEMO/reale; poi collegamento al pannello e prova completa. Se esiste già una funzione backend, valutarla e riutilizzarla prima di riscriverla. Conservare i componenti del primo frontend, i dati e le attribuzioni; niente azzeramenti per semplificare una migrazione.

Ogni intervento si chiude con dati di test, verifica della persistenza, gestione di errore e riavvio, aggiornamento di PROJECT.md/CHANGELOG.md e della riga del [[Backlog completo]]. I criteri descrivono la proposta, non controlli già eseguiti.

Collegamenti: [[Stato delle funzioni]] · [[Roadmap per fasi]] · [[Decisioni e criteri di consegna]].
