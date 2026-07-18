'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Building2, Check, ChevronDown, Plus, Loader2 } from 'lucide-react'

import BusinessTypePicker from './BusinessTypePicker'

type WorkspaceType = 'personal' | 'business'

interface Workspace {
  id: string
  name: string
  type: WorkspaceType
  businessType: string
  role: string
  isActive: boolean
}

export default function WorkspaceSwitcher() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<string>('carpentry')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    let active = true
    fetch('/api/workspaces')
      .then(res => (res.ok ? res.json() : Promise.reject(res)))
      .then(data => {
        if (active) setWorkspaces(data.workspaces ?? [])
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const updatePosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) {
      setMenuPos({ top: rect.bottom + 8, left: rect.left, width: rect.width })
    }
  }, [])

  useEffect(() => {
    if (!open) return
    updatePosition()
    const onScroll = () => updatePosition()
    const onResize = () => updatePosition()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (buttonRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open, updatePosition])

  const active = workspaces.find(w => w.isActive)

  const handleSwitch = async (workspaceId: string) => {
    if (busy || workspaceId === active?.id) {
      setOpen(false)
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/workspaces/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      })
      if (!res.ok) throw new Error('No se pudo cambiar de espacio')
      // Ir al Panel de control (general a todos los negocios) en vez de quedar
      // en una ruta que quizá no aplica al nuevo negocio (ej. /videos).
      window.location.href = '/'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar de espacio')
      setBusy(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || creating) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), businessType: newType }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'No se pudo crear el negocio')
      }
      window.location.href = '/'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el negocio')
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Cargando…</span>
      </div>
    )
  }

  const ActiveIcon = Building2

  const dropdown =
    open && menuPos ? (
      <div
        ref={menuRef}
        style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, minWidth: Math.max(menuPos.width, 256) }}
        className="w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-[70]"
      >
        <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Espacios</p>
        <ul className="max-h-64 overflow-y-auto">
          {workspaces.map(ws => {
            return (
              <li key={ws.id}>
                <button
                  type="button"
                  onClick={() => handleSwitch(ws.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                >
                  <Building2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="flex-1 truncate">{ws.name}</span>
                  {ws.isActive && <Check className="h-4 w-4 text-primary-600 flex-shrink-0" />}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="border-t border-gray-100 mt-1 pt-1">
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setShowCreate(true)
              setError(null)
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50 transition-colors text-left"
          >
            <Plus className="h-4 w-4 flex-shrink-0" />
            Crear negocio
          </button>
        </div>
      </div>
    ) : null

  const modal = showCreate ? (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
      onClick={() => !creating && setShowCreate(false)}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary-100 rounded-lg">
            <Building2 className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Crear negocio</h3>
            <p className="text-sm text-gray-500">Un espacio aparte para llevar sus registros</p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del negocio</label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Ej. Carpintería Del Rey"
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de negocio</label>
            <BusinessTypePicker value={newType} onChange={setNewType} />
            <p className="mt-1 text-xs text-gray-500">Busca en la lista o escribe el tuyo. Define las categorías iniciales.</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              disabled={creating}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="btn btn-primary flex items-center gap-2 disabled:opacity-60"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear negocio
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={busy}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-800 hover:border-gray-300 hover:bg-gray-50 transition-colors max-w-[220px] disabled:opacity-60"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <ActiveIcon className="h-4 w-4 text-primary-600 flex-shrink-0" />
        <span className="truncate">{active?.name ?? 'Espacio'}</span>
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {mounted && createPortal(
        <>
          {dropdown}
          {modal}
        </>,
        document.body
      )}
    </>
  )
}
