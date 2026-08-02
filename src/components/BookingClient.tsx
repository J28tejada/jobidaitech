'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Scissors, CalendarCheck, CheckCircle2, Clock, Check, CalendarPlus, MapPin, ChevronRight } from 'lucide-react'

import { formatCurrency } from '@/lib/format'
import type { BookingHours } from '@/lib/booking'

interface Service { id: string; name: string; durationMin: number; price: number; imageUrl?: string | null }
interface Staff { id: string; name: string; imageUrl?: string | null; serviceIds?: string[] }
interface Config { slotMin: number; deposit: number; hours: BookingHours }
interface BookingData {
  enabled: boolean
  business: { name: string; coverUrl?: string | null; intro?: string | null; accent?: string | null }
  currency?: string
  locale?: string
  config?: Config
  services?: Service[]
  staff?: Staff[]
}

const pad = (n: number) => String(n).padStart(2, '0')
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const todayStr = () => dateKey(new Date())
// Formato 12 horas con am/pm (ej. 9:00 am, 2:30 pm).
const hm12 = (min: number) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  const ap = h < 12 ? 'am' : 'pm'
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${hh}:${pad(m)} ${ap}`
}

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// Iniciales para el avatar del barbero/negocio.
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w.charAt(0).toUpperCase())
    .join('') || '?'

// `id` puede ser el token largo o el slug corto de la barbería; la API pública
// resuelve ambos, así que el mismo componente sirve para /reservar/[token] y
// para el enlace corto /r/[slug].
export default function BookingClient({ id }: { id: string }) {
  const [data, setData] = useState<BookingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [serviceId, setServiceId] = useState('')
  const [staffId, setStaffId] = useState('') // '' = sin preferencia / cualquiera
  const [date, setDate] = useState(todayStr())
  const [taken, setTaken] = useState<{ startsAt: string; durationMin: number; staffId: string | null; serviceId: string | null }[]>([])
  const [slotIso, setSlotIso] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ when: string; iso: string; durationMin: number; serviceName: string } | null>(null)

  useEffect(() => {
    fetch(`/api/public/booking/${id}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: BookingData) => setData(d))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  // Cargar intervalos ocupados del día elegido.
  useEffect(() => {
    if (!data?.enabled || !date) return
    const from = new Date(`${date}T00:00:00`).toISOString()
    const to = new Date(`${date}T23:59:59`).toISOString()
    // Pedimos TODAS las citas del día (cualquier barbero). La capacidad por
    // servicio se calcula aquí con la lista de barberos y sus servicios.
    const url = `/api/public/booking/${id}/day?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    fetch(url)
      .then(r => (r.ok ? r.json() : { taken: [] }))
      .then(d => setTaken(d.taken || []))
      .catch(() => setTaken([]))
    setSlotIso('')
  }, [data, date, id])

  const fmt = (n: number) => formatCurrency(n, { currency: data?.currency, locale: data?.locale })
  const service = data?.services?.find(s => s.id === serviceId)
  const hasServices = (data?.services?.length ?? 0) > 0
  const selectedStaff = data?.staff?.find(s => s.id === staffId)

  const staffList = useMemo(() => data?.staff ?? [], [data])
  // Barberos que pueden hacer un servicio dado (los que no tienen servicios
  // marcados hacen todos). Sin servicio, todos pueden.
  const staffIdsForService = useMemo(
    () => (sid: string | null) =>
      staffList
        .filter(s => !s.serviceIds || s.serviceIds.length === 0 || !sid || s.serviceIds.includes(sid))
        .map(s => s.id),
    [staffList]
  )

  // Barberos que pueden hacer el servicio elegido (los que no tienen servicios
  // marcados hacen todos). Si aún no hay servicio elegido, se muestran todos.
  const eligibleStaff = useMemo(() => {
    if (!serviceId) return staffList
    return staffList.filter(s => !s.serviceIds || s.serviceIds.length === 0 || s.serviceIds.includes(serviceId))
  }, [staffList, serviceId])
  const hasStaff = eligibleStaff.length > 0
  const eligibleIds = useMemo(() => new Set(eligibleStaff.map(s => s.id)), [eligibleStaff])
  // Capacidad = nº de barberos que hacen ese servicio (mínimo 1 = "una silla").
  const capacity = Math.max(1, eligibleStaff.length)

  // Si el barbero elegido deja de poder hacer el servicio elegido, se deselecciona.
  useEffect(() => {
    if (staffId && !eligibleStaff.some(s => s.id === staffId)) setStaffId('')
  }, [eligibleStaff, staffId])

  // Próximos días abiertos (según el horario por día del negocio) como fichas.
  const openDays = useMemo(() => {
    const hours = data?.config?.hours
    if (!hours) return []
    const out: Date[] = []
    const cursor = new Date()
    cursor.setHours(0, 0, 0, 0)
    let guard = 0
    while (out.length < 14 && guard < 90) {
      if (hours[String(cursor.getDay())]) out.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
      guard++
    }
    return out
  }, [data])

  // Si el día elegido no está abierto, salta al primer día abierto.
  useEffect(() => {
    if (openDays.length === 0) return
    if (!openDays.some(d => dateKey(d) === date)) setDate(dateKey(openDays[0]))
  }, [openDays]) // eslint-disable-line react-hooks/exhaustive-deps

  const durationFor = service?.durationMin || data?.config?.slotMin || 30

  const slots = useMemo(() => {
    if (!data?.config?.hours) return []
    if (hasServices && !service) return [] // con catálogo, primero el servicio
    const cfg = data.config
    const weekday = new Date(`${date}T00:00:00`).getDay()
    const dayHours = cfg.hours[String(weekday)]
    if (!dayHours) return []
    const [oh, om] = dayHours.open.split(':').map(Number)
    const [ch, cm] = dayHours.close.split(':').map(Number)
    const openMin = oh * 60 + om
    const closeMin = ch * 60 + cm
    const dur = durationFor
    const now = Date.now()
    const out: { label: string; iso: string; hour: number }[] = []
    for (let t = openMin; t + dur <= closeMin; t += cfg.slotMin) {
      const start = new Date(`${date}T00:00:00`)
      start.setMinutes(t)
      const startMs = start.getTime()
      const endMs = startMs + dur * 60000
      if (startMs < now + 5 * 60000) continue
      const overlapping = taken.filter(iv => {
        const s = new Date(iv.startsAt).getTime()
        const e = s + iv.durationMin * 60000
        return startMs < e && s < endMs
      })
      // La disponibilidad depende del BARBERO, no del tipo de corte: una cita
      // ocupa a su barbero para CUALQUIER servicio. El servicio elegido solo
      // define QUÉ barberos pueden atenderlo (la capacidad).
      const relevant = overlapping.filter(iv => {
        // Cita con barbero asignado: ocupa a ese barbero.
        if (iv.staffId) return eligibleIds.has(iv.staffId)
        // "Sin preferencia": ocupa a alguno de los que pueden hacer ESE
        // servicio. Si alguno de ellos también atiende el servicio elegido,
        // consume capacidad.
        if (staffList.length === 0) return true // sin barberos: una sola silla
        return staffIdsForService(iv.serviceId).some(id => eligibleIds.has(id))
      })
      // Lleno si hay tantas citas como barberos que hacen el servicio, o si el
      // barbero elegido ya tiene una cita en ese rango (de cualquier servicio).
      const full = relevant.length >= capacity || (!!staffId && overlapping.some(iv => iv.staffId === staffId))
      if (!full) out.push({ label: hm12(t), iso: start.toISOString(), hour: Math.floor(t / 60) })
    }
    return out
  }, [data, service, hasServices, date, taken, durationFor, capacity, staffId, eligibleIds, staffList, staffIdsForService])

  // Agrupar horarios por franja para lectura rápida.
  const slotGroups = useMemo(() => {
    const g: { key: string; label: string; items: { label: string; iso: string; hour: number }[] }[] = [
      { key: 'am', label: 'Mañana', items: [] },
      { key: 'pm', label: 'Tarde', items: [] },
      { key: 'ev', label: 'Noche', items: [] },
    ]
    slots.forEach(sl => {
      if (sl.hour < 12) g[0].items.push(sl)
      else if (sl.hour < 18) g[1].items.push(sl)
      else g[2].items.push(sl)
    })
    return g.filter(x => x.items.length > 0)
  }, [slots])

  const submit = async () => {
    if (submitting || !slotIso) return
    setSubmitting(true)
    setError(null)
    try {
      const when = new Date(slotIso).toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true })
      const res = await fetch(`/api/public/booking/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, serviceId: serviceId || null, staffId: staffId || null, startsAt: slotIso, startsAtText: when }),
      })
      const b = await res.json().catch(() => null)
      if (!res.ok) throw new Error(b?.error || 'No se pudo reservar')
      setDone({ when, iso: slotIso, durationMin: durationFor, serviceName: service?.name || 'Cita' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al reservar')
    } finally {
      setSubmitting(false)
    }
  }

  // ---------- Estados de pantalla completa ----------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }
  if (notFound || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-6 text-center">
        <div>
          <CalendarCheck className="h-12 w-12 text-neutral-600 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-neutral-100">Enlace no encontrado</h1>
          <p className="text-neutral-500 text-sm mt-1">Revisa el enlace con el negocio.</p>
        </div>
      </div>
    )
  }
  if (!data.enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-6 text-center">
        <div>
          <CalendarCheck className="h-12 w-12 text-neutral-600 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-neutral-100">{data.business.name}</h1>
          <p className="text-neutral-500 text-sm mt-1">Las reservas online no están disponibles por ahora.</p>
        </div>
      </div>
    )
  }

  // ---------- Confirmación ----------
  if (done) {
    const start = new Date(done.iso)
    const end = new Date(start.getTime() + done.durationMin * 60000)
    const fmtCal = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${done.serviceName} · ${data.business.name}`)}&dates=${fmtCal(start)}/${fmtCal(end)}&details=${encodeURIComponent('Reserva hecha con Jobidai')}`
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4" style={{ ['--bk' as string]: data.business.accent || '#10b981' } as React.CSSProperties}>
        <div className="w-full max-w-md">
          <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-8 text-center shadow-2xl">
            <div className="h-16 w-16 rounded-full bk-tint15 border bk-border30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-9 w-9 bk-text" />
            </div>
            <h1 className="text-2xl font-bold text-white">¡Reserva confirmada!</h1>
            <p className="text-neutral-400 text-sm mt-1">Te esperamos en {data.business.name}.</p>

            <div className="mt-6 rounded-2xl bg-neutral-950/60 border border-neutral-800 p-4 text-left space-y-3">
              <div className="flex items-center gap-3">
                <Scissors className="h-4 w-4 bk-text flex-shrink-0" />
                <span className="text-sm text-neutral-200">{done.serviceName}{selectedStaff ? ` · con ${selectedStaff.name}` : ''}</span>
              </div>
              <div className="flex items-center gap-3">
                <CalendarCheck className="h-4 w-4 bk-text flex-shrink-0" />
                <span className="text-sm text-neutral-200 capitalize">{done.when}</span>
              </div>
            </div>

            {data.config && data.config.deposit > 0 && (
              <p className="text-sm text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mt-4 text-left">
                Se requiere una seña de <strong>{fmt(data.config.deposit)}</strong> para confirmar. El negocio te contactará por WhatsApp.
              </p>
            )}

            <a
              href={gcal}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-medium py-3 transition-colors"
            >
              <CalendarPlus className="h-4 w-4" /> Agregar a mi calendario
            </a>
          </div>
          <p className="text-center text-xs text-neutral-600 mt-4">Hecho con Jobidai</p>
        </div>
      </div>
    )
  }

  // ---------- Formulario de reserva ----------
  const canSubmit = !!slotIso && name.trim() && phone.trim() && (!hasServices || !!serviceId)
  const stepStaff = hasServices ? 2 : 1
  const stepDay = stepStaff + (hasStaff ? 1 : 0)
  const stepTime = stepDay + 1
  const stepDataN = stepTime + 1

  const inputCls =
    'w-full rounded-xl bg-neutral-800/70 border border-neutral-700 text-white placeholder-neutral-500 px-4 py-3 text-[15px] outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors'

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-28" style={{ ['--bk' as string]: data.business.accent || '#10b981' } as React.CSSProperties}>
      <div className="max-w-md mx-auto">
        {/* Encabezado */}
        <div className="relative overflow-hidden">
          {data.business.coverUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.business.coverUrl} alt={data.business.name} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/25" />
            </>
          ) : (
            <>
              <div className="absolute inset-0 bk-grad" />
              <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            </>
          )}
          <div className={`relative px-6 pb-8 ${data.business.coverUrl ? 'pt-24' : 'pt-9'}`}>
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-white/15 backdrop-blur border border-white/20 flex items-center justify-center text-white font-bold text-xl">
                {initials(data.business.name)}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-widest text-white/70 font-medium">Reservar cita</p>
                <h1 className="text-2xl font-bold text-white leading-tight truncate">{data.business.name}</h1>
              </div>
            </div>
            {data.business.intro ? (
              <p className="mt-3 text-sm text-white/90 max-w-md">{data.business.intro}</p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 text-[12px] text-white/90 bg-black/20 rounded-full px-3 py-1">
                  <MapPin className="h-3.5 w-3.5" /> Reserva en segundos
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 sm:px-5 pt-5 space-y-6">
          {/* 1. Servicio */}
          {hasServices ? (
            <section>
              <StepHead n={1} title="Elige el servicio" />
              <div className="space-y-2.5">
                {(data.services ?? []).map(s => {
                  const active = serviceId === s.id
                  return (
                    <button
                      key={s.id}
                      onClick={() => setServiceId(s.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${active ? 'bk-border bk-tint' : 'border-neutral-800 bg-neutral-900 hover:border-neutral-700'}`}
                    >
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 border ${active ? 'bk-bg bk-border' : 'border-neutral-600'}`}>
                        {active && <Check className="h-3.5 w-3.5 text-white" />}
                      </div>
                      {s.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.imageUrl} alt={s.name} className="h-12 w-12 rounded-lg object-cover flex-shrink-0 border border-neutral-700" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-medium text-white truncate">{s.name}</p>
                        <p className="text-xs text-neutral-400 mt-0.5">{s.durationMin} min</p>
                      </div>
                      {s.price > 0 && <span className="text-[15px] font-semibold bk-text flex-shrink-0">{fmt(s.price)}</span>}
                    </button>
                  )
                })}
              </div>
            </section>
          ) : (
            <p className="text-sm text-neutral-400 bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
              Reserva tu cita y la barbería confirmará el servicio contigo.
            </p>
          )}

          {/* Barbero */}
          {hasStaff && (
            <section>
              <StepHead n={stepStaff} title="Elige tu barbero" />
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                <StaffChip label="Sin preferencia" sub="Cualquiera" active={staffId === ''} onClick={() => setStaffId('')} />
                {eligibleStaff.map(s => (
                  <StaffChip key={s.id} label={s.name} sub={initials(s.name)} imageUrl={s.imageUrl} active={staffId === s.id} onClick={() => setStaffId(s.id)} avatar />
                ))}
              </div>
            </section>
          )}

          {/* Día */}
          <section>
            <StepHead n={stepDay} title="Elige el día" />
            {openDays.length === 0 ? (
              <p className="text-sm text-neutral-400">No hay días disponibles configurados.</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                {openDays.map(d => {
                  const key = dateKey(d)
                  const active = key === date
                  const isToday = key === todayStr()
                  return (
                    <button
                      key={key}
                      onClick={() => setDate(key)}
                      className={`flex-shrink-0 w-16 rounded-2xl border py-3 flex flex-col items-center gap-0.5 transition-all ${active ? 'bk-border bk-tint' : 'border-neutral-800 bg-neutral-900 hover:border-neutral-700'}`}
                    >
                      <span className={`text-[11px] uppercase ${active ? 'bk-text' : 'text-neutral-500'}`}>{isToday ? 'hoy' : WEEKDAYS[d.getDay()]}</span>
                      <span className={`text-xl font-bold ${active ? 'text-white' : 'text-neutral-200'}`}>{d.getDate()}</span>
                      <span className="text-[11px] text-neutral-500">{MONTHS[d.getMonth()]}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          {/* Hora */}
          <section>
            <StepHead n={stepTime} title="Elige la hora" icon={<Clock className="h-3.5 w-3.5" />} />
            {hasServices && !service ? (
              <p className="text-sm text-neutral-400">Primero elige un servicio.</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-neutral-400">No hay horarios disponibles ese día. Prueba otra fecha.</p>
            ) : (
              <div className="space-y-4">
                {slotGroups.map(g => (
                  <div key={g.key}>
                    <p className="text-[11px] uppercase tracking-wide text-neutral-500 mb-2">{g.label}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {g.items.map(sl => {
                        const active = slotIso === sl.iso
                        return (
                          <button
                            key={sl.iso}
                            onClick={() => setSlotIso(sl.iso)}
                            className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${active ? 'bk-bg text-white bk-border' : 'bg-neutral-900 text-neutral-200 border-neutral-800 bk-border-hover'}`}
                          >
                            {sl.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Datos */}
          <section>
            <StepHead n={stepDataN} title="Tus datos" />
            <div className="space-y-2.5">
              <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="Tu nombre" />
              <input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" className={inputCls} placeholder="WhatsApp / teléfono" />
            </div>
          </section>

          {data.config && data.config.deposit > 0 && (
            <p className="text-[13px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
              <Scissors className="h-4 w-4 flex-shrink-0 mt-0.5" /> Se requiere una seña de <strong>{fmt(data.config.deposit)}</strong> para confirmar tu cita.
            </p>
          )}

          {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</p>}

          <p className="text-center text-xs text-neutral-600 pt-2">Hecho con Jobidai</p>
        </div>
      </div>

      {/* Barra fija de reserva */}
      <div className="fixed bottom-0 inset-x-0 z-20 border-t border-neutral-800 bg-neutral-950/90 backdrop-blur">
        <div className="max-w-md mx-auto px-4 py-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
          {(service || slotIso) && (
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="text-neutral-400 truncate">
                {service ? service.name : 'Cita'}
                {slotIso && <span className="text-neutral-500"> · {new Date(slotIso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}</span>}
              </span>
              {service && service.price > 0 && <span className="font-semibold bk-text flex-shrink-0 ml-2">{fmt(service.price)}</span>}
            </div>
          )}
          <button
            onClick={submit}
            disabled={!canSubmit || submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bk-bg bk-bg-hover text-white font-semibold py-3.5 transition-colors disabled:bg-neutral-800 disabled:text-neutral-500"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CalendarCheck className="h-5 w-5" /> Reservar cita <ChevronRight className="h-4 w-4 opacity-70" /></>}
          </button>
        </div>
      </div>
    </div>
  )
}

function StepHead({ n, title, icon }: { n: number; title: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span className="h-6 w-6 rounded-full bk-tint15 border bk-border30 bk-text text-xs font-bold flex items-center justify-center flex-shrink-0">
        {n}
      </span>
      <h2 className="text-[15px] font-semibold text-white flex items-center gap-1.5">{icon}{title}</h2>
    </div>
  )
}

function StaffChip({ label, sub, imageUrl, active, onClick, avatar }: { label: string; sub: string; imageUrl?: string | null; active: boolean; onClick: () => void; avatar?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-24 rounded-2xl border p-3 flex flex-col items-center gap-2 transition-all ${active ? 'bk-border bk-tint' : 'border-neutral-800 bg-neutral-900 hover:border-neutral-700'}`}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={label} className={`h-12 w-12 rounded-full object-cover border-2 ${active ? 'bk-border' : 'border-neutral-700'}`} />
      ) : (
        <div className={`h-12 w-12 rounded-full flex items-center justify-center text-sm font-bold ${active ? 'bk-bg text-white' : 'bg-neutral-800 text-neutral-300'}`}>
          {avatar ? sub : <Scissors className="h-5 w-5" />}
        </div>
      )}
      <span className={`text-[12px] text-center leading-tight truncate w-full ${active ? 'text-white' : 'text-neutral-300'}`}>{label}</span>
    </button>
  )
}
