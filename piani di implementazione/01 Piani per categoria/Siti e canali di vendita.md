---
title: "Siti e canali di vendita"
updated: 2026-11-07
type: documentazione-progetto
tags: [ishtar-lab, piano, web]
---

# Siti e canali di vendita

## Stato reale al 7 novembre 2026

La vetrina è una schermata/anteprima dimostrativa, non un editor o un negozio pubblicato. Il backend ha catalogo connettori, OAuth e prove di collegamento; non è accertata una sincronizzazione reale. Un test di accesso riuscito non equivale a gestione del sito.

Evidenze: assets/channels-DYxXzfFW.js; modules/connectors/catalogo.ts e service.ts; catalog_bridge.py.

## Interventi proposti

Tutti gli elementi seguenti sono **da fare**; la priorità non equivale a un'autorizzazione a pubblicare, inviare messaggi, acquistare servizi o cambiare il design.

| ID | Priorità | Risultato e prova di accettazione |
|---|---|---|
| WEB-01 | P1 | **Scegliere e collegare il primo sito reale** — Registrare dominio, piattaforma e ambiti minimi; ambiente di prova separato e lettura di un campione di prodotti senza pubblicare nulla. |
| WEB-02 | P1 | **Modello di sincronizzazione per ogni entità** — Definire sistema autorevole per prodotto, prezzo, stock e ordine; mappa ID esterni/SKU e precedenza dei conflitti documentate. |
| WEB-03 | P1 | **Importazione iniziale e aggiornamenti incrementali** — Dry run leggibile, cursori, limiti API e riconciliazione periodica; un riavvio non duplica dati. |
| WEB-04 | P1 | **Webhook firmati e idempotenti** — Eventi autenticati, duplicati e fuori ordine gestiti; coda degli errori con riprova manuale e nessuna perdita silenziosa. |
| WEB-05 | P1 | **Pubblicazione controllata dei prodotti** — Selezione del canale, anteprima, campi obbligatori e approvazione dell'utente; nessuna pubblicazione dei record demo. |
| WEB-06 | P2 | **Contenuti sito, SEO e pagine** — Chiarire per piattaforma ciò che è modificabile via API; bozze e revisione di descrizioni, meta, URL e pagine senza sovrascrivere il tema esistente. |
| WEB-07 | P2 | **Feed Merchant Center e cataloghi social** — Export con varianti, foto, disponibilità e identificativi veri; errori di conformità per record, senza GTIN sintetici. |
| WEB-08 | P2 | **Più negozi con dati separati** — Origine di ogni dato visibile, ruoli per negozio e listini distinti; un'azione su un sito non modifica gli altri senza scelta. |
| WEB-09 | P2 | **Salute dei collegamenti e revoca** — Ultima sincronizzazione, scadenza token, ritardi ed errori leggibili; revoca scollega l'account e interrompe le attività relative. |

## Dipendenze e regole

Prima stabilità dei dati, fonti autorevoli e confine DEMO/reale; poi collegamento al pannello e prova completa. Se esiste già una funzione backend, valutarla e riutilizzarla prima di riscriverla. Conservare i componenti del primo frontend, i dati e le attribuzioni; niente azzeramenti per semplificare una migrazione.

Ogni intervento si chiude con dati di test, verifica della persistenza, gestione di errore e riavvio, aggiornamento di PROJECT.md/CHANGELOG.md e della riga del [[Backlog completo]]. I criteri descrivono la proposta, non controlli già eseguiti.

Collegamenti: [[Stato delle funzioni]] · [[Roadmap per fasi]] · [[Decisioni e criteri di consegna]].
