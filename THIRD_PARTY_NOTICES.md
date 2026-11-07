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
