import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import { Direction } from "radix-ui"

import "./index.css"
import App from "./App.tsx"
import { queryClient } from "@/lib/api"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <Direction.Provider dir="rtl">
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={200}>
            <BrowserRouter>
              <App />
            </BrowserRouter>
            <Toaster position="bottom-left" dir="rtl" richColors />
          </TooltipProvider>
        </QueryClientProvider>
      </Direction.Provider>
    </ThemeProvider>
  </StrictMode>,
)
