import crypto from "node:crypto"

const ALGORITMO = "aes-256-gcm"
const LUNGHEZZA_IV = 12
// Controllo di integrità sempre intero: con un tag accorciato (fino a 4 byte) falsificare il dato diventa molto più facile.
const LUNGHEZZA_TAG = 16

function chiave(hex: string): Buffer {
  const buffer = Buffer.from(hex ?? "", "hex")
  if (buffer.length !== 32) throw new Error("CONNECTORS_KEY must be a 32-byte hexadecimal key")
  return buffer
}

/** Chiave mancante o scritta male: errore di configurazione, da distinguere da un dato che non si decifra. */
export function controllaChiave(chiaveHex: string): void {
  chiave(chiaveHex)
}

/** Cifra con AES-256-GCM: formato `v1.iv.tag.dati`, tutto in base64url. */
export function cifra(testo: string, chiaveHex: string): string {
  const iv = crypto.randomBytes(12)
  const cifrario = crypto.createCipheriv(ALGORITMO, chiave(chiaveHex), iv)
  const dati = Buffer.concat([cifrario.update(testo, "utf8"), cifrario.final()])
  return ["v1", iv, cifrario.getAuthTag(), dati].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".")
}

export function decifra(valore: string, chiaveHex: string): string {
  const [versione, iv, tag, dati] = valore.split(".")
  if (versione !== "v1" || !iv || !tag || dati === undefined) throw new Error("Invalid encrypted format")
  const vettore = Buffer.from(iv, "base64url")
  const controllo = Buffer.from(tag, "base64url")
  if (vettore.length !== LUNGHEZZA_IV || controllo.length !== LUNGHEZZA_TAG) throw new Error("Invalid encrypted format")
  const decifrario = crypto.createDecipheriv(ALGORITMO, chiave(chiaveHex), vettore, { authTagLength: LUNGHEZZA_TAG })
  decifrario.setAuthTag(controllo)
  return Buffer.concat([decifrario.update(Buffer.from(dati, "base64url")), decifrario.final()]).toString("utf8")
}
