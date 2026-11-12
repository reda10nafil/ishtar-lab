import { ImagePlus, X } from "lucide-react"
import { useState, type ChangeEvent } from "react"
import { caricaFoto } from "./dati"

const MASSIMO_IMMAGINE = 8 * 1024 * 1024

type Proprieta = {
  radice: "/admin" | "/vendor"
  foto: { url: string }[]
  onCambia: (foto: { url: string }[]) => void
  onCaricamento: (attivo: boolean) => void
}

export function GalleriaFoto({ radice, foto, onCambia, onCaricamento }: Proprieta) {
  const [caricamento, setCaricamento] = useState(false)
  const [errore, setErrore] = useState("")

  const segnala = (attivo: boolean) => {
    setCaricamento(attivo)
    onCaricamento(attivo)
  }

  const carica = async (e: ChangeEvent<HTMLInputElement>) => {
    const scelti = Array.from(e.target.files ?? [])
    e.target.value = ""
    if (!scelti.length) return
    setErrore("")
    if (scelti.some((f) => !f.type.startsWith("image/") || f.size > MASSIMO_IMMAGINE)) {
      setErrore("Images only, up to 8 MB")
      return
    }
    segnala(true)
    try {
      onCambia([...foto, ...(await caricaFoto(radice, scelti))])
    } catch (motivo) {
      setErrore((motivo as Error).message)
    } finally {
      segnala(false)
    }
  }

  return (
    <div className="campo">
      <span>Photos</span>
      <div className="galleria">
        {foto.map((f) => (
          <span key={f.url} className="galleria__voce">
            <img src={f.url} alt="" />
            <button type="button" className="icona-pulsante" aria-label="Remove photo" onClick={() => onCambia(foto.filter((x) => x.url !== f.url))}>
              <X size={14} aria-hidden="true" />
            </button>
          </span>
        ))}
        <label className="galleria__aggiungi">
          <ImagePlus size={22} aria-hidden="true" />
          <span>{caricamento ? "Uploading..." : "Add"}</span>
          <input type="file" accept="image/*" multiple className="nascosto" aria-label="Add photo" onChange={(e) => void carica(e)} />
        </label>
      </div>
      {foto.length > 1 ? <small>The first photo is the cover.</small> : null}
      {errore ? <small className="testo-errore" role="alert">{errore}</small> : null}
    </div>
  )
}
