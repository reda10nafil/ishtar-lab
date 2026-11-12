import "@fontsource-variable/urbanist"
import "./stili/base.css"
import "./stili/componenti.css"
import "./stili/pagine.css"
import "./stili/elementi.css"
import "./tema"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import App from "./App"
import { ProviderAvvisi } from "./componenti"
import { ProviderSessione } from "./sessione"

const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 5000, refetchOnWindowFocus: true, refetchInterval: 20_000 } },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <ProviderSessione>
        <ProviderAvvisi>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ProviderAvvisi>
      </ProviderSessione>
    </QueryClientProvider>
  </StrictMode>
)
