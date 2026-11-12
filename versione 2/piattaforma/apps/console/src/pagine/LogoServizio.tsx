const FORMATI: Record<string, string> = {
  sendcloud: "png",
  "fatture-in-cloud": "png",
}

/** Logo a colori del servizio, salvato in public/loghi. Il servizio di prova non ha un marchio. */
export function LogoServizio({ id, nome }: { id: string; nome: string }) {
  return (
    <span className="connettore__icona" aria-hidden="true">
      {id === "demo" ? nome.charAt(0) : <img src={`/loghi/${id}.${FORMATI[id] ?? "svg"}`} alt="" width="52" height="52" loading="lazy" />}
    </span>
  )
}
