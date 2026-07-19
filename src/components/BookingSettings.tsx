'use client'

import { useEffect, useState } from 'react'
import { Loader2, Copy, Check, ExternalLink, CalendarCheck } from 'lucide-react'

import { useToast } from './Toaster'
import type { BookingHours } from '@/lib/booking'

// Orden de presentación (Lun→Dom). La clave numérica sigue 0=Dom..6=Sáb.
const DAYS = [
  { n: 1, label: 'Lunes' },
  { n: 2, label: 'Martes' },
  { n: 3, label: 'Miércoles' },
  { n: 4, label: 'Jueves' },
  { n: 5, label: 'Viernes' },
  { n: 6, label: 'Sábado' },
  { n: 0, label: 'Domingo' },
]

export default function BookingSettings() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const [token, setToken] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [slotMin, setSlotMin] = useState(30)
  const [deposit, setDeposit] = useState('')
  const [hours, setHours] = useState<BookingHours>({})
  const [notifyPhone, setNotifyPhone] = useState('')
  const [notifyUrl, setNotifyUrl] = useState('')

  useEffect(() => {
    fetch('/api/settings/booking', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) return
        setToken(d.token ?? null)
        setEnabled(!!d.enabled)
        setSlotMin(d.slotMin ?? 30)
        setDeposit(d.deposit ? String(d.deposit) : '')
        setHours(d.hours && typeof d.hours === 'object' ? d.hours : {})
        setNotifyPhone(d.notifyPhone ?? '')
        setNotifyUrl(d.notifyUrl ?? '')
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

  // Activa/desactiva un día. Al activarlo, propone un horario inicial (que el
  // negocio ajusta); no hay días predefinidos: solo trabajan los que marque.
  const toggleDay = (n: number) => {
    const key = String(n)
    const next: BookingHours = { ...hours }
    if (next[key]) {
      delete next[key]
    } else {
      // Copia el horario de algún día ya activo, o propone uno por defecto.
      const anyDay = Object.keys(hours)[0]
      next[key] = anyDay ? { ...hours[anyDay] } : { open: '09:00', close: '18:00' }
    }
    setHours(next)
    save({ hours: next })
  }

  const changeTime = (n: number, field: 'open' | 'close', value: string) => {
    const key = String(n)
    if (!hours[key]) return
    setHours({ ...hours, [key]: { ...hours[key], [field]: value } })
  }

  const commitHours = () => save({ hours })

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
  const openCount = Object.keys(hours).length

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
                <div className="flex gap-2 flex-wrap">
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

              {/* Horario por día */}
              <div>
                <label className="label">Tus días y horarios de trabajo</label>
                <p className="text-xs text-gray-500 mb-2">Marca los días que trabajas y define el horario de cada uno. El cliente solo verá disponibilidad en esos días y horas.</p>
                <div className="space-y-2">
                  {DAYS.map(d => {
                    const key = String(d.n)
                    const on = !!hours[key]
                    return (
                      <div key={d.n} className="flex items-center gap-3 py-1">
                        <label className="flex items-center gap-2 cursor-pointer w-32 flex-shrink-0">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggleDay(d.n)}
                            className="h-4 w-4 rounded border-gray-300"
                            style={{ accentColor: 'var(--p-600)' }}
                          />
                          <span className={`text-sm ${on ? 'font-medium text-gray-900' : 'text-gray-500'}`}>{d.label}</span>
                        </label>
                        {on ? (
                          <div className="flex items-center gap-2 text-sm">
                            <input
                              type="time"
                              className="input py-1.5 w-28"
                              value={hours[key].open}
                              onChange={e => changeTime(d.n, 'open', e.target.value)}
                              onBlur={commitHours}
                            />
                            <span className="text-gray-400">a</span>
                            <input
                              type="time"
                              className="input py-1.5 w-28"
                              value={hours[key].close}
                              onChange={e => changeTime(d.n, 'close', e.target.value)}
                              onBlur={commitHours}
                            />
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Cerrado</span>
                        )}
                      </div>
                    )
                  })}
                </div>
                {openCount === 0 && (
                  <p className="text-xs text-amber-600 mt-2">Marca al menos un día para que los clientes puedan reservar.</p>
                )}
              </div>

              {/* Duración de turno */}
              <div>
                <label className="label">Duración de cada turno</label>
                <select className="input max-w-xs" value={slotMin} onChange={e => { const v = Number(e.target.value); setSlotMin(v); save({ slotMin: v }) }}>
                  {[15, 20, 30, 45, 60].map(v => <option key={v} value={v}>Cada {v} min</option>)}
                </select>
                <p className="text-xs text-gray-500 mt-1">Intervalo entre horarios disponibles (si un servicio dura más, se ajusta solo).</p>
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

              {/* Notificación por WhatsApp (vía webhook n8n) */}
              <div className="pt-2 border-t border-gray-100">
                <label className="label">Aviso por WhatsApp de nuevas reservas</label>
                <p className="text-xs text-gray-500 mb-2">Cuando un cliente reserve, te avisamos por WhatsApp usando tu automatización (n8n).</p>
                <div className="space-y-2 max-w-md">
                  <input
                    type="tel"
                    className="input"
                    placeholder="WhatsApp que recibe el aviso (ej. 809 123 4567)"
                    value={notifyPhone}
                    onChange={e => setNotifyPhone(e.target.value)}
                    onBlur={() => save({ notifyPhone })}
                  />
                  <input
                    type="url"
                    className="input"
                    placeholder="URL del webhook de n8n (https://…)"
                    value={notifyUrl}
                    onChange={e => setNotifyUrl(e.target.value)}
                    onBlur={() => save({ notifyUrl })}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Pega la URL del webhook de tu flujo de n8n. Al reservar, enviamos ahí los datos (cliente, servicio, fecha/hora, barbero) y tu n8n manda el WhatsApp.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
