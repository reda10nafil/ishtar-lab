import net from "node:net"

/*
 * Server IMAP finto per le prove (solo node:net, nessun download): il sottoinsieme che imapflow usa con un server che
 * annuncia solo IMAP4rev1 (LOGIN, CAPABILITY, LIST, LSUB, SELECT/EXAMINE, UID SEARCH, FETCH e UID FETCH, NOOP, LOGOUT).
 * Come un server vero, «n:*» comprende sempre l'ultimo messaggio anche se n lo supera (RFC 9051 §6.4.9).
 * `comandi` registra ogni comando (senza la password): serve a provare che il lettore non modifica mai la casella.
 */

export type EmailFinta = { uid: number; grezzo: Buffer; internaldate: Date; flags: string[] }
/**
 * `fetchRifiutato`: UID il cui contenuto il server non riesce a dare (NO alla FETCH del contenuto che lo comprende);
 * `fetchSenza`: UID che il server salta senza errore in ogni FETCH (sparito o illeggibile); `loginTemporaneo`: accesso
 * rifiutato per un guasto passeggero (NO [UNAVAILABLE]).
 */
export type Guasti = {
  rifiutaLogin?: boolean
  loginTemporaneo?: boolean
  chiudiAlFetch?: boolean
  senzaUidnext?: boolean
  fetchRifiutato?: number[]
  fetchSenza?: number[]
}
export type ImapFinto = {
  porta: number
  comandi: string[]
  uidvalidity: number
  uidnext: number
  messaggi: EmailFinta[]
  guasti: Guasti
  aggiungi: (grezzo: string | Buffer, internaldate?: Date) => number
  nuovaUidvalidity: (valore: number) => void
  chiudi: () => Promise<void>
}

const MESI = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const dataImap = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, "0")}-${MESI[d.getUTCMonth()]}-${d.getUTCFullYear()} ${d.toISOString().slice(11, 19)} +0000`

/** Elementi di un comando IMAP: atomi, stringhe fra virgolette, letterali già letti, liste fra parentesi (come testo). */
function elementi(testo: string): string[] {
  const fuori: string[] = []
  let i = 0
  while (i < testo.length) {
    const c = testo[i]
    if (c === " ") { i++; continue }
    if (c === '"') {
      let s = ""
      i++
      while (i < testo.length && testo[i] !== '"') { if (testo[i] === "\\") i++; s += testo[i++] }
      i++
      fuori.push(s)
    } else if (c === "(") {
      let profondita = 0, s = ""
      do { if (testo[i] === "(") profondita++; if (testo[i] === ")") profondita--; s += testo[i++] } while (i < testo.length && profondita > 0)
      fuori.push(s)
    } else {
      let s = ""
      while (i < testo.length && testo[i] !== " ") s += testo[i++]
      fuori.push(s)
    }
  }
  return fuori
}

function nelInsieme(insieme: string, uid: number, massimo: number): boolean {
  return insieme.split(",").some((parte) => {
    const [a, b] = parte.split(":")
    const n = (x: string) => (x === "*" ? massimo : Number(x))
    if (b === undefined) return uid === n(a)
    const [da, a2] = [n(a), n(b)].sort((x, y) => x - y)
    return uid >= da && uid <= a2
  })
}

export async function avviaImapFinto({ utente, password, uidvalidity = 1700000000 }: { utente: string; password: string; uidvalidity?: number }): Promise<ImapFinto> {
  const finto: ImapFinto = {
    porta: 0,
    comandi: [],
    uidvalidity,
    uidnext: 1,
    messaggi: [],
    guasti: {},
    aggiungi(grezzo, internaldate = new Date()) {
      const uid = finto.uidnext++
      finto.messaggi.push({ uid, grezzo: Buffer.isBuffer(grezzo) ? grezzo : Buffer.from(grezzo), internaldate, flags: [] })
      return uid
    },
    nuovaUidvalidity(valore) {
      finto.uidvalidity = valore
    },
    chiudi: () => new Promise((ok) => { for (const s of prese) s.destroy(); server.close(() => ok()) }),
  }
  const prese = new Set<net.Socket>()

  const server = net.createServer((presa) => {
    prese.add(presa)
    presa.on("close", () => prese.delete(presa))
    presa.on("error", () => {})
    let buffer = Buffer.alloc(0)
    let attesaLetterale = 0
    let parziale = ""
    let selezionata = false
    const scrivi = (s: string | Buffer) => { if (!presa.destroyed) presa.write(s) }
    scrivi("* OK [CAPABILITY IMAP4rev1] Finto pronto\r\n")

    const esegui = (riga: string) => {
      const [tag, nomeGrezzo, ...resto] = elementi(riga)
      if (!tag || !nomeGrezzo) return
      let nome = nomeGrezzo.toUpperCase()
      let argomenti = resto
      if (nome === "UID") { nome = `UID ${(argomenti[0] ?? "").toUpperCase()}`; argomenti = argomenti.slice(1) }
      finto.comandi.push(nome === "LOGIN" ? `LOGIN ${argomenti[0]} ***` : [nome, ...argomenti].join(" "))
      const ok = (testo = `${nome} completed`) => scrivi(`${tag} OK ${testo}\r\n`)
      const massimo = Math.max(0, ...finto.messaggi.map((m) => m.uid))
      switch (nome) {
        case "CAPABILITY": scrivi("* CAPABILITY IMAP4rev1\r\n"); return ok()
        case "NOOP": return ok()
        case "LOGIN":
          if (finto.guasti.loginTemporaneo) return scrivi(`${tag} NO [UNAVAILABLE] Temporary authentication failure\r\n`)
          if (finto.guasti.rifiutaLogin || argomenti[0] !== utente || argomenti[1] !== password) return scrivi(`${tag} NO [AUTHENTICATIONFAILED] Invalid credentials\r\n`)
          return ok("[CAPABILITY IMAP4rev1] LOGIN completed")
        case "LIST":
          if ((argomenti[1] ?? "") === "") scrivi('* LIST (\\Noselect) "/" ""\r\n')
          else scrivi('* LIST (\\HasNoChildren) "/" INBOX\r\n')
          return ok()
        case "LSUB": scrivi('* LSUB () "/" INBOX\r\n'); return ok()
        case "SELECT":
        case "EXAMINE": {
          if ((argomenti[0] ?? "").toUpperCase() !== "INBOX") return scrivi(`${tag} NO [NONEXISTENT] No such mailbox\r\n`)
          selezionata = true
          scrivi(`* ${finto.messaggi.length} EXISTS\r\n* 0 RECENT\r\n* FLAGS (\\Seen \\Answered \\Flagged \\Deleted \\Draft)\r\n`)
          scrivi(`* OK [PERMANENTFLAGS ()] No permanent flags\r\n* OK [UIDVALIDITY ${finto.uidvalidity}] UIDs valid\r\n`)
          if (!finto.guasti.senzaUidnext) scrivi(`* OK [UIDNEXT ${finto.uidnext}] Predicted next UID\r\n`)
          return ok(`[${nome === "EXAMINE" ? "READ-ONLY" : "READ-WRITE"}] ${nome} completed`)
        }
        case "UID SEARCH": {
          if (!selezionata) return scrivi(`${tag} BAD No mailbox selected\r\n`)
          const criteri = argomenti.map((a) => a.toUpperCase())
          let trovati = finto.messaggi
          const iUid = criteri.indexOf("UID")
          if (iUid >= 0) trovati = trovati.filter((m) => nelInsieme(argomenti[iUid + 1], m.uid, massimo))
          const iDa = criteri.indexOf("SINCE")
          if (iDa >= 0) {
            const [g, mese, anno] = argomenti[iDa + 1].split("-")
            const da = Date.UTC(Number(anno), MESI.indexOf(mese), Number(g))
            trovati = trovati.filter((m) => m.internaldate.getTime() >= da)
          }
          scrivi(`* SEARCH${trovati.map((m) => ` ${m.uid}`).join("")}\r\n`)
          return ok()
        }
        case "FETCH":
        case "UID FETCH": {
          if (!selezionata) return scrivi(`${tag} BAD No mailbox selected\r\n`)
          if (finto.guasti.chiudiAlFetch) { presa.destroy(); return }
          const insieme = argomenti[0]
          const voci = (argomenti[1] ?? "").replace(/^\(|\)$/g, "").toUpperCase()
          const conContenuto = voci.includes("BODY.PEEK[]") || voci.includes("BODY[]")
          const scelto = (m: EmailFinta, i: number) => (nome === "FETCH" ? nelInsieme(insieme, i + 1, finto.messaggi.length) : nelInsieme(insieme, m.uid, massimo))
          if (conContenuto && finto.messaggi.some((m, i) => scelto(m, i) && finto.guasti.fetchRifiutato?.includes(m.uid))) {
            return scrivi(`${tag} NO Some messages could not be FETCHed (Failure)\r\n`)
          }
          finto.messaggi.forEach((m, i) => {
            if (finto.guasti.fetchSenza?.includes(m.uid)) return
            // FETCH senza UID: l'insieme indica i numeri d'ordine dei messaggi (1 = il primo), «*» l'ultimo.
            if (!scelto(m, i)) return
            const parti: (string | Buffer)[] = [`* ${i + 1} FETCH (UID ${m.uid}`]
            if (voci.includes("RFC822.SIZE")) parti.push(` RFC822.SIZE ${m.grezzo.length}`)
            if (voci.includes("INTERNALDATE")) parti.push(` INTERNALDATE "${dataImap(m.internaldate)}"`)
            if (voci.includes("FLAGS")) parti.push(` FLAGS (${m.flags.join(" ")})`)
            if (voci.includes("BODY.PEEK[HEADER]") || voci.includes("BODY[HEADER]")) {
              const fine = m.grezzo.indexOf("\r\n\r\n")
              const testata = fine >= 0 ? m.grezzo.subarray(0, fine + 4) : m.grezzo
              parti.push(` BODY[HEADER] {${testata.length}}\r\n`, testata)
            } else if (voci.includes("BODY.PEEK[]") || voci.includes("BODY[]")) {
              parti.push(` BODY[] {${m.grezzo.length}}\r\n`, m.grezzo)
            }
            parti.push(")\r\n")
            for (const p of parti) scrivi(p)
          })
          return ok()
        }
        case "LOGOUT": scrivi("* BYE Finto chiude\r\n"); ok(); presa.end(); return
        default: return scrivi(`${tag} BAD Command not supported by the fake server\r\n`)
      }
    }

    presa.on("data", (pezzo: Buffer) => {
      buffer = Buffer.concat([buffer, pezzo])
      for (;;) {
        if (attesaLetterale > 0) {
          if (buffer.length < attesaLetterale) return
          parziale += `"${buffer.subarray(0, attesaLetterale).toString("utf8").replace(/["\\]/g, "\\$&")}"`
          buffer = buffer.subarray(attesaLetterale)
          attesaLetterale = 0
          continue
        }
        const fine = buffer.indexOf("\r\n")
        if (fine < 0) return
        const riga = buffer.subarray(0, fine).toString("utf8")
        buffer = buffer.subarray(fine + 2)
        const letterale = /\{(\d+)\+?\}$/.exec(riga)
        if (letterale) {
          parziale += riga.slice(0, letterale.index)
          attesaLetterale = Number(letterale[1])
          if (!riga.endsWith("+}")) scrivi("+ Ready for literal\r\n")
          continue
        }
        const completa = parziale + riga
        parziale = ""
        esegui(completa)
      }
    })
  })
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", () => ok()))
  finto.porta = (server.address() as net.AddressInfo).port
  return finto
}
