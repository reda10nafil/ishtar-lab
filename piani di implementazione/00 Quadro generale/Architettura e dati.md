---
title: "Architettura e dati"
updated: 2026-11-07
type: documentazione-progetto
tags: [ishtar-lab]
---

# Architettura e dati

## Componenti attuali

~~~mermaid
flowchart TD
    U[Utente - BAT] --> F[Pannello originale - 127.0.0.1:4273]
    F --> B[Ponte locale catalogo e foto]
    B --> A[API Medusa Mercur - 9273]
    A --> D[(PostgreSQL - 55730)]
    A --> R[(Redis - 56730)]
    A --> S[(Foto S3 - 59730)]
    F --> L[(Dati DEMO e preferenze nel browser)]
    A -. Futuri collegamenti verificati .-> E[Sito, analytics, pagamenti e servizi]
~~~

Il ponte ammette soltanto catalogo e upload, non tutte le API del backend. Credenziali e token di accesso restano lato server. La modalità è locale e a singolo proprietario; per esporla fuori dal computer serve un'architettura di accesso diversa.

## Cartelle e ruolo

| Percorso relativo alla radice redx | Contenuto |
|---|---|
| frontend/ishtar-lab/assets | Bundle originali compilati, pagine e stile da conservare |
| frontend/ishtar-lab/catalogo | Adattatore dati e strumenti nuovi coerenti con la UI |
| brand e frontend/brand | Monogramma e asset Ishtar, più riferimenti separati |
| backend/piattaforma/packages/api | API, moduli e workflow commerciali |
| backend/piattaforma/apps | Console/admin/vendor di supporto: non la UI scelta |
| backend/infra | Identità, avvio, isolamento e verifiche della copia |
| dati/sorgenti | Copia immutata del CSV fornito |
| outputs/ishtar-catalogo-20261106 | CSV DEMO e registro delle integrazioni fittizie |
| verifiche | Prove e backup dei file; non sono un backup completo del DB |
| Recupero-pannello-2026-11-06/originale | Salvataggio storico intoccabile, non da eseguire o distribuire |
| piani di implementazione | Questo vault; note, priorità, fonti e decisioni |

## Dove si trovano i dati

- Prodotti/varianti/offerte/scorte: strutture native Medusa/Mercur nel DB della copia.
- Attributi aggiuntivi articolo: metadati prodotto ishtar_v1.
- Definizioni dei campi e categorie: configurazione nei metadati dello store.
- Foto caricate: bucket ishtar-lab-assets sul volume della copia; un URL esterno resta esterno.
- Dashboard, ordini/clienti dimostrativi, altre liste e preferenze: salvataggio browser; non tutti i dati sono nel DB.
- Code/cache: Redis. Email locali: Mailpit, non consegna commerciale esterna.

## Identità e porte

Istanza ishtar-lab-redx; volumi ishtar_lab_redx_postgres, ishtar_lab_redx_redis e ishtar_lab_redx_storage. Pannello 4273, API 9273, DB 55730, Redis 56730, S3 59730, console S3 59731, Mailpit 58730/SMTP 51730. Tutte le pubblicazioni configurate sono su 127.0.0.1.

Nessun segreto viene copiato nel vault. La cartella originale fuori da redx e i suoi servizi devono restare intatti. Modificare uno SKU identificativo non è attualmente un flusso supportato dall'editor: serve una migrazione controllata, non una sostituzione silenziosa.

## Punti da migliorare

L'adattatore prende la prima variante; la lettura completa ha un limite di 10.000 prodotti e non è una ricerca paginata. La sequenza di salvataggio tra offerte/scorte/metadati necessita verifiche di atomicità e conflitti. I sorgenti della UI originale non sono stati recuperati come progetto ricompilabile. Vedere [[Catalogo e varianti]], [[Sicurezza backup e continuita]] e [[Interfaccia e qualita]].
