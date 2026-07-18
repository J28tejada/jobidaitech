'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Scissors, CalendarCheck, CheckCircle2, Clock } from 'lucide-react'

import { formatCurrency } from '@/lib/format'

interface Service { id: string; name: string; durationMin: number; price: number }
interface Staff { id: string; name: string }
interface Config { openTime: string; closeTime: string; slotMin: number; days: number[]; deposit: number }
interface BookingData {
  enabled: boolean
  business: { name: string }
  currency?: string
  locale?: string
  config?: Config
  services?: Service[]
  staff?: Staff[]
}

const pad = (n: number) => String(n).padStart(2, '0')
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const hm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`

export default function BookingPage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<BookingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [serviceId, setServiceId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [taken, setTaken] = useState<{ startsAt: string; durationMin: number }[]>([])
  const [slotIso, setSlotIso] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ when: string } | null>(null)

  useEffect(() => {
    fetch(`/api/public/booking/${params.token}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: BookingData) => setData(d))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [params.token])

  // Cargar intervalos ocupados del día elegido.
  useEffect(() => {
    if (!data?.enabled || !date) return
    const from = new Date(`${date}T00:00:00`).toISOString()
    const to = new Date(`${date}T23:59:59`).toISOString()
    const url = `/api/public/booking/${params.token}/day?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${staffId ? `&staffId=${staffId}` : ''}`
    fetch(url).then(r => (r.ok ? r.json() : { taken: [] })).then(d => setTaken(d.taken || [])).catch(() => setTaken([]))
    setSlotIso('')
  }, [data, date, staffId, params.token])

  const fmt = (n: number) => formatCurrency(n, { currency: data?.currency, locale: data?.locale })
  const service = data?.services?.find(s => s.id === serviceId)

  const slots = useMemo(() => {
    if (!data?.config || !service) return []
    const cfg = data.config
    const weekday = new Date(`${date}T00:00:00`).getDay()
    if (!cfg.days.includes(weekday)) return []
    const [oh, om] = cfg.openTime.split(':').map(Number)
    const [ch, cm] = cfg.closeTime.split(':').map(Number)
    const openMin = oh * 60 + om
    const closeMin = ch * 60 + cm
    const dur = service.durationMin || 30
    const now = Date.now()
    const out: { label: string; iso: string }[] = []
    for (let t = openMin; t + dur <= closeMin; t += cfg.slotMin) {
      const start = new Date(`${date}T00:00:00`)
      start.setMinutes(t)
      const startMs = start.getTime()
      const endMs = startMs + dur * 60000
      if (startMs < now + 5 * 60000) continue
      const overlap = taken.some(iv => {
        const s = new Date(iv.startsAt).getTime()
        const e = s + iv.durationMin * 60000
        return startMs < e && s < endMs
      })
      if (!overlap) out.push({ label: hm(t), iso: start.toISOString() })
    }
    return out
  }, [data, service, date, taken])

  const submit = async () => {
    if (submitting || !slotIso) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/public/booking/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, serviceId: serviceId || null, staffId: staffId || null, startsAt: slotIso }),
      })
      const b = await res.json().catch(() => null)
      if (!res.ok) throw new Error(b?.error || 'No se pudo reservar')
      const when = new Date(slotIso).toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
      setDone({ when })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al reservar')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
  }
  if (notFound || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6 text-center">
        <div><CalendarCheck className="h-12 w-12 text-gray-400 mx-auto mb-3" /><h1 className="text-lg font-semibold text-gray-900">Enlace no encontrado</h1></div>
      </div>
    )
  }
  if (!data.enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6 text-center">
        <div>
          <CalendarCheck className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-gray-900">{data.business.name}</h1>
          <p className="text-gray-500 text-sm mt-1">Las reservas online no están disponibles por ahora.</p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
          <CheckCircle2 className="h-14 w-14 text-success-600 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-900">¡Reserva confirmada!</h1>
          <p className="text-gray-600 mt-2 capitalize">{done.when}</p>
          <p className="text-sm text-gray-500 mt-1">{data.business.name}{service ? ` · ${service.name}` : ''}</p>
          {data.config && data.config.deposit > 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3 mt-4">
              Recuerda: se requiere una seña de {fmt(data.config.deposit)} para confirmar. El negocio te contactará por WhatsApp.
            </p>
          )}
        </div>
      </div>
    )
  }

  const hasStaff = (data.staff?.length ?? 0) > 0
  const canSubmit = !!serviceId && !!slotIso && name.trim() && phone.trim() && (!hasStaff || !!staffId)

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-primary-600 text-white px-6 py-5">
            <p className="text-xs uppercase tracking-wide opacity-80">Reservar cita</p>
            <h1 className="text-2xl font-bold">{data.business.name}</h1>
          </div>

          <div className="p-6 space-y-5">
            {/* Servicio */}
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-2">1. Elige el servicio</p>
              <div className="space-y-2">
                {(data.services ?? []).map(s => (
                  <button
                    key={s.id}
                    onClick={() => setServiceId(s.id)}
                    className={`w-full flex items-center justify-between gap-2 p-3 rounded-xl border text-left transition-colors ${serviceId === s.id ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <span className="min-w-0"><span className="text-sm font-medium text-gray-900">{s.name}</span><span className="block text-xs text-gray-500">{s.durationMin} min</span></span>
                    {s.price > 0 && <span className="text-sm font-semibold text-gray-900 flex-shrink-0">{fmt(s.price)}</span>}
                  </button>
                ))}
                {(data.services ?? []).length === 0 && <p className="text-sm text-gray-500">Aún no hay servicios disponibles.</p>}
              </div>
            </div>

            {/* Barbero */}
            {hasStaff && (
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">2. Elige el barbero</p>
                <div className="flex flex-wrap gap-2">
                  {(data.staff ?? []).map(s => (
                    <button
                      key={s.id}
                      onClick={() => setStaffId(s.id)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${staffId === s.id ? 'bg-primary-600 text-white border-primary-600' : 'bg-gray-100 text-gray-700 border-transparent hover:bg-gray-200'}`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Fecha */}
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-2">{hasStaff ? '3' : '2'}. Elige el día</p>
              <input type="date" min={todayStr()} value={date} onChange={e => setDate(e.target.value)} className="input" />
            </div>

            {/* Hora */}
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5"><Clock className="h-4 w-4 text-gray-400" /> {hasStaff ? '4' : '3'}. Elige la hora</p>
              {!serviceId ? (
                <p className="text-sm text-gray-500">Primero elige un servicio.</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-gray-500">No hay horarios disponibles ese día. Prueba otra fecha.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map(sl => (
                    <button
                      key={sl.iso}
                      onClick={() => setSlotIso(sl.iso)}
                      className={`py-2 rounded-lg text-sm font-medium border transition-colors ${slotIso === sl.iso ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-200 hover:border-primary-400'}`}
                    >
                      {sl.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Datos */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-900">{hasStaff ? '5' : '4'}. Tus datos</p>
              <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="Tu nombre" />
              <input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" className="input" placeholder="WhatsApp / teléfono" />
            </div>

            {data.config && data.config.deposit > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2.5 flex items-center gap-1.5">
                <Scissors className="h-4 w-4 flex-shrink-0" /> Se requiere una seña de {fmt(data.config.deposit)} para confirmar.
              </p>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button onClick={submit} disabled={!canSubmit || submitting} className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
              Reservar
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">Hecho con Jobidai</p>
      </div>
    </div>
  )
}
