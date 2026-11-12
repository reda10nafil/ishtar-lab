# Ishtar Lab

L'applicazione di Multi Outfit: pannello amministratore, portale aziende, team con ruoli, registro delle modifiche, connettori.

## Linguaggi

- Front-end (`piattaforma/apps/console/`): TypeScript con React 18 e Vite, CSS proprio.
- Back-end (`piattaforma/packages/api/`): TypeScript su Node.js (eseguito con Bun), framework Medusa 2 con Mercur 2.4.1, PostgreSQL e Redis.

## Avvio e stop

```bash
powershell -ExecutionPolicy Bypass -File avvia.ps1
```

```bash
powershell -ExecutionPolicy Bypass -File ferma.ps1
```

| Cosa | Indirizzo |
| --- | --- |
| Console Ishtar Lab | http://localhost:5180 |
| Pannello Mercur | http://localhost:9100/dashboard |
| Portale Mercur | http://localhost:9100/seller |
| Email di prova | http://127.0.0.1:58500 |

L'accesso amministratore è in `.credenziali-locali.env`, escluso da Git.

Il connettore «Servizio di prova» usa `app-di-prova` e `segreto-di-prova`: non esiste in produzione.

## Struttura

- `infra/`: servizi Docker e prove automatiche.
- `piattaforma/packages/api/`: backend Mercur con i moduli `connectors` e `permessi` (ruoli, registro).
- `piattaforma/apps/console/`: interfaccia di Ishtar Lab, in codice proprio.

## Prove

```bash
node infra/prova-servizi.mjs
```

```bash
node infra/prova-isolamento.mjs
```

```bash
node infra/prova-connettori.mjs
```

```bash
node infra/prova-team.mjs
```

```bash
node infra/prova-console.mjs
```

## Prima di andare online

- Togliere i dati dimostrativi e il servizio di prova.
- Cambiare ogni segreto e impostare `PUBLIC_BACKEND_URL` su HTTPS.
- Aggiungere limiti ai tentativi di accesso.
