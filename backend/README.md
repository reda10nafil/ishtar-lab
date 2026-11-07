# Ishtar Lab — ambiente locale indipendente

Il pannello scelto è quello in `../frontend/`, con monogramma Ishtar e nome Ishtar Lab. Questa cartella conserva il backend Medusa/Mercur e i workspace necessari, senza sostituire il pannello con la console di supporto.

## Uso normale

Dalla cartella redx aprire **Avvia Ishtar Lab.cmd**. Per fermare solo API e servizi di questa copia: **Ferma backend Ishtar Lab.cmd**. I dati dei nuovi volumi vengono conservati. Il pannello può essere aperto separatamente da **Apri pannello recuperato.cmd**.

| Servizio | Indirizzo/porta locale |
| --- | --- |
| Primo pannello Ishtar Lab | http://127.0.0.1:4273/ishtar-lab/#/home |
| API | http://127.0.0.1:9273 |
| PostgreSQL | 55730; database ishtar_lab_redx |
| Redis autenticato | 56730 |
| Archivio S3 | 59730; bucket ishtar-lab-assets |
| Console archivio | 59731 |
| Email locale / SMTP | 58730 / 51730 |
| Console di supporto opzionale | 5283; non avviata dal launcher |

Progetto Docker `ishtar-lab-redx`, rete `ishtar_lab_redx_private`, volumi `ishtar_lab_redx_postgres`, `ishtar_lab_redx_redis`, `ishtar_lab_redx_storage`. Tutte le porte pubblicate sono su 127.0.0.1.

## Preparazione e manutenzione

Ambiente già preparato e verificato il 6 novembre 2026. Per ricreare soltanto i file di configurazione della copia: `node infra/configura-ambiente.mjs` (conserva le chiavi della stessa istanza). Per inizializzare tabelle, proprietario e bucket: `node infra/runtime.mjs init`, senza dati demo. Per migrazioni: `node infra/migra.mjs`; generazione: `node infra/migra.mjs genera nome-modulo`. Per stato: `node infra/runtime.mjs status`.

Le credenziali locali sono in `.credenziali-locali.env`; non sono riportate nei documenti. Le configurazioni private sono ignorate da Git. Dipendenze locali installate dal lockfile, con script automatici di installazione disabilitati. I normali comandi dev/start dei workspace API e piattaforma sono indirizzati al gestore della copia.

Avvio stabile senza watcher backend su Windows; per applicare modifiche al codice fermare e riavviare **solo questa istanza**. Il vecchio progetto non viene toccato. Il seed demo richiede consenso tecnico esplicito tramite variabili di ambiente e password individuale, e non serve per importare i CSV dell’utente.

Stato, verifiche e lavoro ancora da fare: `../PROJECT.md`. Catalogo/inventario del primo frontend collegati alle API con 82 articoli DEMO; ordini/clienti/dashboard e altri moduli restano dimostrativi nel browser. La consegna su un nuovo PC genera un catalogo vuoto: non è il backup del database del titolare.
