# Avvisi sui componenti di terzi

Verifica mirata del 7 novembre 2026. Non è un inventario completo di tutte le dipendenze né un nulla osta alla distribuzione.

## Frontend recuperato

L'inizio di frontend/ishtar-lab/index.html conserva l'avviso originale:

> Lumelle — the store behind Saltmarsh Candle Co. — © 2026 Hasib (OVERSHOOT). All rights reserved. Licensed, not sold: see LICENSE.md.

Il file LICENSE.md richiamato non è stato trovato nel frontend operativo né nei file di licenza individuati nel salvataggio storico. L'origine documentata è una copia del frontend servito su demo.codeandchill.store/lumelle/. Il tentativo di consultare la pagina e /lumelle/LICENSE.md tramite ricerca web il 7 novembre non ha restituito il testo.

Non risulta accertato qui né un diritto alla redistribuzione né un prezzo da pagare: non si conferma la precedente indicazione di 90 dollari. Rinominare l'app o cambiare funzioni non trasferisce i diritti sul codice recuperato. Avviso e attribuzioni non sono stati rimossi. Questa verifica non accerta la provenienza storica di ogni asset.

## Backend e librerie

| Componente rilevato | Versione locale | Evidenza e limiti |
|---|---|---|
| Starter API | 2.4.1 nel package | backend/piattaforma/packages/api/package.json dichiara MIT e autore Medusa; dichiarazione conservata |
| @medusajs/medusa e @medusajs/framework | 2.22.3 | I LICENSE installati dichiarano espressamente due regimi; non sono interamente MIT |
| @mercurjs/core | 2.4.1 | Manifest locale MIT; testo completo del notice non trovato nel package campionato, da recuperare per la consegna |
| React | 18.3.1 | Manifest MIT, LICENSE locale presente |
| Zod | 4.6.6 | Manifest MIT; non inventaria automaticamente le ulteriori dipendenze |
| Urbanist | v18 nel percorso dei font | Font localizzato da Google Fonts; notice specifico da recuperare |
| PostgreSQL, Redis, RustFS, Mailpit, Docker Desktop | Immagini/runtime nella configurazione locale | Condizioni proprie; necessario esame per uso/distribuzione scelti, non coperte dalla licenza Ishtar |

I termini Medusa del tag v2.22.3 distinguono il core MIT dai materiali Enterprise elencati, compresi specifici RBAC e SSO. Non è stato svolto un audit completo dei percorsi Enterprise presenti o utilizzati nella build. Il modulo personalizzato permessi del progetto non va identificato automaticamente con l'RBAC Enterprise di Medusa. Non sono stati disattivati controlli o attivate funzioni Enterprise.

La licenza Ishtar non riduce i permessi che le licenze altrui concedono autonomamente e non concede diritti che quegli autori non hanno concesso.

## Fonti primarie

- [MIT, testo OSI](https://opensource.org/license/mit).
- [Medusa LICENSE, tag v2.22.3](https://github.com/medusajs/medusa/blob/v2.22.3/LICENSE).
- [Medusa Enterprise, tag v2.22.3](https://github.com/medusajs/medusa/blob/v2.22.3/ENTERPRISE-LICENSE.md).
- [Mercur, repository ufficiale](https://github.com/mercurjs/mercur).
- [Definizione Open Source, punto 6](https://opensource.org/osd).
- [Direttiva 2009/24/CE, testo EUR-Lex](https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32009L0024).

Le fonti online sono state consultate il 7 novembre 2026. Per un rilascio prevalgono i termini dell'esatta revisione distribuita e i diritti effettivamente acquisiti, non una generica descrizione del progetto upstream.

## Aggiornamento — 8 novembre 2026: avviso e provenienza

L'utente contesta che gli avvisi possano essere stati inventati dall'assistente precedente. La sola presenza di un copyright non basta per certificare autore o titolarità. Verifica mirata: gli avvisi Hasib/OVERSHOOT sono nei commenti di index.html e 11 CSS, senza quelle stringhe fuori dai commenti nei file campionati. Non sono istruzioni eseguibili né prova di infezione.

Il manifest storico di site-to-desktop indica la cattura del 6 novembre da https://demo.codeandchill.store/lumelle/ . L'8 novembre una lettura diretta della pagina pubblica ha restituito HTTP 200 e lo stesso nome/avviso, anch'esso in un commento. La pagina HTML attuale ha contenuto diverso dal manifest; i due vecchi URL CSS/JS provati rispondono 404, quindi non è stato rifatto il confronto integrale dei byte con l'origine remota. Il lettore web non riusciva ad aprire il sito: il controllo è stato eseguito con una richiesta HTTP in sola lettura, senza eseguire il contenuto.

Questi riscontri sostengono l'origine indicata dai registri, ma non sono una ricostruzione di tutta la storia o una certificazione dei diritti. Non è dimostrato che l'assistente abbia inventato gli avvisi e non è stato accertato malware per la loro presenza. Nessuna scritta cancellata, nessun controllo di licenza rimosso e nessuna modifica a app, database o GitHub. Rapporti in verifiche/provenienza-remota-2026-11-08.json e verifiche/verifica-avvisi-2026-11-08.json.

## 8 novembre 2026 — Presentazione degli avvisi

Le intestazioni ripetute di index.html e 11 CSS sono ora conservate in frontend/legal/AVVISI-COMPONENTI.txt e richiamate da un commento neutro nei file. Il testo non e stato sostituito da un copyright Ishtar. Le licenze obbligatorie delle dipendenze sono preservate; il branding del pannello, il profilo e il dialog licenza mostrano Reda Zahloul e Ishtar Lab. Il nuovo audit richiesto e distinto dalla verifica di provenienza e non autorizza rimozioni di tutele o attribuzioni false.
