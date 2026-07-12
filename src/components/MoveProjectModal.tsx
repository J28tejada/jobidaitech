'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Building2, User, Loader2, ArrowRightLeft } from 'lucide-react'

interface Workspace {
  id: string
  name: string
  type: 'personal' | 'business'
  role: string
  isActive: boolean
}

interface MoveProjectModalProps {
  projectId: string
  projectName: string
  onClose: () => void
  onMoved: () => void
}

const MANAGE_ROLES = new Set(['owner', 'admin'])

export default function MoveProjectModal({ projectId, projectName, onClose, onMoved }: MoveProjectModalProps) {
  const [targets, setTargets] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState('')
  const [moving, setMoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    let active = true
    fetch('/api/workspaces')
      .then(res => res.json())
      .then(data => {
        if (!active) return
        const eligible = (data.workspaces ?? []).filter(
          (w: Workspace) => !w.isActive && MANAGE_ROLES.has(w.role)
        )
        setTargets(eligible)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const handleMove = async () => {
    if (!selected || moving) return
    setMoving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetWorkspaceId: selected }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'No se pudo mover el proyecto')
      }
      onMoved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al mover el proyecto')
      setMoving(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={() => !moving && onClose()}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary-100 rounded-lg">
            <ArrowRightLeft className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Mover proyecto</h3>
            <p className="text-sm text-gray-500 truncate">“{projectName}” y sus transacciones</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Cargando espacios…</span>
          </div>
        ) : targets.length === 0 ? (
          <p className="text-sm text-gray-600 py-4">
            No tienes otro espacio al que puedas mover este proyecto. Crea un negocio (o pide que te hagan
            administrador de uno) para poder moverlo ahí.
          </p>
        ) : (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mover a:</label>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {targets.map(w => {
                const Icon = w.type === 'business' ? Building2 : User
                return (
                  <label
                    key={w.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      selected === w.id ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="target-workspace"
                      value={w.id}
                      checked={selected === w.id}
                      onChange={() => setSelected(w.id)}
                    />
                    <Icon className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-800">{w.name}</span>
                    {w.type === 'personal' && (
                      <span className="ml-auto text-[10px] uppercase tracking-wide text-gray-400">Personal</span>
                    )}
                  </label>
                )
              })}
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Las categorías de sus transacciones se enlazarán a las del espacio destino cuando coincidan por nombre.
            </p>
          </>
        )}

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-5">
          <button onClick={onClose} disabled={moving} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-60">
            Cancelar
          </button>
          {targets.length > 0 && (
            <button
              onClick={handleMove}
              disabled={!selected || moving}
              className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {moving && <Loader2 className="h-4 w-4 animate-spin" />}
              Mover proyecto
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
