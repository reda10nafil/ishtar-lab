---
title: "Stato delle funzioni"
updated: 2026-11-12
type: documentazione-progetto
tags: [ishtar-lab]
---

# Stato delle funzioni

## Come leggere gli stati

**Operativo verificato**: provato nel flusso indicato. **Parziale**: una parte funziona, manca il ciclo completo. **Demo**: la UI usa dati nel browser. **Codice presente**: esiste nel backend ma non prova l'integrazione nel primo pannello. **Proposto**: lavoro futuro.

| Area | Stato | Evidenza o limite |
|---|---|---|
| Avvio BAT | Operativo verificato a servizi già attivi | Test --no-browser, nessuna API duplicata; avvio a freddo da provare. Prova del 7/11 sul codice precedente: da ripetere dopo le modifiche del 12/11 a launcher e preparazione |
| Avvio su Linux (script .sh) | Operativo verificato su Ubuntu 26.04 il 12/11 | Preparazione a macchina pulita, avvio, arresto e riavvio con dati conservati, import demo e test; macOS e avvio dopo riavvio del sistema non provati |
| Isolamento servizi | Verificato storicamente | Porte e volumi dedicati, progetto originale preservato |
| Branding Ishtar Lab e logo | Applicato | Nessun sottotitolo Ishtar Hub sotto il nome dell'app |
| Design e navigazione | 28 pagine verificate | Titolo/componenti visibili, non prova dei flussi reali |
| Prodotti e categorie | Operativo verificato | 82 record DEMO in DB, otto categorie |
| Creazione/modifica articolo | Operativo verificato | Prodotto temporaneo creato, verificato e rimosso |
| Campi configurabili | Operativo verificato / parziale | 14 definizioni; campo numerico altezza provato |
| Quantità inventario | Operativo verificato / parziale | Incremento in tabella, riscontro DB e ripristino |
| Foto locali | Operativo verificato | Upload e lettura PNG dal bucket dedicato |
| Foto remote | Parziale | Link conservato; download e associazione non verificati |
| CSV da pulsante | Operativo verificato | Anteprima e reimportazione 82 SKU senza duplicati |
| CSV trascinato | Implementato, prova fisica mancante | Handler documentato, non simulare un esito non osservato |
| Varianti multiple nella stessa scheda | Proposto nell'adattatore | API attuale espone la prima variante |
| Movimenti, riserve, depositi | Codice backend presente | Da integrare e provare nel primo pannello |
| Dashboard e analisi vendite | Demo | Dati browser, non risultati commerciali reali |
| Visite, conversioni e funnel | Demo / integrazione proposta | Nessuna acquisizione dal sito accertata |
| Ordini, resi e cassa | Demo | Nessun ciclo reale di pagamento/spedizione provato |
| Clienti e segmenti | Demo + codice backend | API riutilizzabili, dati demo nel pannello |
| Sconti, gift card e ingrosso | Demo + codice backend | Richiedono integrazione e prove specifiche |
| Campagne e automazioni | Demo | Nessun invio o attività periodica attivata |
| Vetrina online | Anteprima demo | Non un sito pubblicato né un editor operativo |
| Connettori OAuth/API | Codice presente | Nessun account reale/sync verificato qui |
| Ricerca mercato | Proposta | Mancano acquisizione, matching e storico delle fonti |
| Backup completo recuperabile | Non verificato | Snapshot dei file non equivale a backup DB+foto ripristinabile |
| Licenza personale Ishtar | Testo compilato, perimetro limitato | Titolare Reda Zahloul e recapito presenti; diritti terzi e consegna/accettazione da verificare |

Le prove funzionali qui richiamate sono quelle registrate il 7 novembre e, per l'avvio su Linux, il 12 novembre (verifiche/avvio-linux-2026-11-12.json); non sono state tutte rieseguite. Numeri e configurazioni sono una fotografia, non un monitoraggio continuo.

Per le prove: [[Verifiche e fonti]]. Per gli interventi: [[Backlog completo]].
