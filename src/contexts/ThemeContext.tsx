import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type Tema = 'claro' | 'escuro' | 'sistema'
const CHAVE = 'fertex-tema'
const COR_TEMA = { claro: '#4f46e5', escuro: '#0f172a' }

const media = () => window.matchMedia('(prefers-color-scheme: dark)')

function lerTema(): Tema {
  try {
    const t = localStorage.getItem(CHAVE)
    return t === 'claro' || t === 'escuro' ? t : 'sistema'
  } catch {
    return 'sistema'
  }
}

interface ThemeValue {
  tema: Tema
  escuro: boolean
  setTema: (t: Tema) => void
  /** Alterna claro → escuro → sistema */
  alternar: () => void
}

const ThemeContext = createContext<ThemeValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTemaState] = useState<Tema>(lerTema)
  const [sistemaEscuro, setSistemaEscuro] = useState(() => media().matches)

  useEffect(() => {
    const m = media()
    const f = (e: MediaQueryListEvent) => setSistemaEscuro(e.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])

  const escuro = tema === 'escuro' || (tema === 'sistema' && sistemaEscuro)

  // A classe .dark também é aplicada por um script no index.html antes do React (evita "piscar")
  useEffect(() => {
    document.documentElement.classList.toggle('dark', escuro)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', escuro ? COR_TEMA.escuro : COR_TEMA.claro)
  }, [escuro])

  const setTema = useCallback((t: Tema) => {
    setTemaState(t)
    try {
      if (t === 'sistema') localStorage.removeItem(CHAVE)
      else localStorage.setItem(CHAVE, t)
    } catch {
      /* ignora */
    }
  }, [])

  const alternar = useCallback(() => setTema(tema === 'claro' ? 'escuro' : tema === 'escuro' ? 'sistema' : 'claro'), [tema, setTema])

  const value = useMemo(() => ({ tema, escuro, setTema, alternar }), [tema, escuro, setTema, alternar])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme deve ser usado dentro de <ThemeProvider>')
  return ctx
}
