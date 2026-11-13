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
| Creazione/modifica articolo | Operativo verificato | Prodotto temporaneo creato, verificato e rimosso. Dal 12/11 (proposta satria64) salvataggio «tutto o niente» in un solo workflow, provato con guasti provocati; lucchetto per prodotto e SKU. Dal 13/11 solo i campi cambiati, con conflitto se cambiati altrove |
| Campi configurabili | Operativo verificato / parziale | 14 definizioni; campo numerico altezza provato. Dal 12/11 (proposta satria64) un obbligatorio aggiunto dopo non blocca i prodotti esistenti |
| Quantità inventario | Operativo verificato / parziale | Incremento in tabella, riscontro DB e ripristino. Dal 13/11 (proposta satria64) variazioni sommate con storico del Magazzino, conteggio dalla scheda e dal CSV, in arrivo e riordino nel magazzino; provato con due finestre |
| Foto locali | Operativo verificato | Upload e lettura PNG dal bucket dedicato |
| Foto remote | Parziale | Link conservato; download e associazione non verificati |
| CSV da pulsante | Operativo verificato | Anteprima e reimportazione 82 SKU senza duplicati. Dal 12/11 (proposta satria64) l'aggiornamento conserva i dati non presenti nel file e legge i numeri con le migliaia |
| CSV trascinato | Implementato, prova fisica mancante | Handler documentato, non simulare un esito non osservato |
| Server del catalogo spento | Operativo verificato il 12/11 (proposta satria64) | Modifiche in coda salvate al ritorno del server senza coprire quelle fatte altrove, ricollegamento automatico, avviso fisso con il motivo, import bloccato con salvataggi in attesa; provato in Chrome headless con l'API fermata, non su Windows. Due finestre sugli stessi campi: vale l'ultimo salvataggio |
| Varianti multiple nella stessa scheda | Proposto nell'adattatore | API attuale espone la prima variante |
| Movimenti, riserve, depositi | Codice backend presente | Da integrare e provare nel primo pannello |
| Dashboard e analisi vendite | Demo | Dati browser, non risultati commerciali reali. Dal 12/11 (proposta satria64) cassa, ordini e resi dimostrativi non modificano più le scorte reali |
| Visite, conversioni e funnel | Demo / integrazione proposta | Nessuna acquisizione dal sito accertata |
| Ordini, resi e cassa | Demo | Nessun ciclo reale di pagamento/spedizione provato |
| Clienti e segmenti | Demo + codice backend | API riutilizzabili, dati demo nel pannello |
| Sconti, gift card e ingrosso | Demo + codice backend | Richiedono integrazione e prove specifiche |
| Campagne e automazioni | Demo | Nessun invio o attività periodica attivata |
| Vetrina online | Anteprima demo | Non un sito pubblicato né un editor operativo |
| Connettori OAuth/API | Codice presente | Nessun account reale/sync verificato qui. Dal 12/11 (proposta satria64) una credenziale illeggibile è segnalata senza bloccare elenco e rinnovo; tag AES-GCM a 16 byte |
| Costo d'acquisto e negozio online | Corretto il 12/11 (proposta satria64) | Costo solo con il permesso sui margini; scheda interna Ishtar fuori da `/store`; script di pulizia per i prodotti già salvati da eseguire una volta |
| Ricerca mercato | Proposta | Mancano acquisizione, matching e storico delle fonti |
| Backup completo recuperabile | Non verificato | Snapshot dei file non equivale a backup DB+foto ripristinabile |
| Licenza personale Ishtar | Testo compilato, perimetro limitato | Titolare Reda Zahloul e recapito presenti; diritti terzi e consegna/accettazione da verificare |

Le prove funzionali qui richiamate sono quelle registrate il 7 novembre e, per l'avvio su Linux e le proposte successive, il 12 novembre (verifiche/avvio-linux-2026-11-12.json, correzioni-dati-csv-2026-11-12.json, affidabilita-salvataggi-2026-11-12.json); non sono state tutte rieseguite. Numeri e configurazioni sono una fotografia, non un monitoraggio continuo.

Per le prove: [[Verifiche e fonti]]. Per gli interventi: [[Backlog completo]].
