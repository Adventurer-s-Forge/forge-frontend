import { useCallback, useEffect, useState } from "react";

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const DARK_Q = '(prefers-color-scheme: dark)'

function storedTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch {
    return null
  }
}

function systemTheme(): Theme {
  return window.matchMedia(DARK_Q).matches ? 'dark' : 'light'
}

export function useTheme() {
  const [choice, setChoice] = useState<Theme | null>(storedTheme)
  const [system, setSystem] = useState<Theme>(systemTheme)

  useEffect(() => {
    const query = window.matchMedia(DARK_Q)
    const onChange = () => setSystem(query.matches ? 'dark' : 'light')
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const theme = choice ?? system

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setChoice(next)
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // 
    }
  }, [theme])

  return { theme, toggleTheme }
}