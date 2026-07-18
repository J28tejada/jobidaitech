'use client'

import { useEffect, useState } from 'react'
import { Check, Sun, Moon } from 'lucide-react'

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

// Ajustes de apariencia (tema claro/oscuro + color de acento). Se guarda en
// este dispositivo y se aplica al instante.
export default function AppearanceSettings() {
  const [accent, setAccent] = useState<string>(DEFAULT_ACCENT)
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_MODE)

  useEffect(() => {
    const savedAccent = (typeof window !== 'undefined' && localStorage.getItem(ACCENT_STORAGE_KEY)) || DEFAULT_ACCENT
    const savedMode = ((typeof window !== 'undefined' && localStorage.getItem(THEME_MODE_KEY)) as ThemeMode) || DEFAULT_MODE
    setAccent(savedAccent)
    setMode(savedMode === 'light' ? 'light' : 'dark')
  }, [])

  const chooseAccent = (key: string) => {
    setAccent(key)
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
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Apariencia</h2>

      {/* Modo claro / oscuro */}
      <p className="text-sm font-medium text-gray-700 mb-2">Tema</p>
      <div className="grid grid-cols-2 gap-2 max-w-xs mb-5">
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
      <p className="text-sm font-medium text-gray-700 mb-2">Color de acento</p>
      <div className="flex flex-wrap gap-3">
        {ACCENTS.map(a => {
          const active = a.key === accent
          return (
            <button
              key={a.key}
              onClick={() => chooseAccent(a.key)}
              title={a.label}
              aria-label={a.label}
              className={`relative h-10 w-10 rounded-full transition-transform hover:scale-110 focus:outline-none ${active ? 'ring-2 ring-white shadow-md' : ''}`}
              style={{ backgroundColor: a.swatch }}
            >
              {active && <Check className="h-5 w-5 text-white absolute inset-0 m-auto drop-shadow" />}
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-gray-500">Se guarda en este dispositivo.</p>
    </div>
  )
}
