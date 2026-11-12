---
title: Versione 2 - origine e differenze
updated: 2026-11-12
type: riferimento-tecnico
tags: [ishtar-lab, versione-2, architettura]
---

# Versione 2 - origine e differenze

## Origine e perimetro

Per richiesta esplicita del titolare, copiata in `versione 2/` la seconda app presente in `C:/Users/reda_/Desktop/Progetti suddivisi/pannello di amministrazione del negozio/multi-outfit`. È l'app descritta dal suo README come Ishtar Lab, con console amministratore, portale aziende, team e connettori. Non è stato copiato l'intero strumento Site to Desktop, né l'archivio storico di redx.

I **685 file sorgenti selezionati** sono identici prima/dopo la copia e nella destinazione, con SHA-256 in `versione 2/MANIFEST-ORIGINE.json`. Nessun avvio o arresto dell'originale. La revisione Git della sorgente non è stata accertata; lo snapshot include i file di lavoro disponibili il 12 novembre e non è presentato come un commit rilasciato upstream. Segreti/env, Git annidato, database, dipendenze, build e log non sono inclusi. README/DECISIONI originali sono conservati; guide e memoria della consegna sono aggiunte separatamente.

## Confronto statico del 12 novembre

| Aspetto | Prima app e backend in radice | `versione 2/` |
|---|---|---|
| Interfaccia principale | Frontend recuperato in `frontend/ishtar-lab`, bundle compilati con adattatori | Console React/Vite con sorgenti in `piattaforma/apps/console` |
| API | `backend/piattaforma/packages/api` | `versione 2/piattaforma/packages/api` |
| File custom `route.ts` | 98 | 149 |
| Directory moduli | 7 | 9 |
| TSX della console | 112 | 163 |
| Moduli ulteriori della seconda base | Assenti come directory implementate | `marketing`, `negozio-online` |
| API specifica `/admin/ishtar/catalogo` | Presente, usata dal ponte del primo pannello | Assente |
| API / console | 9273 / 5283 opzionale | 9100 / 5180 negli script originali |
| PostgreSQL / Redis | 55730 / 56730, Redis autenticato | 55500 / 56500, Redis senza password nel Compose copiato |
| S3 / web email / SMTP | 59730 / 58730 / 51730 | 59500 / 58500 / 51500 |
| Identità Compose | `ishtar-lab-redx` | `multi-outfit` |
| RustFS | Digest pubblico nella consegna | Tag locale conservato dalla sorgente |
| Ambiente verificato qui | Test puri e integrità; flussi storici documentati | Integrità copia e inventario statico; flussi non avviati |

I 149 percorsi comprendono **52 percorsi non presenti nella prima base**; viceversa la prima ha il percorso Ishtar specifico assente nella seconda. I metodi sono elencati nel CSV delle API; il conteggio non include automaticamente tutte le rotte fornite dalle dipendenze Medusa/Mercur e non misura funzionalità complete. Le differenze non costituiscono una migrazione compatibile.

## Mappa di lettura della seconda app

- `piattaforma/apps/console/src/sezioni/`: prodotti, ordini, clienti, magazzino, outfit, cassa, analisi, marketing, ingrosso, negozio-online, impostazioni e assistenza. Esistenza del codice non equivale al collegamento a dati reali o alla correttezza del ciclo completo.
- `piattaforma/apps/console/src/api/`: client HTTP e sessione. Vite ha un endpoint di accesso locale in sviluppo che legge credenziali server-side; non è un sistema di autenticazione per un deploy remoto.
- `piattaforma/packages/api/src/api/`: rotte custom. `middlewares.ts` e gli helper permessi/tenant vanno verificati insieme a ogni rotta, non dedotti dal nome della cartella.
- `piattaforma/packages/api/src/modules/`: assistenza, carte-regalo, connectors, ingrosso, marketing, negozio-online, outfit, permessi, smtp-notification; migrazioni nelle sottocartelle pertinenti.
- `infra/demo/`, `popola-demo.mjs`, `togli-demo.mjs`, `prova-*`: materiale per prove/popolamento, potenzialmente mutante. Non è un backup dei dati del titolare e non deve essere eseguito su dati reali.
- `piattaforma/bun.lock`, package.json e configurazioni workspace: base per installazione riproducibile; nessuna dipendenza è stata installata per questa copia.

## Cosa non unire automaticamente

Il backend principale include isolamento, validazioni e correzioni documentate il 6 novembre, oltre al catalogo specifico. La versione 2 conserva la propria evoluzione: non si afferma che contenga quelle correzioni, né che sia più sicura perché ha più file. Non copiare l'intero backend di una base sopra l'altro e non riutilizzare gli stessi volumi senza uno studio delle migrazioni.

Il primo pannello resta l'interfaccia scelta dal titolare. La cartella `versione 2` serve al confronto e al lavoro sulla seconda applicazione; non autorizza di per sé a sostituire la prima UI. Prima del porting scegliere componente per componente, confrontare schema/API, preservare le autorizzazioni e provare persistenza, errori e rollback.

## Avvio e lavoro rimanente

I launcher copiati sono quelli della sorgente, non un nuovo ambiente già isolato. Sul PC del titolare puntano alle stesse identità del progetto originale; non avviarli. Su un nuovo computer preparare DB, Redis, S3 e credenziali propri e controllare porta/tenant/CORS. Un semplice `--project-name` diverso non risolve da solo conflitti di porte e URL presenti nel codice.

Per la configurazione originale leggere `infra/configura-ambiente.mjs`: richiede già un `infra/.env` coerente e scrive l'env API. Non crea magicamente credenziali dell'amministratore o tutto il bootstrap. Sono aggiunti modelli **non operativi** in `configurazione-esempio/`; compilare con segreti nuovi e definire l'inizializzazione utenti senza eseguire automaticamente il vecchio seed. La compatibilità Linux, il tag RustFS e il comportamento delle funzioni devono essere corretti/provati dal collaboratore.

Fonti: `versione 2/MANIFEST-ORIGINE.json`, package/Compose copiati, inventari statici in `99 Fonti`. [[Consegna tecnica al collaboratore]] · [[Segnalazioni ricevute e verifiche]] · [[Architettura e dati]].
