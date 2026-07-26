'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react'

import { useToast } from './Toaster'

interface WS {
  id: string
  name: string
  type: string
  role: string
}

// Sección "Zona de peligro": permite al DUEÑO eliminar el negocio activo con
// toda su información (citas, clientes, servicios, cobros, gastos, reservas,
// WhatsApp, etc.). El borrado es en cascada en la base de datos. Requiere
// escribir el nombre del negocio para confirmar. No aplica al espacio personal.
export default function DeleteBusiness() {
  const toast = useToast()
  const [ws, setWs] = useState<WS | null>(null)
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch('/api/workspaces', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) return
        const active = (d.workspaces || []).find((w: any) => w.id === d.activeWorkspaceId)
        if (active) setWs({ id: active.id, name: active.name, type: active.type, role: active.role })
      })
      .catch(() => {})
  }, [])

  // Solo el dueño de un NEGOCIO (no el espacio personal) puede eliminarlo.
  if (!ws || ws.type === 'personal' || ws.role !== 'owner') return null

  const del = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/workspaces/${ws.id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) {
        const b = await res.json().catch(() => null)
        throw new Error(b?.error || 'No se pudo eliminar el negocio')
      }
      toast.success('Negocio eliminado')
      // Recarga completa: la cookie ya cambió al espacio personal.
      window.location.href = '/'
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar')
      setDeleting(false)
    }
  }

  const canDelete = confirmText.trim() === ws.name.trim()

  return (
    <div className="card border border-danger-200">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-danger-100 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-danger-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Eliminar este negocio</h2>
      </div>
      <p className="text-gray-600 mb-4 text-sm">
        Borra <strong>{ws.name}</strong> y <strong>toda su información</strong> (citas, clientes, servicios,
        barberos, cobros, gastos, reservas y configuración) de forma permanente. Esta acción no se puede
        deshacer. Luego quedas en tu espacio personal para empezar de nuevo.
      </p>
      <button
        onClick={() => { setConfirmText(''); setOpen(true) }}
        className="btn flex items-center gap-1.5 text-red-600 border border-red-300 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" /> Eliminar este negocio
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => !deleting && setOpen(false)} />
            <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900 truncate">¿Eliminar “{ws.name}”?</h3>
                <button onClick={() => !deleting && setOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="rounded-lg bg-danger-50 border border-danger-200 text-danger-800 text-sm p-3 mb-4">
                Se borrará <strong>todo</strong>: citas, clientes, servicios, barberos, cobros, gastos,
                reservas y configuración. No hay vuelta atrás.
              </div>
              <label className="label">
                Para confirmar, escribe el nombre del negocio: <strong>{ws.name}</strong>
              </label>
              <input
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                className="input mb-4"
                placeholder={ws.name}
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={() => setOpen(false)} disabled={deleting} className="btn btn-secondary flex-1">
                  Cancelar
                </button>
                <button
                  onClick={del}
                  disabled={!canDelete || deleting}
                  className="btn btn-danger flex-1 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Eliminar definitivamente
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
