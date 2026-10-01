'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Trash2, Users } from 'lucide-react'

import { useToast } from './Toaster'
import { useConfirm } from './ConfirmDialog'
import { useCurrency } from './CurrencyProvider'

interface Rate {
  id: string
  label: string
  rate: number
}
interface ClientRates {
  clientId: string
  name: string
  rates: Rate[]
}

// Precios de video de cada cliente (módulo Videos). Un cliente puede tener
// varios (ej. "Reel" 750, "Video largo" 1,500); al registrar un video se elige
// uno y el precio se pone solo.
export default function ClientVideoRates({ onChanged }: { onChanged?: () => void }) {
  const toast = useToast()
  const [list, setList] = useState<ClientRates[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const r = await fetch('/api/video-client-rates', { credentials: 'include' })
      const d = r.ok ? await r.json() : []
      setList(Array.isArray(d) ? d : [])
    } catch {
      setList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const changed = async () => {
    await load()
    onChanged?.()
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    )
  }

  if (list.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-4 flex flex-col items-center gap-2">
        <Users className="h-6 w-6 text-gray-300" />
        Aún no tienes clientes. Agrégalos en Clientes y luego ponles sus precios aquí.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {list.map(c => (
        <ClientCard key={c.clientId} client={c} onChanged={changed} onError={msg => toast.error(msg)} />
      ))}
    </div>
  )
}

function ClientCard({ client, onChanged, onError }: { client: ClientRates; onChanged: () => void; onError: (msg: string) => void }) {
  const confirm = useConfirm()
  const { format } = useCurrency()
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [rate, setRate] = useState('')
  const [saving, setSaving] = useState(false)

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving || rate === '') return
    setSaving(true)
    try {
      const res = await fetch('/api/video-client-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ clientId: client.clientId, label, rate: Number(rate) }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo guardar')
      setLabel('')
      setRate('')
      setAdding(false)
      onChanged()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (r: Rate) => {
    const ok = await confirm({
      title: 'Eliminar precio',
      message: `¿Eliminar el precio ${r.label ? `"${r.label}" ` : ''}de ${client.name}? Los videos ya registrados conservan su precio.`,
      confirmText: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    const res = await fetch(`/api/video-client-rates/${r.id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) onChanged()
    else onError('No se pudo eliminar')
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900 truncate">{client.name}</p>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1 flex-shrink-0">
            <Plus className="h-3.5 w-3.5" /> Agregar precio
          </button>
        )}
      </div>

      {client.rates.length === 0 && !adding && (
        <p className="text-xs text-gray-500 mt-1">Sin precios. Se usará la tarifa del camarógrafo.</p>
      )}

      {client.rates.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {client.rates.map(r => (
            <RateRow key={r.id} rate={r} format={format} onChanged={onChanged} onError={onError} onDelete={() => remove(r)} />
          ))}
        </div>
      )}

      {adding && (
        <form onSubmit={add} className="mt-2 flex items-center gap-2">
          <input value={label} onChange={e => setLabel(e.target.value)} className="input flex-1 min-w-0" placeholder="Tipo (ej. Reel)" autoFocus />
          <input value={rate} onChange={e => setRate(e.target.value)} type="number" inputMode="decimal" step="0.01" min="0" className="input w-28 text-right" placeholder="Precio" required />
          <button type="submit" disabled={saving || rate === ''} className="btn btn-primary px-3 disabled:opacity-60" aria-label="Guardar precio">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => { setAdding(false); setLabel(''); setRate('') }} className="text-xs text-gray-500 hover:text-gray-700 flex-shrink-0">
            Cancelar
          </button>
        </form>
      )}
    </div>
  )
}

// Fila editable: el nombre y el precio se guardan al salir del campo.
function RateRow({ rate, format, onChanged, onError, onDelete }: { rate: Rate; format: (n: number) => string; onChanged: () => void; onError: (msg: string) => void; onDelete: () => void }) {
  const [label, setLabel] = useState(rate.label)
  const [value, setValue] = useState(String(rate.rate))
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const patch: Record<string, unknown> = {}
    if (label.trim() !== rate.label) patch.label = label
    if (value !== String(rate.rate)) {
      if (value === '') { setValue(String(rate.rate)); return }
      patch.rate = Number(value)
    }
    if (Object.keys(patch).length === 0) return
    setSaving(true)
    try {
      const res = await fetch(`/api/video-client-rates/${rate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patch),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo guardar')
      onChanged()
    } catch (err) {
      setLabel(rate.label)
      setValue(String(rate.rate))
      onError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
  }

  return (
    <div className="flex items-center gap-2">
      <input value={label} onChange={e => setLabel(e.target.value)} onBlur={save} onKeyDown={blurOnEnter} className="input flex-1 min-w-0" placeholder="Video" aria-label="Tipo de video" />
      <input value={value} onChange={e => setValue(e.target.value)} onBlur={save} onKeyDown={blurOnEnter} type="number" inputMode="decimal" step="0.01" min="0" className="input w-28 text-right" aria-label={`Precio (${format(rate.rate)})`} />
      <span className="w-6 flex justify-center flex-shrink-0">
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        ) : (
          <button type="button" onClick={onDelete} className="text-danger-500 hover:text-danger-700 p-1" aria-label="Eliminar precio">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </span>
    </div>
  )
}
