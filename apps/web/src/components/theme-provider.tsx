import * as React from "react"

type Theme = "dark" | "light"

const ThemeContext = React.createContext<{ theme: Theme; setTheme: (t: Theme) => void } | undefined>(undefined)
const KEY = "serveryar-theme"

function readTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark"
  } catch {
    return "dark"
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(readTheme)

  React.useEffect(() => {
    const root = document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(theme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#141427" : "#f1f2fb")
  }, [theme])

  const setTheme = React.useCallback((t: Theme) => {
    try {
      localStorage.setItem(KEY, t)
    } catch {
      /* private mode */
    }
    setThemeState(t)
  }, [])

  const value = React.useMemo(() => ({ theme, setTheme }), [theme, setTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider")
  return ctx
}
