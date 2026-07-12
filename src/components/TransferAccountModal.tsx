'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Send, Loader2, Copy, Check } from 'lucide-react'

interface TransferAccountModalProps {
  projectId: string
  projectName: string
  onClose: () => void
}

export default function TransferAccountModal({ projectId, projectName, onClose }: TransferAccountModalProps) {
  const [email, setEmail] = useState('')
  const [scope, setScope] = useState<'one' | 'all'>('one')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [count, setCount] = useState(0)
  const [copied, setCopied] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || creating) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmail: email.trim(), projectId, allProjects: scope === 'all' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo crear la transferencia')
      setLink(data.link)
      setCount(data.count ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al transferir')
    } finally {
      setCreating(false)
    }
  }

  const copy = () => {
    if (!link) return
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={() => !creating && onClose()}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary-100 rounded-lg">
            <Send className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Transferir a otra cuenta</h3>
            <p className="text-sm text-gray-500">Pasar proyectos a otro correo (otra cuenta de Google)</p>
          </div>
        </div>

        {link ? (
          <div className="space-y-4">
            <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg">
              <p className="text-sm font-medium text-gray-800 mb-2">
                ✅ Transferencia creada para <strong>{email}</strong> ({count} proyecto{count === 1 ? '' : 's'}).
              </p>
              <p className="text-xs text-gray-600 mb-2">
                Inicia sesión con esa cuenta y abre este enlace para aceptar. Los datos llegarán a su espacio Personal.
              </p>
              <div className="flex items-center gap-2">
                <input readOnly value={link} className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded bg-white" />
                <button onClick={copy} className="btn btn-primary flex items-center gap-1.5">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={onClose} className="btn btn-primary">Listo</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo de la cuenta destino</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="correo@gmail.com"
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="radio" checked={scope === 'one'} onChange={() => setScope('one')} />
                Solo “{projectName}”
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="radio" checked={scope === 'all'} onChange={() => setScope('all')} />
                Todos los proyectos de este espacio
              </label>
            </div>

            <p className="text-xs text-gray-500">
              La otra cuenta deberá <strong>aceptar</strong> la transferencia iniciando sesión con ese correo. Así nadie
              recibe datos sin su permiso.
            </p>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} disabled={creating} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-60">
                Cancelar
              </button>
              <button type="submit" disabled={creating || !email.trim()} className="btn btn-primary flex items-center gap-2 disabled:opacity-60">
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                Crear transferencia
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  )
}
