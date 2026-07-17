'use client'

import { useEffect, useRef, useState } from 'react'
import { Palette, Check, X } from 'lucide-react'

import { ACCENTS, ACCENT_STORAGE_KEY, DEFAULT_ACCENT, applyAccent } from '@/lib/themes'

// Selector flotante de color de acento — para probar paletas en vivo.
// La elección se guarda en localStorage y se aplica al instante en toda la app.
export default function ThemePicker() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<string>(DEFAULT_ACCENT)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem(ACCENT_STORAGE_KEY)) || DEFAULT_ACCENT
    setCurrent(saved)
    applyAccent(saved)
  }, [])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const choose = (key: string) => {
    setCurrent(key)
    applyAccent(key)
    try {
      localStorage.setItem(ACCENT_STORAGE_KEY, key)
    } catch {
      /* ignore */
    }
  }

  return (
    <div ref={panelRef} className="fixed right-4 bottom-24 sm:bottom-6 z-[80] print:hidden">
      {open && (
        <div className="mb-3 w-60 rounded-2xl border border-gray-200 bg-white shadow-2xl p-4 animate-[fadeIn_.15s_ease-out]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-900">Color de acento</p>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {ACCENTS.map(a => {
              const active = a.key === current
              return (
                <button
                  key={a.key}
                  onClick={() => choose(a.key)}
                  title={a.label}
                  aria-label={a.label}
                  className={`relative h-11 w-11 rounded-full transition-transform hover:scale-110 focus:outline-none ${active ? 'ring-2 ring-offset-2 ring-offset-[#16161f] ring-white' : ''}`}
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
        aria-label="Cambiar color de acento"
        className="ml-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg hover:bg-primary-500 transition-colors"
      >
        <Palette className="h-5 w-5" />
      </button>
    </div>
  )
}
