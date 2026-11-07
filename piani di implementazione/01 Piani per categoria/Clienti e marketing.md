---
title: "Clienti e marketing"
updated: 2026-11-07
type: documentazione-progetto
tags: [ishtar-lab, piano, crm]
---

# Clienti e marketing

## Stato reale al 7 novembre 2026

Clienti, segmenti, campagne e automazioni nel primo pannello sono DEMO. Esistono API clienti, sconti, carte regalo, assistenza e connettori riutilizzabili; non sono ancora un CRM o un sistema di invio provato in questo pannello.

Evidenze: assets/customers-CqnBilLb.js; assets/marketing-DwyfNzxb.js; API admin/clienti, sconti, carte-regalo, assistenza.

## Interventi proposti

Tutti gli elementi seguenti sono **da fare**; la priorità non equivale a un'autorizzazione a pubblicare, inviare messaggi, acquistare servizi o cambiare il design.

| ID | Priorità | Risultato e prova di accettazione |
|---|---|---|
| CRM-01 | P1 | **Anagrafica clienti e storico reale** — Schede persistenti collegate agli ordini, indirizzi e note con deduplicazione email/ID e visibilità regolata. |
| CRM-02 | P1 | **Preferenze di contatto e consensi** — Registrare fonte, data, finalità e revoca; ogni invio controlla le preferenze e mantiene liste di esclusione. |
| CRM-03 | P2 | **Segmenti dinamici spiegabili** — Filtri su acquisti e interessi producono conteggi riconciliabili; dati sensibili e categorie non necessarie esclusi. |
| CRM-04 | P2 | **Campagne con bozza, anteprima e invio di prova** — Liste e contenuto revisionati, test su destinatario scelto e autorizzazione concreta prima dell'invio reale. |
| CRM-05 | P2 | **Automazioni con controllo e cronologia** — Trigger, limiti di frequenza, stop e anteprima dei destinatari; nessuna attivazione periodica senza scelta dell'utente. |
| CRM-06 | P2 | **Promozioni e carte regalo collegate agli ordini** — Riutilizzare le API esistenti, verificando validità, cumulabilità, saldo e storni; non soltanto badge dimostrativi. |
| CRM-07 | P2 | **Assistenza e resi nello storico cliente** — Richieste e messaggi collegati a ordini e autorizzazioni; informazioni private non esposte ad altri clienti. |
| CRM-08 | P3 | **Risultati delle campagne** — Invii, consegne, errori, disiscrizioni e ricavi attribuiti con fonte; apertura email non presentata come lettura certa. |

## Dipendenze e regole

Prima stabilità dei dati, fonti autorevoli e confine DEMO/reale; poi collegamento al pannello e prova completa. Se esiste già una funzione backend, valutarla e riutilizzarla prima di riscriverla. Conservare i componenti del primo frontend, i dati e le attribuzioni; niente azzeramenti per semplificare una migrazione.

Ogni intervento si chiude con dati di test, verifica della persistenza, gestione di errore e riavvio, aggiornamento di PROJECT.md/CHANGELOG.md e della riga del [[Backlog completo]]. I criteri descrivono la proposta, non controlli già eseguiti.

Collegamenti: [[Stato delle funzioni]] · [[Roadmap per fasi]] · [[Decisioni e criteri di consegna]].
