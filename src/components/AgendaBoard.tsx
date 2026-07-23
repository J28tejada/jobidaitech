'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus,
  ChevronRight,
  CalendarClock,
  CalendarDays,
  Clock,
  Scissors,
  Settings2,
  Users,
  UserPlus,
  Coins,
  Check,
  CheckCircle2,
  XCircle,
  Ban,
  MessageCircle,
  Phone,
  Edit,
  Trash2,
  Loader2,
  X,
  Image as ImageIcon,
} from 'lucide-react'

import { useToast } from './Toaster'
import { useConfirm } from './ConfirmDialog'
import { useCurrency } from './CurrencyProvider'
import { verticalFor, type VerticalConfig } from '@/lib/verticals'
import type { ServiceVariant } from '@/lib/services'

type Status = 'scheduled' | 'confirmed' | 'done' | 'cancelled' | 'no_show'
const STATUS_META: Record<Status, { label: string; badge: string }> = {
  scheduled: { label: 'Agendada', badge: 'bg-blue-100 text-blue-700' },
  confirmed: { label: 'Confirmada', badge: 'bg-primary-100 text-primary-700' },
  done: { label: 'Atendida', badge: 'bg-success-100 text-success-700' },
  cancelled: { label: 'Cancelada', badge: 'bg-danger-100 text-danger-700' },
  no_show: { label: 'No asistió', badge: 'bg-yellow-100 text-yellow-700' },
}

interface Service {
  id: string
  name: string
  durationMin: number
  price: number
  variants: ServiceVariant[]
  imageUrl: string | null
  active: boolean
}
interface Staff {
  id: string
  name: string
  commissionPct: number
  phone: string | null
  email: string | null
  imageUrl: string | null
  active: boolean
}
interface Appointment {
  id: string
  clientId: string | null
  clientName: string
  clientPhone: string | null
  serviceId: string | null
  staffId: string | null
  staffName: string
  title: string
  startsAt: string
  durationMin: number
  price: number
  tip: number
  status: Status
  notes: string
}
interface ClientOption {
  id: string
  name: string
  phone: string | null
}

const pad = (n: number) => String(n).padStart(2, '0')
const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
// Formato 12 horas con am/pm (ej. 8:00 pm).
const timeLabel = (iso: string) => {
  const d = new Date(iso)
  let h = d.getHours()
  const m = d.getMinutes()
  const ap = h < 12 ? 'am' : 'pm'
  h = h % 12 === 0 ? 12 : h % 12
  return `${h}:${pad(m)} ${ap}`
}
const dateKey = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
// Semáforo de la hora: verde = a tiempo, amarillo = próxima (≤30 min), rojo =
// ya pasó la hora. No aplica a citas cerradas (atendida/cancelada/no asistió).
type Tone = 'green' | 'yellow' | 'red' | null
function timingTone(startsAt: string, status: Status, now: number): Tone {
  if (status === 'done' || status === 'cancelled' || status === 'no_show') return null
  const diffMin = (new Date(startsAt).getTime() - now) / 60000
  if (diffMin <= 0) return 'red'
  if (diffMin <= 30) return 'yellow'
  return 'green'
}
const TONE_DOT: Record<'green' | 'yellow' | 'red', string> = {
  green: 'bg-green-500',
  yellow: 'bg-amber-400',
  red: 'bg-red-500',
}
const TONE_LABEL: Record<'green' | 'yellow' | 'red', string> = {
  green: 'A tiempo',
  yellow: 'Próxima',
  red: 'Ya pasó',
}
const TONE_TEXT: Record<'green' | 'yellow' | 'red', string> = {
  green: 'text-green-600',
  yellow: 'text-amber-600',
  red: 'text-red-600',
}

const dayHeading = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = new Date()
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diff = Math.round((date.getTime() - t0.getTime()) / 86_400_000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function AgendaBoard() {
  const toast = useToast()
  const confirm = useConfirm()
  const { format } = useCurrency()

  const [items, setItems] = useState<Appointment[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [summary, setSummary] = useState<{ todayCount: number; upcomingCount: number; todayIncome: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [dayFilter, setDayFilter] = useState('')
  const [businessType, setBusinessType] = useState<string | null>(null)
  const vertical = verticalFor(businessType)
  // Reloj que tiquea cada minuto para actualizar el "semáforo" de las horas.
  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const [mounted, setMounted] = useState(false)
  const [detail, setDetail] = useState<Appointment | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [showServices, setShowServices] = useState(false)
  const [showStaff, setShowStaff] = useState(false)
  const [showCommissions, setShowCommissions] = useState(false)
  const [showWalkIn, setShowWalkIn] = useState(false)
  const [doneTarget, setDoneTarget] = useState<Appointment | null>(null)
  const [postponeTarget, setPostponeTarget] = useState<Appointment | null>(null)

  useEffect(() => {
    setMounted(true)
    loadStatic()
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search)
      // Botón "+" flotante: abrir el formulario de nueva cita.
      if (q.get('new') === 'true') {
        setEditing(null)
        setShowForm(true)
        window.history.replaceState({}, '', window.location.pathname)
      }
      // Desde "Reservas → Servicios y precios": abrir el catálogo de servicios.
      if (q.get('services') === '1') {
        setShowServices(true)
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
  }, [])

  useEffect(() => {
    loadAppointments()
  }, [dayFilter])

  const loadStatic = async () => {
    const [s, c, st] = await Promise.all([
      fetch('/api/services', { credentials: 'include' }).then(r => (r.ok ? r.json() : [])),
      fetch('/api/clients', { credentials: 'include' }).then(r => (r.ok ? r.json() : [])),
      fetch('/api/staff', { credentials: 'include' }).then(r => (r.ok ? r.json() : [])),
    ])
    setServices(Array.isArray(s) ? s : [])
    setStaff(Array.isArray(st) ? st : [])
    setClients(Array.isArray(c) ? c.map((x: any) => ({ id: x.id, name: x.name, phone: x.phone })) : [])
    fetch('/api/subscription', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && typeof d.businessType === 'string') setBusinessType(d.businessType) })
      .catch(() => {})
    fetchSummary()
  }

  const fetchSummary = () => {
    const tz = new Date().getTimezoneOffset()
    fetch(`/api/appointments/summary?tzOffset=${tz}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => d && setSummary(d))
      .catch(() => {})
  }

  const loadAppointments = async () => {
    setLoading(true)
    try {
      let url = '/api/appointments'
      if (dayFilter) {
        const start = new Date(`${dayFilter}T00:00:00`)
        const end = new Date(start.getTime() + 86_400_000)
        url += `?from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`
      } else {
        const now = new Date()
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const end = new Date(start.getTime() + 14 * 86_400_000)
        url += `?from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`
      }
      const res = await fetch(url, { credentials: 'include' })
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const refreshAll = async () => {
    await loadAppointments()
    fetchSummary()
  }

  const setStatus = async (item: Appointment, status: Status, msg: string, tip?: number) => {
    const body: Record<string, unknown> = { status }
    if (tip !== undefined) body.tip = tip
    const res = await fetch(`/api/appointments/${item.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    if (res.ok) toast.success(msg)
    else toast.error('No se pudo actualizar la cita')
    await refreshAll()
  }

  const remove = async (item: Appointment) => {
    const ok = await confirm({ title: 'Eliminar cita', message: `¿Eliminar la cita de ${item.clientName}?`, confirmText: 'Eliminar', danger: true })
    if (!ok) return
    const res = await fetch(`/api/appointments/${item.id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) toast.success('Cita eliminada')
    else toast.error('No se pudo eliminar')
    await refreshAll()
  }

  const reminderLink = (item: Appointment) => {
    const digits = (item.clientPhone || '').replace(/\D/g, '')
    const when = `${dayHeading(dateKey(item.startsAt)).toLowerCase()} a las ${timeLabel(item.startsAt)}`
    const msg = `Hola ${item.clientName}, te recuerdo tu cita${item.title ? ` de ${item.title}` : ''} ${when}. ¡Te esperamos!`
    return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`
  }

  // Agrupar por día
  const groups: { key: string; list: Appointment[] }[] = []
  for (const a of items) {
    const k = dateKey(a.startsAt)
    let g = groups.find(x => x.key === k)
    if (!g) { g = { key: k, list: [] }; groups.push(g) }
    g.list.push(a)
  }

  // Fila de espera de hoy (walk-ins y citas aún no atendidas).
  const todayKey = dateKey(new Date().toISOString())
  const waitingToday = items.filter(a => dateKey(a.startsAt) === todayKey && (a.status === 'scheduled' || a.status === 'confirmed')).length

  if (loading && items.length === 0 && !summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Agenda</h1>
          <p className="text-gray-600 mt-1 sm:mt-2">Tus citas del día y de los próximos días.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto flex-wrap justify-end">
          <button onClick={() => setShowCommissions(true)} className="btn btn-secondary flex items-center justify-center" title={`Comisiones por ${vertical.staffSingular.toLowerCase()}`}>
            <Coins className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Comisiones</span>
          </button>
          <button onClick={() => setShowStaff(true)} className="btn btn-secondary flex items-center justify-center" title={vertical.staffPlural}>
            <Users className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">{vertical.staffPlural}</span>
          </button>
          <button onClick={() => setShowServices(true)} className="btn btn-secondary flex items-center justify-center" title="Servicios">
            <Settings2 className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Servicios</span>
          </button>
          <button onClick={() => { setEditing(null); setShowForm(true) }} className="btn btn-primary flex items-center justify-center flex-1 sm:flex-none">
            <Plus className="h-4 w-4 mr-1.5" /> Nueva cita
          </button>
        </div>
      </div>

      {/* Resumen de hoy */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card border-l-4 border-l-primary-600">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Citas hoy</p>
          <p className="text-2xl font-bold text-gray-900">{summary?.todayCount ?? 0}</p>
        </div>
        <div className="card border-l-4 border-l-success-600">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ingreso estimado hoy</p>
          <p className="text-2xl font-bold text-gray-900">{format(summary?.todayIncome ?? 0)}</p>
        </div>
      </div>

      {/* Controles: walk-in + ver un día */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => setShowWalkIn(true)} className="btn btn-secondary text-sm flex items-center gap-1.5">
          <UserPlus className="h-4 w-4" /> Sin cita (walk-in)
        </button>
        {waitingToday > 0 && <span className="text-sm text-gray-500">{waitingToday} en espera hoy</span>}
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-sm text-gray-500 whitespace-nowrap">Ver un día</label>
          <input type="date" className="input py-1.5 w-auto" value={dayFilter} onChange={e => setDayFilter(e.target.value)} />
          {dayFilter && (
            <button onClick={() => setDayFilter('')} className="text-xs text-primary-600 whitespace-nowrap">Próximas</button>
          )}
        </div>
      </div>

      {/* Agenda por día */}
      {items.length === 0 ? (
        <div className="text-center py-12">
          <CalendarClock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay citas {dayFilter ? 'este día' : 'próximas'}</h3>
          <p className="text-gray-500 mb-4">Agenda tu primera cita para empezar.</p>
          <button onClick={() => { setEditing(null); setShowForm(true) }} className="btn btn-primary text-sm">Nueva cita</button>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(g => (
            <div key={g.key}>
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="h-4 w-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-700 capitalize">{dayHeading(g.key)}</h2>
                <span className="text-xs text-gray-400">({g.list.length})</span>
              </div>
              <div className="space-y-2">
                {g.list.map(item => {
                  const tone = timingTone(item.startsAt, item.status, now)
                  return (
                  <button
                    key={item.id}
                    onClick={() => setDetail(item)}
                    className={`card w-full flex items-center gap-3 text-left hover:border-primary-300 transition-colors ${item.status === 'cancelled' || item.status === 'no_show' ? 'opacity-60' : ''}`}
                  >
                    <div className="relative flex flex-col items-center justify-center bg-primary-50 rounded-lg px-2.5 py-1.5 flex-shrink-0">
                      {tone && <span className={`absolute top-1 right-1 h-2 w-2 rounded-full ${TONE_DOT[tone]} ${tone === 'yellow' ? 'animate-pulse' : ''}`} />}
                      <Clock className="h-3.5 w-3.5 text-primary-600" />
                      <span className="text-sm font-bold text-primary-700 mt-0.5">{timeLabel(item.startsAt)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{item.clientName}</h3>
                        <span className={`badge ${STATUS_META[item.status].badge}`}>{STATUS_META[item.status].label}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {item.title || 'Cita'} · {item.durationMin} min{item.price > 0 ? ` · ${format(item.price)}` : ''}
                        {item.staffName ? ` · ✂ ${item.staffName}` : ''}
                        {item.tip > 0 ? ` · propina ${format(item.tip)}` : ''}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-300 flex-shrink-0" />
                  </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detalle de la cita */}
      {detail && (
        <AppointmentDetail
          appointment={detail}
          vertical={vertical}
          reminderHref={reminderLink(detail)}
          onClose={() => setDetail(null)}
          onConfirm={() => { const it = detail; setDetail(null); setStatus(it, 'confirmed', 'Cita confirmada') }}
          onDone={() => { const it = detail; setDetail(null); setDoneTarget(it) }}
          onCancel={() => { const it = detail; setDetail(null); setStatus(it, 'cancelled', 'Cita cancelada') }}
          onNoShow={() => { const it = detail; setDetail(null); setStatus(it, 'no_show', 'Marcada: no asistió') }}
          onPostpone={() => { const it = detail; setDetail(null); setPostponeTarget(it) }}
          onEdit={() => { const it = detail; setDetail(null); setEditing(it); setShowForm(true) }}
          onDelete={() => { const it = detail; setDetail(null); remove(it) }}
        />
      )}

      {showForm && (
        <AppointmentForm
          appointment={editing}
          services={services}
          staff={staff}
          clients={clients}
          vertical={vertical}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={async () => {
            const wasEditing = !!editing
            setShowForm(false)
            setEditing(null)
            await refreshAll()
            toast.success(wasEditing ? 'Cita actualizada' : 'Cita agendada')
          }}
        />
      )}

      {showServices && (
        <ServicesManager
          services={services}
          vertical={vertical}
          onClose={() => setShowServices(false)}
          onChanged={async () => { await loadStatic() }}
        />
      )}

      {showStaff && (
        <StaffManager
          staff={staff}
          vertical={vertical}
          onClose={() => setShowStaff(false)}
          onChanged={async () => { await loadStatic() }}
        />
      )}

      {showCommissions && <CommissionsSheet vertical={vertical} onClose={() => setShowCommissions(false)} />}

      {showWalkIn && (
        <WalkInForm
          services={services}
          staff={staff}
          clients={clients}
          vertical={vertical}
          onClose={() => setShowWalkIn(false)}
          onSaved={async () => { setShowWalkIn(false); await refreshAll(); toast.success('Walk-in agregado a la fila') }}
        />
      )}

      {doneTarget && (
        <DoneDialog
          appointment={doneTarget}
          onClose={() => setDoneTarget(null)}
          onConfirm={async (tip) => {
            const it = doneTarget
            setDoneTarget(null)
            await setStatus(it, 'done', 'Cita atendida', tip)
          }}
        />
      )}

      {postponeTarget && (
        <PostponeDialog
          appointment={postponeTarget}
          onClose={() => setPostponeTarget(null)}
          onSaved={async () => { setPostponeTarget(null); await refreshAll(); toast.success('Cita pospuesta') }}
        />
      )}
    </div>
  )
}

function Btn({ icon: Icon, label, onClick, color, danger }: { icon: any; label: string; onClick: () => void; color?: string; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}`}>
      <Icon className={`h-4 w-4 ${color ?? 'text-gray-400'}`} /> {label}
    </button>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1.5">
      <span className="text-sm text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right break-words">{value}</span>
    </div>
  )
}

function AppointmentDetail({
  appointment, vertical, reminderHref, onClose, onConfirm, onDone, onCancel, onNoShow, onPostpone, onEdit, onDelete,
}: {
  appointment: Appointment
  vertical: VerticalConfig
  reminderHref: string
  onClose: () => void
  onConfirm: () => void
  onDone: () => void
  onCancel: () => void
  onNoShow: () => void
  onPostpone: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { format } = useCurrency()
  const a = appointment
  const phoneDigits = (a.clientPhone || '').replace(/\D/g, '')
  const dateLabel = dayHeading(dateKey(a.startsAt))
  const fullDate = new Date(a.startsAt).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const tone = timingTone(a.startsAt, a.status, Date.now())

  // Cuando ya pasó la hora, en vez de "recordar" preguntamos si sigue en
  // camino o prefiere reagendar (más útil que un recordatorio tardío).
  const followUpHref = () => {
    const msg = `Saludos, ${a.clientName}. Tenía agendada su cita${a.title ? ` de ${a.title}` : ''} ${dateLabel.toLowerCase()} a las ${timeLabel(a.startsAt)}. ¿Sigue en camino o prefiere reprogramarla? Quedamos atentos.`
    return phoneDigits ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`
  }

  return (
    <Sheet title="Detalle de la cita" onClose={onClose}>
      {/* Hora + estado */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            {tone && <span className={`h-2.5 w-2.5 rounded-full ${TONE_DOT[tone]} ${tone === 'yellow' ? 'animate-pulse' : ''}`} />}
            <p className="text-2xl font-bold text-gray-900">{timeLabel(a.startsAt)}</p>
            {tone && <span className={`text-xs font-medium ${TONE_TEXT[tone]}`}>{TONE_LABEL[tone]}</span>}
          </div>
          <p className="text-sm text-gray-500 capitalize">{dateLabel !== fullDate ? `${dateLabel} · ` : ''}{fullDate} · {a.durationMin} min</p>
        </div>
        <span className={`badge ${STATUS_META[a.status].badge}`}>{STATUS_META[a.status].label}</span>
      </div>

      {/* Aviso cuando ya pasó la hora y sigue abierta */}
      {tone === 'red' && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3 mb-4">
          Ya pasó la hora de esta cita. ¿Fue atendida, no asistió o quieres posponerla?
        </div>
      )}

      {/* Cliente + contacto */}
      <div className="rounded-xl border border-gray-200 p-3 mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{a.clientName}</p>
          {a.clientPhone && <p className="text-xs text-gray-500 truncate">{a.clientPhone}</p>}
        </div>
        {phoneDigits && (
          <div className="flex gap-2 flex-shrink-0">
            <a href={`tel:${phoneDigits}`} className="h-9 w-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700" aria-label="Llamar">
              <Phone className="h-4 w-4" />
            </a>
            <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-full bg-green-50 hover:bg-green-100 flex items-center justify-center text-green-600" aria-label="WhatsApp">
              <MessageCircle className="h-4 w-4" />
            </a>
          </div>
        )}
      </div>

      {/* Info principal */}
      <div className="divide-y divide-gray-100 mb-4">
        <InfoRow label="Servicio" value={a.title || 'Cita'} />
        {a.staffName && <InfoRow label={vertical.staffSingular} value={a.staffName} />}
        {a.price > 0 && <InfoRow label="Precio" value={format(a.price)} />}
        {a.tip > 0 && <InfoRow label="Propina" value={format(a.tip)} />}
        {a.notes && <InfoRow label="Notas" value={a.notes} />}
      </div>

      {/* WhatsApp: recordar (antes) o preguntar si sigue en camino (ya pasó) */}
      {tone === 'red' ? (
        <a href={followUpHref()} target="_blank" rel="noopener noreferrer" className="btn btn-secondary w-full flex items-center justify-center gap-2 mb-3">
          <MessageCircle className="h-4 w-4 text-green-500" /> Preguntar por WhatsApp
        </a>
      ) : (
        <a href={reminderHref} target="_blank" rel="noopener noreferrer" className="btn btn-secondary w-full flex items-center justify-center gap-2 mb-3">
          <MessageCircle className="h-4 w-4 text-green-500" /> Recordar por WhatsApp
        </a>
      )}

      {/* Acciones de estado */}
      <div className="rounded-xl border border-gray-100 overflow-hidden mb-3">
        {a.status === 'scheduled' && <Btn icon={Check} color="text-primary-600" label="Confirmar" onClick={onConfirm} />}
        {a.status !== 'done' && <Btn icon={CheckCircle2} color="text-success-600" label="Marcar atendida" onClick={onDone} />}
        <Btn icon={CalendarClock} color="text-blue-500" label="Posponer" onClick={onPostpone} />
        {a.status !== 'cancelled' && <Btn icon={XCircle} label="Cancelar" onClick={onCancel} />}
        {a.status !== 'no_show' && <Btn icon={Ban} label="No asistió" onClick={onNoShow} />}
      </div>

      {/* Editar / Eliminar */}
      <div className="flex gap-2">
        <button onClick={onEdit} className="btn btn-secondary flex-1 flex items-center justify-center gap-1.5">
          <Edit className="h-4 w-4" /> Editar
        </button>
        <button onClick={onDelete} className="btn flex-1 flex items-center justify-center gap-1.5 text-red-600 border border-red-200 hover:bg-red-50">
          <Trash2 className="h-4 w-4" /> Eliminar
        </button>
      </div>
    </Sheet>
  )
}

function PostponeDialog({ appointment, onClose, onSaved }: { appointment: Appointment; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [when, setWhen] = useState(toLocalInput(appointment.startsAt))
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving || !when) return
    setSaving(true)
    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ startsAt: new Date(when).toISOString() }),
      })
      if (!res.ok) throw new Error()
      // Si la cita estaba cerrada, la reactivamos a "agendada".
      if (appointment.status === 'cancelled' || appointment.status === 'no_show' || appointment.status === 'done') {
        await fetch(`/api/appointments/${appointment.id}/status`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ status: 'scheduled' }),
        })
      }
      onSaved()
    } catch {
      toast.error('No se pudo posponer la cita')
      setSaving(false)
    }
  }

  return (
    <Sheet title="Posponer cita" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-600">{appointment.clientName}{appointment.title ? ` · ${appointment.title}` : ''}</p>
        <div>
          <label className="label">Nueva fecha y hora</label>
          <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} className="input" required />
        </div>
        <button type="submit" disabled={saving} className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} Posponer cita
        </button>
      </form>
    </Sheet>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  )
}

function AppointmentForm({ appointment, services, staff, clients, vertical, onClose, onSaved }: { appointment: Appointment | null; services: Service[]; staff: Staff[]; clients: ClientOption[]; vertical: VerticalConfig; onClose: () => void; onSaved: () => void }) {
  const { format } = useCurrency()
  const defaultWhen = () => {
    const d = new Date()
    d.setMinutes(0, 0, 0)
    d.setHours(d.getHours() + 1)
    return toLocalInput(d.toISOString())
  }
  const [clientId, setClientId] = useState(appointment?.clientId ?? '')
  const [clientName, setClientName] = useState(appointment?.clientId ? '' : appointment?.clientName ?? '')
  const [clientPhone, setClientPhone] = useState(appointment?.clientPhone ?? '')
  const [serviceId, setServiceId] = useState(appointment?.serviceId ?? '')
  const [staffId, setStaffId] = useState(appointment?.staffId ?? '')
  const [title, setTitle] = useState(appointment?.title ?? '')
  const [variantLabel, setVariantLabel] = useState('')
  const [when, setWhen] = useState(appointment ? toLocalInput(appointment.startsAt) : defaultWhen())
  const [durationMin, setDurationMin] = useState(String(appointment?.durationMin ?? 30))
  const [price, setPrice] = useState(String(appointment?.price ?? ''))
  const [tip, setTip] = useState(appointment?.tip ? String(appointment.tip) : '')
  const [notes, setNotes] = useState(appointment?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pickService = (id: string) => {
    setServiceId(id)
    setVariantLabel('')
    const s = services.find(x => x.id === id)
    if (s) {
      setTitle(s.name)
      setDurationMin(String(s.durationMin))
      // Si el servicio tiene variantes de precio, arranca con la primera.
      if (s.variants.length > 0) {
        setPrice(String(s.variants[0].price))
        setVariantLabel(s.variants[0].label)
        setTitle(`${s.name} (${s.variants[0].label})`)
      } else {
        setPrice(String(s.price))
      }
    }
  }

  const pickVariant = (svc: Service, v: ServiceVariant | null) => {
    if (v) {
      setVariantLabel(v.label)
      setPrice(String(v.price))
      setTitle(`${svc.name} (${v.label})`)
    } else {
      setVariantLabel('')
      setPrice(String(svc.price))
      setTitle(svc.name)
    }
  }

  const selService = services.find(x => x.id === serviceId)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      if (!when) throw new Error('Indica la fecha y hora')
      const payload = {
        clientId: clientId || null,
        clientName: clientId ? undefined : clientName,
        clientPhone,
        serviceId: serviceId || null,
        staffId: staffId || null,
        title,
        startsAt: new Date(when).toISOString(),
        durationMin: Number(durationMin) || 30,
        price: Number(price) || 0,
        tip: tip === '' ? undefined : Number(tip) || 0,
        notes,
      }
      const res = appointment
        ? await fetch(`/api/appointments/${appointment.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
        : await fetch('/api/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
      if (!res.ok) {
        const b = await res.json().catch(() => null)
        throw new Error(b?.error || 'No se pudo guardar')
      }
      // Si hay un cliente vinculado y cambió su teléfono, lo actualizamos en su
      // ficha para que reservas, recordatorios e historial queden al día.
      const originalPhone = appointment?.clientPhone ?? ''
      if (clientId && clientPhone.trim() && clientPhone.trim() !== originalPhone) {
        fetch(`/api/clients/${clientId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ phone: clientPhone.trim() }),
        }).catch(() => {})
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title={appointment ? 'Editar cita' : 'Nueva cita'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Cliente *</label>
          {clients.length > 0 && (
            <select
              className="input mb-2"
              value={clientId}
              onChange={e => {
                const id = e.target.value
                setClientId(id)
                if (id) {
                  setClientName('')
                  const c = clients.find(x => x.id === id)
                  setClientPhone(c?.phone ?? '')
                }
              }}
            >
              <option value="">— Escribir a mano —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {!clientId && (
            <input value={clientName} onChange={e => setClientName(e.target.value)} className="input mb-2" placeholder="Nombre del cliente" />
          )}
          <input value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="input" placeholder="WhatsApp / teléfono" inputMode="tel" />
          {clientId && <p className="text-xs text-gray-500 mt-1">Si cambias el número, se actualiza también en la ficha del cliente.</p>}
        </div>

        {services.length > 0 && (
          <div>
            <label className="label">Servicio</label>
            <select className="input" value={serviceId} onChange={e => pickService(e.target.value)}>
              <option value="">— Sin servicio —</option>
              {services.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name} ({s.durationMin} min)</option>)}
            </select>
            {selService?.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selService.imageUrl} alt={selService.name} className="mt-2 h-24 w-24 rounded-lg object-cover border border-gray-200" />
            )}
            {selService && selService.variants.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selService.variants.map(v => (
                  <button
                    key={v.label}
                    type="button"
                    onClick={() => pickVariant(selService, v)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${variantLabel === v.label ? 'bg-primary-600 text-white border-primary-600' : 'bg-gray-100 text-gray-700 border-transparent hover:bg-gray-200'}`}
                  >
                    {v.label} · {format(v.price)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => pickVariant(selService, null)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${!variantLabel ? 'bg-primary-600 text-white border-primary-600' : 'bg-gray-100 text-gray-700 border-transparent hover:bg-gray-200'}`}
                >
                  General · {format(selService.price)}
                </button>
              </div>
            )}
          </div>
        )}

        {staff.length > 0 && (
          <div>
            <label className="label">{vertical.staffSingular}</label>
            <select className="input" value={staffId} onChange={e => setStaffId(e.target.value)}>
              <option value="">— Sin asignar —</option>
              {staff.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="label">Título</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="input" placeholder="Ej. Corte de cabello" />
        </div>

        <div>
          <label className="label">Fecha y hora *</label>
          <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} className="input" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Duración (min)</label>
            <input value={durationMin} onChange={e => setDurationMin(e.target.value)} type="number" min="1" className="input" />
          </div>
          <div>
            <label className="label">Precio</label>
            <input value={price} onChange={e => setPrice(e.target.value)} type="number" step="0.01" min="0" className="input" placeholder="0.00" />
          </div>
        </div>

        <div>
          <label className="label">Propina (opcional)</label>
          <input value={tip} onChange={e => setTip(e.target.value)} type="number" step="0.01" min="0" className="input" placeholder="0.00" />
        </div>

        <div>
          <label className="label">Notas</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="input" placeholder="Opcional" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving} className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {appointment ? 'Guardar cambios' : 'Agendar cita'}
        </button>
      </form>
    </Sheet>
  )
}

function ServicesManager({ services, vertical, onClose, onChanged }: { services: Service[]; vertical: VerticalConfig; onClose: () => void; onChanged: () => void }) {
  const toast = useToast()
  const confirm = useConfirm()
  const { format } = useCurrency()
  const [list, setList] = useState<Service[]>(services)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [duration, setDuration] = useState('30')
  const [price, setPrice] = useState('')
  const [variants, setVariants] = useState<{ label: string; price: string }[]>([])
  const [imageUrl, setImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const reload = async () => {
    const s = await fetch('/api/services', { credentials: 'include' }).then(r => (r.ok ? r.json() : []))
    setList(Array.isArray(s) ? s : [])
    onChanged()
  }

  const resetForm = () => { setEditingId(null); setName(''); setDuration('30'); setPrice(''); setVariants([]); setImageUrl('') }

  const startEdit = (s: Service) => {
    setEditingId(s.id)
    setName(s.name)
    setDuration(String(s.durationMin))
    setPrice(s.price ? String(s.price) : '')
    setVariants(s.variants.map(v => ({ label: v.label, price: String(v.price) })))
    setImageUrl(s.imageUrl ?? '')
  }

  const uploadImage = async (file: File) => {
    if (uploading) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/uploads/service-image', { method: 'POST', credentials: 'include', body: fd })
      const b = await res.json().catch(() => null)
      if (!res.ok || !b?.url) throw new Error(b?.error || 'No se pudo subir la imagen')
      setImageUrl(b.url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al subir la imagen')
    } finally {
      setUploading(false)
    }
  }

  // Sugerencias del rubro que aún no están en el catálogo (atajo para llenarlo).
  const suggestions = vertical.suggestedServices.filter(
    sug => !list.some(s => s.name.trim().toLowerCase() === sug.name.toLowerCase())
  )

  const quickAdd = async (sug: { name: string; durationMin: number }) => {
    const res = await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: sug.name, durationMin: sug.durationMin, price: 0 }),
    })
    if (res.ok) { await reload(); toast.success('Servicio agregado') }
    else toast.error('No se pudo agregar')
  }

  const addVariant = (label: string) => {
    if (label && variants.some(v => v.label.toLowerCase() === label.toLowerCase())) return
    setVariants([...variants, { label, price: '' }])
  }
  const updateVariant = (i: number, field: 'label' | 'price', value: string) =>
    setVariants(variants.map((v, idx) => (idx === i ? { ...v, [field]: value } : v)))
  const removeVariant = (i: number) => setVariants(variants.filter((_, idx) => idx !== i))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const cleanVariants = variants
        .map(v => ({ label: v.label.trim(), price: Number(v.price) || 0 }))
        .filter(v => v.label)
      const payload = { name, durationMin: Number(duration) || 30, price: Number(price) || 0, variants: cleanVariants, imageUrl: imageUrl || null }
      const res = editingId
        ? await fetch(`/api/services/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
        : await fetch('/api/services', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
      if (res.ok) {
        resetForm()
        await reload()
        toast.success(editingId ? 'Servicio actualizado' : 'Servicio agregado')
      } else {
        toast.error('No se pudo guardar el servicio')
      }
    } finally {
      setSaving(false)
    }
  }

  const del = async (s: Service) => {
    const ok = await confirm({ title: 'Eliminar servicio', message: `¿Eliminar "${s.name}"?`, confirmText: 'Eliminar', danger: true })
    if (!ok) return
    const res = await fetch(`/api/services/${s.id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) { toast.success('Servicio eliminado'); if (editingId === s.id) resetForm(); await reload() }
    else toast.error('No se pudo eliminar')
  }

  const AGE_CHIPS = ['Niño', 'Adolescente', 'Adulto']

  return (
    <Sheet title="Servicios" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3 mb-5">
        <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="Nombre del servicio" />
        <div className="grid grid-cols-2 gap-2">
          <input value={duration} onChange={e => setDuration(e.target.value)} type="number" min="1" className="input" placeholder="Duración (min)" />
          <input value={price} onChange={e => setPrice(e.target.value)} type="number" step="0.01" min="0" className="input" placeholder="Precio base" />
        </div>

        {/* Imagen de referencia del corte */}
        <div className="flex items-center gap-3">
          {imageUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Referencia" className="h-16 w-16 rounded-lg object-cover border border-gray-200" />
              <button type="button" onClick={() => setImageUrl('')} className="absolute -top-1.5 -right-1.5 bg-white rounded-full border border-gray-200 p-0.5 text-gray-500 hover:text-red-600" aria-label="Quitar imagen">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="h-16 w-16 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-300">
              <ImageIcon className="h-6 w-6" />
            </div>
          )}
          <label className="btn btn-secondary text-sm cursor-pointer flex items-center gap-1.5">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            {imageUrl ? 'Cambiar foto' : 'Foto de referencia'}
            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = '' }} />
          </label>
        </div>

        {/* Precios por tipo (ej. por edad) */}
        <div className="rounded-lg border border-gray-200 p-3 space-y-2">
          <p className="text-xs font-medium text-gray-600">Precios por tipo (opcional)</p>
          {variants.length > 0 && (
            <div className="space-y-2">
              {variants.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={v.label} onChange={e => updateVariant(i, 'label', e.target.value)} className="input py-1.5 flex-1" placeholder="Ej. Niño" />
                  <input value={v.price} onChange={e => updateVariant(i, 'price', e.target.value)} type="number" step="0.01" min="0" className="input py-1.5 w-24" placeholder="Precio" />
                  <button type="button" onClick={() => removeVariant(i)} className="text-danger-500 hover:text-danger-700 p-1" aria-label="Quitar"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {AGE_CHIPS.filter(l => !variants.some(v => v.label.toLowerCase() === l.toLowerCase())).map(l => (
              <button key={l} type="button" onClick={() => addVariant(l)} className="text-xs border border-gray-300 text-gray-600 rounded-full px-2.5 py-1 hover:bg-gray-50">+ {l}</button>
            ))}
            <button type="button" onClick={() => addVariant('')} className="text-xs border border-gray-300 text-gray-600 rounded-full px-2.5 py-1 hover:bg-gray-50">+ Otro</button>
          </div>
          <p className="text-[11px] text-gray-400">Con variantes, al crear la cita eliges el tipo y toma su precio. Sin variantes, se usa el precio base.</p>
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={saving || !name.trim()} className="btn btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? 'Guardar cambios' : 'Agregar servicio'}
          </button>
          {editingId && <button type="button" onClick={resetForm} className="btn btn-secondary">Cancelar</button>}
        </div>
      </form>

      {suggestions.length > 0 && !editingId && (
        <div className="mb-5">
          <p className="text-xs text-gray-500 mb-2">Sugerencias para tu negocio (toca para agregar):</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map(sug => (
              <button
                key={sug.name}
                type="button"
                onClick={() => quickAdd(sug)}
                className="inline-flex items-center gap-1 text-sm border border-primary-200 text-primary-700 bg-primary-50 rounded-full px-3 py-1 hover:bg-primary-100"
              >
                <Plus className="h-3.5 w-3.5" /> {sug.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4 flex flex-col items-center gap-2">
          <Scissors className="h-6 w-6 text-gray-300" />
          Aún no tienes servicios. Agrega los que ofreces para agendar más rápido.
        </p>
      ) : (
        <div className="space-y-2">
          {list.map(s => (
            <div key={s.id} className={`flex items-center gap-3 bg-gray-50 border rounded-lg p-3 ${editingId === s.id ? 'border-primary-400' : 'border-gray-200'}`}>
              {s.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.imageUrl} alt={s.name} className="h-11 w-11 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                <p className="text-xs text-gray-500 truncate">
                  {s.durationMin} min · {s.variants.length > 0 ? s.variants.map(v => `${v.label} ${format(v.price)}`).join(' · ') : format(s.price)}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => startEdit(s)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Editar"><Edit className="h-4 w-4" /></button>
                <button onClick={() => del(s)} className="text-danger-500 hover:text-danger-700 p-1" aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  )
}

function StaffManager({ staff, vertical, onClose, onChanged }: { staff: Staff[]; vertical: VerticalConfig; onClose: () => void; onChanged: () => void }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [list, setList] = useState<Staff[]>(staff)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [pct, setPct] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const singular = vertical.staffSingular.toLowerCase()

  const reload = async () => {
    const s = await fetch('/api/staff', { credentials: 'include' }).then(r => (r.ok ? r.json() : []))
    setList(Array.isArray(s) ? s : [])
    onChanged()
  }

  const resetForm = () => { setEditingId(null); setName(''); setPct(''); setPhone(''); setEmail(''); setImageUrl('') }

  const startEdit = (s: Staff) => {
    setEditingId(s.id)
    setName(s.name)
    setPct(s.commissionPct ? String(s.commissionPct) : '')
    setPhone(s.phone ?? '')
    setEmail(s.email ?? '')
    setImageUrl(s.imageUrl ?? '')
  }

  const uploadImage = async (file: File) => {
    if (uploading) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/uploads/service-image', { method: 'POST', credentials: 'include', body: fd })
      const b = await res.json().catch(() => null)
      if (!res.ok || !b?.url) throw new Error(b?.error || 'No se pudo subir la foto')
      setImageUrl(b.url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al subir la foto')
    } finally {
      setUploading(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const payload = { name, commissionPct: Number(pct) || 0, phone, email, imageUrl: imageUrl || null }
      const res = editingId
        ? await fetch(`/api/staff/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
        : await fetch('/api/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
      if (res.ok) {
        resetForm()
        await reload()
        toast.success(editingId ? `${vertical.staffSingular} actualizado` : `${vertical.staffSingular} agregado`)
      } else {
        toast.error('No se pudo guardar')
      }
    } finally {
      setSaving(false)
    }
  }

  const del = async (s: Staff) => {
    const ok = await confirm({ title: `Eliminar ${singular}`, message: `¿Eliminar "${s.name}"? Las citas ya registradas conservan su nombre.`, confirmText: 'Eliminar', danger: true })
    if (!ok) return
    const res = await fetch(`/api/staff/${s.id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) { toast.success(`${vertical.staffSingular} eliminado`); if (editingId === s.id) resetForm(); await reload() }
    else toast.error('No se pudo eliminar')
  }

  return (
    <Sheet title={vertical.staffPlural} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3 mb-5">
        {/* Foto del barbero (avatar en la página pública de reservas) */}
        <div className="flex items-center gap-3">
          {imageUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Foto" className="h-16 w-16 rounded-full object-cover border border-gray-200" />
              <button type="button" onClick={() => setImageUrl('')} className="absolute -top-1.5 -right-1.5 bg-white rounded-full border border-gray-200 p-0.5 text-gray-500 hover:text-red-600" aria-label="Quitar foto">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="h-16 w-16 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-gray-300">
              <ImageIcon className="h-6 w-6" />
            </div>
          )}
          <label className="btn btn-secondary text-sm cursor-pointer flex items-center gap-1.5">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            {imageUrl ? 'Cambiar foto' : `Foto del ${singular}`}
            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = '' }} />
          </label>
        </div>
        <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder={`Nombre del ${singular}`} />
        <input value={pct} onChange={e => setPct(e.target.value)} type="number" step="1" min="0" max="100" className="input" placeholder="Comisión % (ej. 40)" />
        <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" inputMode="tel" className="input" placeholder="WhatsApp (para avisarle de sus citas)" />
        <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="input" placeholder="Correo (opcional)" />
        <div className="flex gap-2">
          <button type="submit" disabled={saving || !name.trim()} className="btn btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? 'Guardar cambios' : `Agregar ${singular}`}
          </button>
          {editingId && <button type="button" onClick={resetForm} className="btn btn-secondary">Cancelar</button>}
        </div>
      </form>

      {list.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4 flex flex-col items-center gap-2">
          <Users className="h-6 w-6 text-gray-300" />
          Agrega a tus {vertical.staffPlural.toLowerCase()} con su % de comisión y su WhatsApp. Al asignarlos a una cita calculamos su pago y les avisamos.
        </p>
      ) : (
        <div className="space-y-2">
          {list.map(s => (
            <div key={s.id} className={`flex items-center justify-between bg-gray-50 border rounded-lg p-3 ${editingId === s.id ? 'border-primary-400' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3 min-w-0">
                {s.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.imageUrl} alt={s.name} className="h-10 w-10 rounded-full object-cover border border-gray-200 flex-shrink-0" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    {s.name.trim().charAt(0).toUpperCase() || '?'}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {s.commissionPct}% de comisión{s.phone ? ` · ${s.phone}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => startEdit(s)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Editar"><Edit className="h-4 w-4" /></button>
                <button onClick={() => del(s)} className="text-danger-500 hover:text-danger-700 p-1" aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  )
}

function DoneDialog({ appointment, onClose, onConfirm }: { appointment: Appointment; onClose: () => void; onConfirm: (tip?: number) => void }) {
  const { format } = useCurrency()
  const [tip, setTip] = useState(appointment.tip ? String(appointment.tip) : '')
  const [reward, setReward] = useState<{ rewardPct: number } | null>(null)

  useEffect(() => {
    if (!appointment.clientId) return
    fetch(`/api/clients/${appointment.clientId}/loyalty`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.enabled && d.rewardAvailable) setReward({ rewardPct: d.rewardPct }) })
      .catch(() => {})
  }, [appointment.clientId])

  return (
    <Sheet title="Marcar como atendida" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          {appointment.clientName}
          {appointment.staffName ? ` · ✂ ${appointment.staffName}` : ''}
          {appointment.price > 0 ? ` · ${format(appointment.price)}` : ''}
        </p>

        {reward && (
          <div className="bg-success-50 border border-success-200 rounded-lg p-3 text-sm text-success-700">
            🎁 Este cliente tiene recompensa: <strong>{reward.rewardPct >= 100 ? 'servicio gratis' : `${reward.rewardPct}% de descuento`}</strong>. Aplica el precio con el descuento y canjéala en su ficha.
          </div>
        )}
        <div>
          <label className="label">Propina (opcional)</label>
          <input value={tip} onChange={e => setTip(e.target.value)} type="number" step="0.01" min="0" className="input" placeholder="0.00" autoFocus />
        </div>
        <button onClick={() => onConfirm(tip === '' ? undefined : Number(tip) || 0)} className="btn btn-success w-full flex items-center justify-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> Confirmar atendida
        </button>
      </div>
    </Sheet>
  )
}

interface CommissionRow {
  staffId: string | null
  staffName: string
  count: number
  serviceIncome: number
  commission: number
  tips: number
  total: number
}

function CommissionsSheet({ vertical, onClose }: { vertical: VerticalConfig; onClose: () => void }) {
  const { format } = useCurrency()
  const now = new Date()
  const [from, setFrom] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`)
  const [to, setTo] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`)
  const [rows, setRows] = useState<CommissionRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    // Límites ISO del día LOCAL (evita desfase de zona horaria en el corte).
    const fromIso = new Date(`${from}T00:00:00`).toISOString()
    const toIso = new Date(`${to}T23:59:59`).toISOString()
    fetch(`/api/appointments/commissions?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setRows(d.rows || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [from, to])

  const totalPay = rows.reduce((s, r) => s + r.total, 0)

  return (
    <Sheet title={`Comisiones por ${vertical.staffSingular.toLowerCase()}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div><label className="label">Desde</label><input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><label className="label">Hasta</label><input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} /></div>
      </div>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary-600" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">No hay citas atendidas en este rango.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.staffId || 'none'} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">{r.staffName}</p>
                <p className="text-sm font-bold text-gray-900">{format(r.total)}</p>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {r.count} servicios · ingreso {format(r.serviceIncome)} · comisión {format(r.commission)} · propinas {format(r.tips)}
              </p>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
            <span className="text-sm font-semibold text-gray-700">Total a pagar</span>
            <span className="text-base font-bold text-gray-900">{format(totalPay)}</span>
          </div>
        </div>
      )}
    </Sheet>
  )
}

function WalkInForm({ services, staff, clients, vertical, onClose, onSaved }: { services: Service[]; staff: Staff[]; clients: ClientOption[]; vertical: VerticalConfig; onClose: () => void; onSaved: () => void }) {
  const [clientId, setClientId] = useState('')
  const [clientName, setClientName] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const payload = {
        clientId: clientId || null,
        clientName: clientId ? undefined : (clientName.trim() || 'Cliente sin cita'),
        serviceId: serviceId || null,
        staffId: staffId || null,
        startsAt: new Date().toISOString(),
      }
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => null)
        throw new Error(b?.error || 'No se pudo agregar')
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al agregar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title="Sin cita (walk-in)" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-600">Se agrega a la fila de hoy con la hora actual.</p>
        <div>
          <label className="label">Cliente</label>
          {clients.length > 0 && (
            <select className="input mb-2" value={clientId} onChange={e => { setClientId(e.target.value); if (e.target.value) setClientName('') }}>
              <option value="">— Escribir a mano —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {!clientId && (
            <input value={clientName} onChange={e => setClientName(e.target.value)} className="input" placeholder="Nombre (o déjalo vacío)" />
          )}
        </div>

        {services.length > 0 && (
          <div>
            <label className="label">Servicio</label>
            <select className="input" value={serviceId} onChange={e => setServiceId(e.target.value)}>
              <option value="">— Sin servicio —</option>
              {services.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {staff.length > 0 && (
          <div>
            <label className="label">{vertical.staffSingular}</label>
            <select className="input" value={staffId} onChange={e => setStaffId(e.target.value)}>
              <option value="">— Sin asignar —</option>
              {staff.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving} className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Agregar a la fila
        </button>
      </form>
    </Sheet>
  )
}
