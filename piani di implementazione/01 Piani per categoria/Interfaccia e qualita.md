---
title: "Interfaccia e qualita"
updated: 2026-11-07
type: documentazione-progetto
tags: [ishtar-lab, piano, ux]
---

# Interfaccia e qualita

## Stato reale al 7 novembre 2026

Design originale ripristinato, CSS base preservato e 28 pagine aperte. Esistono bundle compilati, non il progetto React originale ricostruibile. Le nuove funzioni devono restare nei componenti e token scelti.

Evidenze: .ai-style-rules.md; verifiche/integrita-design.json; verifiche/pagine-ripristinate.json.

## Interventi proposti

Tutti gli elementi seguenti sono **da fare**; la priorità non equivale a un'autorizzazione a pubblicare, inviare messaggi, acquistare servizi o cambiare il design.

| ID | Priorità | Risultato e prova di accettazione |
|---|---|---|
| UX-01 | P0 | **Bloccare le regressioni del design scelto** — Confronto visivo di dashboard, catalogo, tabella e dialog nei due temi; nessuna sostituzione della struttura per aggiungere funzioni. |
| UX-02 | P1 | **Ricostruire una base sorgente mantenibile e autorizzata** — Recuperare sorgenti con diritti validi o concordare una ricostruzione originale; build riproducibile e confronto con le pagine approvate. |
| UX-03 | P1 | **Stati di attesa, errore e salvataggio coerenti** — Feedback esplicito per rete assente, conflitto e parziale successo; la navigazione non cancella dati né finge un salvataggio. |
| UX-04 | P1 | **Test di flussi completi e regressioni** — Creazione, foto, campi, CSV, variante, ordine e ripristino provati sui dati di test; un titolo visibile non prova un'integrazione reale. |
| UX-05 | P1 | **Accessibilita tastiera e lettori schermo** — Dialog con focus/ritorno, etichette, contrasto, errori associati e selettori utilizzabili senza mouse; verifica concreta dei flussi principali. |
| UX-06 | P2 | **Italiano, date, valuta e fuso coerenti** — Sostituire i testi dimostrativi come Noor e data fissa usando impostazioni vere; niente mix casuale di lingue. |
| UX-07 | P2 | **Layout su schermi piccoli e tabelle grandi** — Pannelli laterali, tab e scorrimenti mantengono controlli raggiungibili; prova touch senza ridisegnare la navigazione. |
| UX-08 | P2 | **Informazioni, licenza e guida nell'app** — Pagina compatta con crediti distinti, versione, collegamenti alla licenza finalizzata e guida. Non introdurre popup bloccanti o nuove grafiche senza necessità. |
| UX-09 | P2 | **Prestazioni con molti articoli e foto** — Benchmark con un dataset concordato, paginazione e caricamento immagini progressivo; obiettivi misurati, non dichiarati senza prova. |

## Dipendenze e regole

Prima stabilità dei dati, fonti autorevoli e confine DEMO/reale; poi collegamento al pannello e prova completa. Se esiste già una funzione backend, valutarla e riutilizzarla prima di riscriverla. Conservare i componenti del primo frontend, i dati e le attribuzioni; niente azzeramenti per semplificare una migrazione.

Ogni intervento si chiude con dati di test, verifica della persistenza, gestione di errore e riavvio, aggiornamento di PROJECT.md/CHANGELOG.md e della riga del [[Backlog completo]]. I criteri descrivono la proposta, non controlli già eseguiti.

Collegamenti: [[Stato delle funzioni]] · [[Roadmap per fasi]] · [[Decisioni e criteri di consegna]].
