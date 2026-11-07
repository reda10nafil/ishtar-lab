---
title: "Prezzi costi e finanza"
updated: 2026-11-07
type: documentazione-progetto
tags: [ishtar-lab, piano, fin]
---

# Prezzi costi e finanza

## Stato reale al 7 novembre 2026

Prezzo e costo articolo persistono nel catalogo; non sono una contabilità certificata. Molti importi del catalogo sono stati inventati per la DEMO e non rappresentano acquisti, margini o valori fiscali reali.

Evidenze: API admin/ishtar/catalogo e catalogo/comune/offerte; provenienza-demo.json.

## Interventi proposti

Tutti gli elementi seguenti sono **da fare**; la priorità non equivale a un'autorizzazione a pubblicare, inviare messaggi, acquistare servizi o cambiare il design.

| ID | Priorità | Risultato e prova di accettazione |
|---|---|---|
| FIN-01 | P1 | **Separare valori demo e prezzi confermati** — Importi sintetici esclusi da pubblicazione e analisi economiche reali finché verificati; registro di chi ha confermato ogni campo. |
| FIN-02 | P1 | **Valute, imposte e arrotondamenti** — Valuta esplicita e regole IVA per il mercato scelto, prezzi inclusi/esclusi e conversioni datate; calcoli in unità minori. |
| FIN-03 | P2 | **Margine completo per ordine e prodotto** — Costo acquisto, trasporto, commissioni, resi e sconti distinti; margine lordo e netto definito senza deduzioni fiscali automatiche. |
| FIN-04 | P2 | **Listini e storico prezzi** — Listini per canale/cliente, intervalli di validità e simulazione dell'effetto; prezzi precedenti conservati. |
| FIN-05 | P2 | **Riconciliazione incassi e documenti** — Pagamento, commissione, versamento e rimborso confrontati con i documenti del provider; scarti visibili. |
| FIN-06 | P2 | **Esportazione o integrazione contabile** — Scegliere col consulente il gestionale e i campi necessari; il connettore presente non è prova di fatturazione elettronica conforme. |
| FIN-07 | P3 | **Budget e scenari decisionali** — Scenario ricavi/costi separato dai consuntivi e con ipotesi modificabili; nessuna previsione presentata come garanzia. |

## Dipendenze e regole

Prima stabilità dei dati, fonti autorevoli e confine DEMO/reale; poi collegamento al pannello e prova completa. Se esiste già una funzione backend, valutarla e riutilizzarla prima di riscriverla. Conservare i componenti del primo frontend, i dati e le attribuzioni; niente azzeramenti per semplificare una migrazione.

Ogni intervento si chiude con dati di test, verifica della persistenza, gestione di errore e riavvio, aggiornamento di PROJECT.md/CHANGELOG.md e della riga del [[Backlog completo]]. I criteri descrivono la proposta, non controlli già eseguiti.

Collegamenti: [[Stato delle funzioni]] · [[Roadmap per fasi]] · [[Decisioni e criteri di consegna]].
