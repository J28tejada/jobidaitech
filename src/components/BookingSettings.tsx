'use client'

import { useEffect, useState } from 'react'
import { Loader2, Copy, Check, ExternalLink, CalendarCheck } from 'lucide-react'

import { useToast } from './Toaster'

const DAYS = [
  { n: 1, label: 'Lun' },
  { n: 2, label: 'Mar' },
  { n: 3, label: 'Mié' },
  { n: 4, label: 'Jue' },
  { n: 5, label: 'Vie' },
  { n: 6, label: 'Sáb' },
  { n: 0, label: 'Dom' },
]

export default function BookingSettings() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const [token, setToken] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [openTime, setOpenTime] = useState('09:00')
  const [closeTime, setCloseTime] = useState('19:00')
  const [slotMin, setSlotMin] = useState(30)
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6])
  const [deposit, setDeposit] = useState('')

  useEffect(() => {
    fetch('/api/settings/booking', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) return
        setToken(d.token ?? null)
        setEnabled(!!d.enabled)
        setOpenTime(d.openTime ?? '09:00')
        setCloseTime(d.closeTime ?? '19:00')
        setSlotMin(d.slotMin ?? 30)
        setDays(Array.isArray(d.days) ? d.days : [1, 2, 3, 4, 5, 6])
        setDeposit(d.deposit ? String(d.deposit) : '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const link = token && typeof window !== 'undefined' ? `${window.location.origin}/reservar/${token}` : ''

  const save = async (patch: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast.error('No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const toggleDay = (n: number) => {
    const next = days.includes(n) ? days.filter(d => d !== n) : [...days, n]
    setDays(next)
    save({ days: next })
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  const wa = link ? `https://wa.me/?text=${encodeURIComponent(`Reserva tu cita aquí: ${link}`)}` : ''

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-1">
        <CalendarCheck className="h-5 w-5 text-primary-600" />
        <h2 className="text-lg font-semibold text-gray-900">Reservas online</h2>
      </div>
      <p className="text-gray-600 mb-4 text-sm">Comparte un enlace para que tus clientes reserven 24/7.</p>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
      ) : (
        <div className="space-y-4">
          {/* Activar */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => { setEnabled(e.target.checked); save({ enabled: e.target.checked }) }}
              className="h-5 w-5 rounded border-gray-300"
              style={{ accentColor: 'var(--p-600)' }}
            />
            <span className="text-sm font-medium text-gray-900">Activar reservas online</span>
            {saving && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          </label>

          {enabled && (
            <>
              {/* Enlace */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1.5">Tu enlace de reservas</p>
                <p className="text-sm text-gray-900 break-all mb-2">{link}</p>
                <div className="flex gap-2">
                  <button onClick={copy} className="btn btn-secondary text-sm flex items-center gap-1.5">
                    {copied ? <Check className="h-4 w-4 text-success-600" /> : <Copy className="h-4 w-4" />} Copiar
                  </button>
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-secondary text-sm flex items-center gap-1.5">
                    Compartir
                  </a>
                  <a href={link} target="_blank" rel="noopener noreferrer" className="btn btn-secondary text-sm flex items-center gap-1.5">
                    <ExternalLink className="h-4 w-4" /> Abrir
                  </a>
                </div>
              </div>

              {/* Horario */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Abre</label>
                  <input type="time" className="input" value={openTime} onChange={e => setOpenTime(e.target.value)} onBlur={() => save({ openTime })} />
                </div>
                <div>
                  <label className="label">Cierra</label>
                  <input type="time" className="input" value={closeTime} onChange={e => setCloseTime(e.target.value)} onBlur={() => save({ closeTime })} />
                </div>
                <div>
                  <label className="label">Cada</label>
                  <select className="input" value={slotMin} onChange={e => { const v = Number(e.target.value); setSlotMin(v); save({ slotMin: v }) }}>
                    {[15, 20, 30, 45, 60].map(v => <option key={v} value={v}>{v} min</option>)}
                  </select>
                </div>
              </div>

              {/* Días */}
              <div>
                <label className="label">Días que abres</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map(d => (
                    <button
                      key={d.n}
                      type="button"
                      onClick={() => toggleDay(d.n)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${days.includes(d.n) ? 'bg-primary-600 text-white border-primary-600' : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Seña */}
              <div>
                <label className="label">Seña / depósito (opcional)</label>
                <input
                  type="number" step="0.01" min="0" className="input max-w-xs" placeholder="0.00"
                  value={deposit}
                  onChange={e => setDeposit(e.target.value)}
                  onBlur={() => save({ deposit: Number(deposit) || 0 })}
                />
                <p className="text-xs text-gray-500 mt-1">Si pones un monto, se le muestra al cliente que debe dejar una seña para confirmar.</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
