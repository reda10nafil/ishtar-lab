export function Interruttore({ acceso, etichetta, disattivo, onCambia }: { acceso: boolean; etichetta: string; disattivo?: boolean; onCambia: (acceso: boolean) => void }) {
  return <button type="button" className="interruttore" role="switch" aria-checked={acceso} aria-label={etichetta} disabled={disattivo} onClick={() => onCambia(!acceso)} />
}
