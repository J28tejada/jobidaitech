'use client'

import { useEffect, useRef, useState } from 'react'
import { Palette, Check, X, Sun, Moon } from 'lucide-react'

import {
  ACCENTS,
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  applyAccent,
  THEME_MODE_KEY,
  DEFAULT_MODE,
  applyMode,
  type ThemeMode,
} from '@/lib/themes'

// Selector flotante de tema: modo claro/oscuro + color de acento.
// La elección se guarda en localStorage y se aplica al instante.
export default function ThemePicker() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<string>(DEFAULT_ACCENT)
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_MODE)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const savedAccent = (typeof window !== 'undefined' && localStorage.getItem(ACCENT_STORAGE_KEY)) || DEFAULT_ACCENT
    const savedMode = ((typeof window !== 'undefined' && localStorage.getItem(THEME_MODE_KEY)) as ThemeMode) || DEFAULT_MODE
    setCurrent(savedAccent)
    setMode(savedMode === 'light' ? 'light' : 'dark')
    applyAccent(savedAccent)
    applyMode(savedMode === 'light' ? 'light' : 'dark')
  }, [])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const chooseAccent = (key: string) => {
    setCurrent(key)
    applyAccent(key)
    try {
      localStorage.setItem(ACCENT_STORAGE_KEY, key)
    } catch {
      /* ignore */
    }
  }

  const chooseMode = (m: ThemeMode) => {
    setMode(m)
    applyMode(m)
    try {
      localStorage.setItem(THEME_MODE_KEY, m)
    } catch {
      /* ignore */
    }
  }

  return (
    <div ref={panelRef} className="fixed right-4 bottom-24 sm:bottom-6 z-[80] print:hidden">
      {open && (
        <div className="mb-3 w-64 rounded-2xl border border-gray-200 bg-white shadow-2xl p-4 animate-[fadeIn_.15s_ease-out]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-900">Apariencia</p>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Modo claro / oscuro */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => chooseMode('light')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium border transition-colors ${mode === 'light' ? 'bg-primary-600 text-white border-primary-600' : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'}`}
            >
              <Sun className="h-4 w-4" /> Claro
            </button>
            <button
              onClick={() => chooseMode('dark')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium border transition-colors ${mode === 'dark' ? 'bg-primary-600 text-white border-primary-600' : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'}`}
            >
              <Moon className="h-4 w-4" /> Oscuro
            </button>
          </div>

          {/* Color de acento */}
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Color de acento</p>
          <div className="grid grid-cols-4 gap-3">
            {ACCENTS.map(a => {
              const active = a.key === current
              return (
                <button
                  key={a.key}
                  onClick={() => chooseAccent(a.key)}
                  title={a.label}
                  aria-label={a.label}
                  className={`relative h-11 w-11 rounded-full transition-transform hover:scale-110 focus:outline-none ${active ? 'ring-2 ring-white shadow-md' : ''}`}
                  style={{ backgroundColor: a.swatch }}
                >
                  {active && <Check className="h-5 w-5 text-white absolute inset-0 m-auto drop-shadow" />}
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Se guarda en este dispositivo. Cuando elijas el definitivo, avísame y lo dejo fijo.
          </p>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Cambiar apariencia"
        className="ml-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg hover:bg-primary-500 transition-colors"
      >
        <Palette className="h-5 w-5" />
      </button>
    </div>
  )
}
