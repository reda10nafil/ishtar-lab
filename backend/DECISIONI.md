# Decisioni prese in autonomia

Il 6 novembre 2026 l'utente ha chiesto di procedere senza fermarsi. Ogni voce si può cambiare.

| Argomento | Decisione | Motivo | Come cambiarla |
| --- | --- | --- | --- |
| Interfaccia | Interfaccia originale, in codice proprio | Il clone minificato non è estendibile | Nessun vincolo |
| Connettori | Pagina a schede ispirata allo schema della pagina Apps | Richiesta dell'utente | Nessun vincolo |
| Priorità | Vendite, checkout, Stripe e sito per ultimi | Richiesta dell'utente | Riordinare le fasi |
| Paese e valuta | Italia, euro, italiano | Valore iniziale ragionevole | Impostazioni del negozio |
| Modello | Multi Outfit è il rivenditore, le aziende sono fornitori | Risposta dell'utente | Da rivedere con il commercialista |
| Logistica | Ogni azienda tiene la merce e spedisce | Risposta dell'utente | Si può aggiungere un magazzino |
| Ambiente | Servizi Docker dedicati, solo su 127.0.0.1 | Non interferire con Postiz, ChatbotX e n8n | `infra/compose.yaml` |
| Base | Mercur 2.4.1 su Medusa, versione fissata | Portale aziende e revisione prodotti confermati dalle prove | `piattaforma/` |
| Prodotti | Ogni prodotto è legato all'azienda che lo crea | Le altre aziende non devono vederlo | Evento `product.created` |
| Telemetria | Disattivata | Nessun dato inviato a terzi | Variabili d'ambiente |
| Controllo del follow | Non attivo | Rischio con le regole Meta | Scelta dell'utente |

## Porte usate

| Servizio | Porta locale |
| --- | --- |
| PostgreSQL | 55500 |
| Redis | 56500 |
| Archivio file | 59500 |
| Console archivio | 59501 |
| Email di prova | 58500 |
| Invio email di prova | 51500 |
