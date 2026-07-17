'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, Search } from 'lucide-react'

import { BUSINESS_TYPES, businessTypeLabel, searchBusinessTypes } from '@/lib/businessTypes'

interface Props {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

// Selector de tipo de negocio con buscador. Permite elegir de una lista amplia
// o escribir uno personalizado. El desplegable se renderiza en un portal con
// posición fija para no ser recortado por contenedores con overflow (.card).
export default function BusinessTypePicker({ value, onChange, disabled, placeholder }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  const updatePos = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePos()
    const onScroll = () => updatePos()
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (buttonRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
      setQuery('')
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    document.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open, updatePos])

  const results = searchBusinessTypes(query)
  const trimmed = query.trim()
  const exact = BUSINESS_TYPES.some(b => b.label.toLowerCase() === trimmed.toLowerCase())
  const canUseCustom = trimmed.length > 0 && !exact

  const select = (v: string) => {
    onChange(v)
    setOpen(false)
    setQuery('')
  }

  const dropdown =
    open && pos ? (
      <div
        ref={panelRef}
        style={{ position: 'fixed', top: pos.top, left: pos.left, width: Math.max(pos.width, 240) }}
        className="z-[100] bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
      >
        <div className="p-2 border-b border-gray-100">
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-100 rounded-lg">
            <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Busca o escribe tu negocio…"
              className="w-full bg-transparent text-sm text-gray-900 focus:outline-none"
              onKeyDown={e => {
                if (e.key === 'Enter' && canUseCustom) {
                  e.preventDefault()
                  select(trimmed)
                }
                if (e.key === 'Escape') {
                  setOpen(false)
                  setQuery('')
                }
              }}
            />
          </div>
        </div>

        <ul className="max-h-60 overflow-y-auto py-1">
          {canUseCustom && (
            <li>
              <button
                type="button"
                onClick={() => select(trimmed)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-primary-700 hover:bg-primary-50"
              >
                <span className="text-gray-400">Usar</span> &quot;{trimmed}&quot;
              </button>
            </li>
          )}
          {results.map(opt => (
            <li key={opt.key}>
              <button
                type="button"
                onClick={() => select(opt.key)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50"
              >
                <span className="truncate">{opt.label}</span>
                {value === opt.key && <Check className="h-4 w-4 text-primary-600 flex-shrink-0" />}
              </button>
            </li>
          ))}
          {results.length === 0 && !canUseCustom && (
            <li className="px-3 py-2 text-sm text-gray-400">Sin resultados</li>
          )}
        </ul>
      </div>
    ) : null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-left text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-60"
      >
        <span className="truncate">{businessTypeLabel(value) || placeholder || 'Selecciona…'}</span>
        <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
      </button>

      {mounted && dropdown && createPortal(dropdown, document.body)}
    </>
  )
}
