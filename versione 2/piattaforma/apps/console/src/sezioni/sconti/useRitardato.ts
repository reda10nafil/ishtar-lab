import { useEffect, useState } from "react"

/** Aspetta che l'utente smetta di scrivere prima di interrogare il server. */
export function useRitardato(valore: string, attesa = 250): string {
  const [ritardato, setRitardato] = useState(valore)
  useEffect(() => {
    const timer = setTimeout(() => setRitardato(valore), attesa)
    return () => clearTimeout(timer)
  }, [valore, attesa])
  return ritardato
}
