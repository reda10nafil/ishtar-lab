import { Component, type ErrorInfo, type ReactNode } from "react"

type Proprieta = { chiave: string; children: ReactNode }

/** Un errore in una sezione resta in quella sezione: menu e altre pagine continuano a funzionare. */
export class ConfineErrore extends Component<Proprieta, { errore: Error | null; chiave: string }> {
  state = { errore: null as Error | null, chiave: this.props.chiave }

  static getDerivedStateFromError(errore: Error) {
    return { errore }
  }

  static getDerivedStateFromProps(proprieta: Proprieta, stato: { errore: Error | null; chiave: string }) {
    return proprieta.chiave === stato.chiave ? null : { errore: null, chiave: proprieta.chiave }
  }

  componentDidCatch(errore: Error, info: ErrorInfo) {
    console.error(errore, info.componentStack)
  }

  render() {
    if (!this.state.errore) return this.props.children
    return <p className="avviso-stato avviso-stato--errore" role="alert">This page did not load. Reload it; if the problem persists, report it from Help.</p>
  }
}
