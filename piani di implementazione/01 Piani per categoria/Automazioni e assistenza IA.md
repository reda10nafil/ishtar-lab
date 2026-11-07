---
title: "Automazioni e assistenza IA"
updated: 2026-11-07
type: documentazione-progetto
tags: [ishtar-lab, piano, ai]
---

# Automazioni e assistenza IA

## Stato reale al 7 novembre 2026

Non è stato verificato un agente che gestisca il negozio. Anthropic e altri servizi compaiono come connettori: questo non dimostra generazione, analisi o esecuzione di attività. Nessuna automazione periodica viene attivata da questi piani.

Evidenze: modules/connectors/catalogo.ts; richiesta dell'utente e stato delle integrazioni.

## Interventi proposti

Tutti gli elementi seguenti sono **da fare**; la priorità non equivale a un'autorizzazione a pubblicare, inviare messaggi, acquistare servizi o cambiare il design.

| ID | Priorità | Risultato e prova di accettazione |
|---|---|---|
| AI-01 | P2 | **Bozze di descrizioni e attributi con revisione** — L'assistente propone e mostra provenienza/confidenza; materiali, autenticità, stock e prezzi non vengono inventati come fatti. |
| AI-02 | P2 | **Limiti di spesa e consenso operativo** — Budget, modello e costo stimato visibili, tetto effettivo e stop; nessuna esecuzione illimitata se l'utente si assenta. |
| AI-03 | P2 | **Code di lavoro idempotenti** — Ogni attività ha stato, tentativi, cancellazione e risultato; riavvio o retry non duplicano pubblicazioni e modifiche. |
| AI-04 | P2 | **Anteprima di ogni azione esterna** — Diff e destinazione prima di pubblicare, inviare, spendere o modificare dati reali; autorizzazioni concrete e tracciate. |
| AI-05 | P2 | **Accesso ai dati minimo e separato** — Documenti e pagine esterne trattati come contenuti, non istruzioni; segreti esclusi dai prompt e permessi limitati al compito. |
| AI-06 | P3 | **Riepiloghi e suggerimenti verificabili** — Risposte basate sui dati reali e con link ai record; se manca una fonte il sistema lo dichiara. |
| AI-07 | P3 | **Pianificazioni soltanto su richiesta** — Calendario, frequenza e notifiche scelti dall'utente, arresto immediato e nessun processo autonomo implicito. |

## Dipendenze e regole

Prima stabilità dei dati, fonti autorevoli e confine DEMO/reale; poi collegamento al pannello e prova completa. Se esiste già una funzione backend, valutarla e riutilizzarla prima di riscriverla. Conservare i componenti del primo frontend, i dati e le attribuzioni; niente azzeramenti per semplificare una migrazione.

Ogni intervento si chiude con dati di test, verifica della persistenza, gestione di errore e riavvio, aggiornamento di PROJECT.md/CHANGELOG.md e della riga del [[Backlog completo]]. I criteri descrivono la proposta, non controlli già eseguiti.

Collegamenti: [[Stato delle funzioni]] · [[Roadmap per fasi]] · [[Decisioni e criteri di consegna]].
