---
title: "Catalogo e varianti"
updated: 2026-11-07
type: documentazione-progetto
tags: [ishtar-lab, piano, cat]
---

# Catalogo e varianti

## Stato reale al 7 novembre 2026

Catalogo e inventario sono collegati al DB: 82 articoli DEMO, otto categorie, creazione/modifica, stato, prezzi, scorte e 14 campi. La scheda espone una variante per articolo; la base Medusa può gestirne di più, ma l'adattatore corrente legge la prima.

Evidenze: frontend/ishtar-lab/catalogo/catalogo.js; API admin/ishtar/catalogo; PIANO-INVENTARIO.md.

## Interventi proposti

Tutti gli elementi seguenti sono **da fare**; la priorità non equivale a un'autorizzazione a pubblicare, inviare messaggi, acquistare servizi o cambiare il design.

| ID | Priorità | Risultato e prova di accettazione |
|---|---|---|
| CAT-01 | P1 | **Varianti taglia × colore nella stessa scheda** — Un prodotto con due taglie e due colori genera quattro SKU con prezzi, foto e quantità indipendenti; modifica e riapertura conservano tutte le varianti. |
| CAT-02 | P1 | **Campi specifici per categoria moda** — Pellicce, abiti, parti sopra/sotto, completi, borse, scarpe e accessori hanno modelli distinti; genere e materiale restano campi separati. |
| CAT-03 | P1 | **Controlli tipizzati completi per i campi** — Date reali, numeri con unità/intervalli, colore, opzioni e obbligatorietà sono verificati anche sul server; un valore non valido non viene salvato. |
| CAT-04 | P1 | **Gestione di categorie e sottocategorie dall'app** — L'utente può aggiungere/riordinare categorie con anteprima dell'impatto; un cambio non rende orfani i prodotti esistenti. |
| CAT-05 | P1 | **Modifica massiva con anteprima e storico** — Una selezione può aggiornare stato, prezzo o attributi; prima della conferma si vedono gli articoli interessati e dopo si può recuperare la versione precedente. |
| CAT-06 | P1 | **Distinzione DEMO, da verificare e reale** — Ogni dato sintetico conserva origine e revisione; nessun prodotto DEMO è esportabile/pubblicabile su un canale reale senza verifica esplicita. |
| CAT-07 | P2 | **Composizione, misure e informazioni moda complete** — Campi strutturati per vestibilità, misure, composizione percentuale, cura, stagione, condizione, marchio e identificativi; nessuna deduzione certa da foto. |
| CAT-08 | P2 | **Collezioni e outfit persistenti** — Collezioni, abbinamenti e componenti di un completo sono salvati nel DB e rimangono coerenti dopo importazioni o archiviazioni. |
| CAT-09 | P2 | **Ricerca, ordinamento e filtri salvati** — Ricerca server paginata per SKU e attributi, viste salvate e accessibilità dei filtri; nessun caricamento integrale di cataloghi grandi. |
| CAT-10 | P2 | **Anagrafica fornitori e identificativi commerciali** — Fornitore, codice interno, EAN/GTIN autentico e codice del fornitore sono distinti; non si inventano identificativi ufficiali. |

## Dipendenze e regole

Prima stabilità dei dati, fonti autorevoli e confine DEMO/reale; poi collegamento al pannello e prova completa. Se esiste già una funzione backend, valutarla e riutilizzarla prima di riscriverla. Conservare i componenti del primo frontend, i dati e le attribuzioni; niente azzeramenti per semplificare una migrazione.

Ogni intervento si chiude con dati di test, verifica della persistenza, gestione di errore e riavvio, aggiornamento di PROJECT.md/CHANGELOG.md e della riga del [[Backlog completo]]. I criteri descrivono la proposta, non controlli già eseguiti.

Collegamenti: [[Stato delle funzioni]] · [[Roadmap per fasi]] · [[Decisioni e criteri di consegna]].
