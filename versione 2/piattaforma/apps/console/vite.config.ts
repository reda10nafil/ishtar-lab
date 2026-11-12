import fs from "node:fs"
import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

const BACKEND = "http://127.0.0.1:9100"
const CREDENZIALI = path.resolve(__dirname, "../../../.credenziali-locali.env")

function leggiCredenziali() {
  const righe = fs.readFileSync(CREDENZIALI, "utf8").trim().split(/\r?\n/)
  return Object.fromEntries(righe.map((riga) => riga.split(/=(.*)/s).slice(0, 2)))
}

/**
 * Su questo PC l'app si apre senza email e password: il server di sviluppo entra come
 * proprietario e passa al browser solo il token, mai la password. Esiste solo in sviluppo
 * (`apply: "serve"`): una versione compilata per Internet non contiene questo passaggio.
 */
function accessoLocale(): Plugin {
  return {
    name: "accesso-locale",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__accesso-locale", async (req, res) => {
        // Solo le pagine dell'app stessa: un altro sito aperto nel browser non può chiederlo.
        if (req.headers["sec-fetch-site"] !== "same-origin") {
          res.statusCode = 403
          res.end()
          return
        }
        try {
          const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = leggiCredenziali()
          const risposta = await fetch(`${BACKEND}/auth/user/emailpass`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, password }),
          })
          if (!risposta.ok) throw new Error(`Backend: ${risposta.status}`)
          const { token } = (await risposta.json()) as { token: string }
          res.setHeader("content-type", "application/json")
          res.setHeader("cache-control", "no-store")
          res.end(JSON.stringify({ token, email }))
        } catch {
          // Di solito il backend sta ripartendo: la pagina riprova da sola.
          res.statusCode = 503
          res.end()
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), accessoLocale()],
  server: { host: "localhost", port: 5180, strictPort: true },
  preview: { host: "localhost", port: 5180, strictPort: true },
})
