---
title: "Sicurezza backup e continuita"
updated: 2026-11-07
type: documentazione-progetto
tags: [ishtar-lab, piano, ops]
---

# Sicurezza backup e continuita

## Stato reale al 7 novembre 2026

Servizi e porte sono isolati e locali. Il ponte opera come singolo proprietario e inoltra catalogo/foto con credenziali server-side. Esistono ruoli e registri backend; la modalità attuale non è un login remoto multiutente. I tre rilievi storici corretti non equivalgono a un audit totale.

Evidenze: catalog_bridge.py; backend/infra/runtime.mjs e compose.yaml; PROJECT.md; rapporti verifiche.

## Interventi proposti

Tutti gli elementi seguenti sono **da fare**; la priorità non equivale a un'autorizzazione a pubblicare, inviare messaggi, acquistare servizi o cambiare il design.

| ID | Priorità | Risultato e prova di accettazione |
|---|---|---|
| OPS-01 | P0 | **Backup completo con ripristino provato** — Dump DB, foto e configurazioni necessarie salvati separatamente con protezione dei segreti; ripristino in istanza di prova e confronto quantità/foto. |
| OPS-02 | P0 | **Piano di recupero dei dati browser demo** — Esportare o conservare in modo controllato preferenze e dati locali prima delle migrazioni; il reset browser non viene scambiato per reset DB. |
| OPS-03 | P1 | **Operazioni atomiche e gestione dei conflitti** — Un errore tra aggiornamento prezzo, scorta e scheda non lascia un salvataggio parziale; modifiche concorrenti non si perdono. |
| OPS-04 | P1 | **Accesso remoto progettato separatamente** — Prima di qualunque esposizione: TLS, utenti/sessioni, permessi minimi, protezione richieste e upload; nessuna esposizione del ponte proprietario locale. |
| OPS-05 | P1 | **Registro azioni e diagnosi leggibile** — Collegare il registro backend alle azioni reali e mostrare esito, autore e riferimento senza credenziali; errori recuperabili dall'utente. |
| OPS-06 | P1 | **Privacy e conservazione dati** — Definire dati necessari, tempi, esportazione/cancellazione e ruoli per gli account reali; controllare i requisiti applicabili prima dell'attivazione. |
| OPS-07 | P1 | **Aggiornamenti riproducibili e inventario componenti** — Versioni e immagini fissate, licenze e dipendenze inventariate; aggiornamento prima in prova e rollback documentato. |
| OPS-08 | P1 | **Avvio a freddo, arresto e diagnostica** — Test dopo riavvio Windows e Docker spento; verifica di identità prima di fermare servizi, messaggi chiari su prerequisiti e spazio disco. |
| OPS-09 | P2 | **Backup automatici scelti e verificati** — Politica concordata di frequenza/retention e copia separata; avvisi di fallimento e prova periodica di recupero, senza creare ora automazioni. |
| OPS-10 | P2 | **Monitoraggio code, disponibilita e risorse** — Salute API, DB, storage, code e spazio visibili con dati reali; soglie e destinatari configurati dall'utente. |

## Dipendenze e regole

Prima stabilità dei dati, fonti autorevoli e confine DEMO/reale; poi collegamento al pannello e prova completa. Se esiste già una funzione backend, valutarla e riutilizzarla prima di riscriverla. Conservare i componenti del primo frontend, i dati e le attribuzioni; niente azzeramenti per semplificare una migrazione.

Ogni intervento si chiude con dati di test, verifica della persistenza, gestione di errore e riavvio, aggiornamento di PROJECT.md/CHANGELOG.md e della riga del [[Backlog completo]]. I criteri descrivono la proposta, non controlli già eseguiti.

Collegamenti: [[Stato delle funzioni]] · [[Roadmap per fasi]] · [[Decisioni e criteri di consegna]].
