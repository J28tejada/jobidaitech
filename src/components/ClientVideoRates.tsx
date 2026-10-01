'use client'

import { useEffect, useState } from 'react'
import { Loader2, Check, Users } from 'lucide-react'

import { useToast } from './Toaster'

interface Row {
  clientId: string
  name: string
  rate: number | null
}

// Precio por video de cada cliente (módulo Videos). Al registrar un video para
// ese cliente, el precio se pone solo. Vacío = usa la tarifa del camarógrafo.
export default function ClientVideoRates({ onChanged }: { onChanged?: () => void }) {
  const toast = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/video-client-rates', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : []))
      .then(d => {
        const list: Row[] = Array.isArray(d) ? d : []
        setRows(list)
        const init: Record<string, string> = {}
        list.forEach(r => { init[r.clientId] = r.rate === null ? '' : String(r.rate) })
        setDrafts(init)
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  const save = async (row: Row) => {
    const draft = (drafts[row.clientId] ?? '').trim()
    const current = row.rate === null ? '' : String(row.rate)
    if (draft === current) return
    setSavingId(row.clientId)
    try {
      const res = await fetch('/api/video-client-rates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ clientId: row.clientId, rate: draft === '' ? null : Number(draft) }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo guardar')
      setRows(prev => prev.map(r => (r.clientId === row.clientId ? { ...r, rate: data.rate } : r)))
      setSavedId(row.clientId)
      setTimeout(() => setSavedId(s => (s === row.clientId ? null : s)), 1500)
      onChanged?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar')
      setDrafts(prev => ({ ...prev, [row.clientId]: current }))
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-4 flex flex-col items-center gap-2">
        <Users className="h-6 w-6 text-gray-300" />
        Aún no tienes clientes. Agrégalos en Clientes y luego ponles su precio aquí.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {rows.map(r => (
        <div key={r.clientId} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="flex-1 min-w-0 text-sm font-medium text-gray-900 truncate">{r.name}</p>
          <input
            value={drafts[r.clientId] ?? ''}
            onChange={e => setDrafts(prev => ({ ...prev, [r.clientId]: e.target.value }))}
            onBlur={() => save(r)}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            className="input w-32 text-right"
            placeholder="Sin precio"
            aria-label={`Precio por video para ${r.name}`}
          />
          <span className="w-4 flex-shrink-0">
            {savingId === r.clientId ? (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            ) : savedId === r.clientId ? (
              <Check className="h-4 w-4 text-success-600" />
            ) : null}
          </span>
        </div>
      ))}
    </div>
  )
}
