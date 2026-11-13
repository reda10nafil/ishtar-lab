import net from "node:net"

/*
 * Server SMTP finto per le prove (solo node:net): login PLAIN e LOGIN, consegne registrate e guasti governabili, anche
 * la caduta della connessione dopo il contenuto (DATA), il caso in cui chi invia non sa se il messaggio è arrivato.
 */

export type Modo = "ok" | "rcpt550" | "dati554" | "cadeDopoDati" | "lento" | "auth454" | "chiudeSubito"
export type Consegna = { da: string; a: string[]; grezzo: string }
export type SmtpFinto = { porta: number; consegne: Consegna[]; modo: Modo; comandi: string[]; chiudi: () => Promise<void> }

export async function avviaSmtpFinto({ utente, password, conAuth = true }: { utente: string; password: string; conAuth?: boolean }): Promise<SmtpFinto> {
  const prese = new Set<net.Socket>()
  const finto: SmtpFinto = {
    porta: 0,
    consegne: [],
    modo: "ok",
    comandi: [],
    chiudi: () => new Promise((ok) => { for (const s of prese) s.destroy(); server.close(() => ok()) }),
  }
  const server = net.createServer((presa) => {
    prese.add(presa)
    presa.on("close", () => prese.delete(presa))
    presa.on("error", () => {})
    // Server che accetta la connessione e la chiude prima del saluto (bilanciatore senza server dietro).
    if (finto.modo === "chiudeSubito") { presa.destroy(); return }
    let buffer = ""
    let dati: string | null = null
    let da = ""
    let a: string[] = []
    let autenticato = !conAuth
    let attesaLogin: "utente" | "password" | null = null
    let utenteLogin = ""
    const scrivi = (s: string) => { if (!presa.destroyed) presa.write(`${s}\r\n`) }
    const verifica = (u: string, p: string) => {
      if (finto.modo === "auth454") return scrivi("454 4.7.0 Temporary authentication failure, try again later")
      autenticato = u === utente && p === password
      scrivi(autenticato ? "235 2.7.0 Authentication successful" : "535 5.7.8 Authentication failed")
    }
    scrivi("220 finto ESMTP")

    const comando = (riga: string) => {
      if (attesaLogin === "utente") { utenteLogin = Buffer.from(riga, "base64").toString(); attesaLogin = "password"; return scrivi("334 UGFzc3dvcmQ6") }
      if (attesaLogin === "password") { attesaLogin = null; return verifica(utenteLogin, Buffer.from(riga, "base64").toString()) }
      const [verbo, ...resto] = riga.split(" ")
      const nome = verbo.toUpperCase()
      finto.comandi.push(nome === "AUTH" ? `AUTH ${resto[0]} ***` : riga)
      if (nome === "EHLO" || nome === "HELO") return scrivi(conAuth ? "250-finto\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME" : "250-finto\r\n250 8BITMIME")
      if (nome === "AUTH" && resto[0]?.toUpperCase() === "PLAIN") {
        const [, u, p] = Buffer.from(resto[1] ?? "", "base64").toString().split("\u0000")
        return verifica(u ?? "", p ?? "")
      }
      if (nome === "AUTH" && resto[0]?.toUpperCase() === "LOGIN") { attesaLogin = "utente"; return scrivi("334 VXNlcm5hbWU6") }
      if (nome === "MAIL") {
        if (!autenticato) return scrivi("530 5.7.0 Authentication required")
        da = /<([^>]*)>/.exec(riga)?.[1] ?? ""
        a = []
        return scrivi("250 2.1.0 Ok")
      }
      if (nome === "RCPT") {
        if (finto.modo === "rcpt550") return scrivi("550 5.1.1 User unknown")
        a.push(/<([^>]*)>/.exec(riga)?.[1] ?? "")
        return scrivi("250 2.1.5 Ok")
      }
      if (nome === "DATA") { dati = ""; return scrivi("354 End data with <CR><LF>.<CR><LF>") }
      if (nome === "RSET") return scrivi("250 2.0.0 Ok")
      if (nome === "NOOP") return scrivi("250 2.0.0 Ok")
      if (nome === "QUIT") { scrivi("221 2.0.0 Bye"); presa.end(); return }
      return scrivi("502 5.5.2 Command not recognized")
    }

    presa.on("data", (pezzo: Buffer) => {
      buffer += pezzo.toString("utf8")
      for (;;) {
        if (dati !== null) {
          const fine = buffer.indexOf("\r\n.\r\n")
          if (fine < 0) return
          dati += buffer.slice(0, fine)
          buffer = buffer.slice(fine + 5)
          const grezzo = dati.replace(/\r\n\.\./g, "\r\n.")
          dati = null
          if (finto.modo === "cadeDopoDati") { presa.destroy(); return }
          if (finto.modo === "dati554") { scrivi("554 5.7.1 Message rejected"); continue }
          finto.consegne.push({ da, a: [...a], grezzo })
          if (finto.modo === "lento") { setTimeout(() => scrivi("250 2.0.0 Ok: queued"), 1500); continue }
          scrivi("250 2.0.0 Ok: queued")
          continue
        }
        const fine = buffer.indexOf("\r\n")
        if (fine < 0) return
        const riga = buffer.slice(0, fine)
        buffer = buffer.slice(fine + 2)
        comando(riga)
      }
    })
  })
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", () => ok()))
  finto.porta = (server.address() as net.AddressInfo).port
  return finto
}
