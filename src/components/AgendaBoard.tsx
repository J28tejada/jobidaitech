'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus,
  MoreVertical,
  CalendarClock,
  CalendarDays,
  Clock,
  Scissors,
  Settings2,
  Users,
  Coins,
  Check,
  CheckCircle2,
  XCircle,
  Ban,
  MessageCircle,
  Edit,
  Trash2,
  Loader2,
  X,
} from 'lucide-react'

import { useToast } from './Toaster'
import { useConfirm } from './ConfirmDialog'
import { useCurrency } from './CurrencyProvider'

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
  active: boolean
}
interface Staff {
  id: string
  name: string
  commissionPct: number
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
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
const dateKey = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
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

  const [mounted, setMounted] = useState(false)
  const [menu, setMenu] = useState<{ item: Appointment; top: number; left: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [showServices, setShowServices] = useState(false)
  const [showStaff, setShowStaff] = useState(false)
  const [showCommissions, setShowCommissions] = useState(false)
  const [doneTarget, setDoneTarget] = useState<Appointment | null>(null)

  useEffect(() => {
    setMounted(true)
    loadStatic()
    // Botón "+" flotante: abrir el formulario de nueva cita.
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new') === 'true') {
      setEditing(null)
      setShowForm(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    loadAppointments()
  }, [dayFilter])

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null)
    }
    const onScroll = () => setMenu(null)
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [menu])

  const loadStatic = async () => {
    const [s, c, st] = await Promise.all([
      fetch('/api/services', { credentials: 'include' }).then(r => (r.ok ? r.json() : [])),
      fetch('/api/clients', { credentials: 'include' }).then(r => (r.ok ? r.json() : [])),
      fetch('/api/staff', { credentials: 'include' }).then(r => (r.ok ? r.json() : [])),
    ])
    setServices(Array.isArray(s) ? s : [])
    setStaff(Array.isArray(st) ? st : [])
    setClients(Array.isArray(c) ? c.map((x: any) => ({ id: x.id, name: x.name, phone: x.phone })) : [])
    fetch('/api/appointments/summary', { credentials: 'include' })
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
    fetch('/api/appointments/summary', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => d && setSummary(d))
      .catch(() => {})
  }

  const openMenu = (e: React.MouseEvent, item: Appointment) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenu({ item, top: rect.bottom + 6, left: Math.max(rect.right - 220, 8) })
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
          <button onClick={() => setShowCommissions(true)} className="btn btn-secondary flex items-center justify-center" title="Comisiones por barbero">
            <Coins className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Comisiones</span>
          </button>
          <button onClick={() => setShowStaff(true)} className="btn btn-secondary flex items-center justify-center" title="Barberos">
            <Users className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Barberos</span>
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card border-l-4 border-l-primary-600">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Citas hoy</p>
          <p className="text-2xl font-bold text-gray-900">{summary?.todayCount ?? 0}</p>
        </div>
        <div className="card border-l-4 border-l-success-600">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ingreso estimado hoy</p>
          <p className="text-2xl font-bold text-gray-900">{format(summary?.todayIncome ?? 0)}</p>
        </div>
        <div className="card">
          <label className="label">Ver un día</label>
          <input type="date" className="input" value={dayFilter} onChange={e => setDayFilter(e.target.value)} />
          {dayFilter && (
            <button onClick={() => setDayFilter('')} className="text-xs text-primary-600 mt-1">Ver próximas</button>
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
                {g.list.map(item => (
                  <div key={item.id} className={`card flex items-center gap-3 ${item.status === 'cancelled' || item.status === 'no_show' ? 'opacity-60' : ''}`}>
                    <div className="flex flex-col items-center justify-center bg-primary-50 rounded-lg px-2.5 py-1.5 flex-shrink-0">
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
                    <button onClick={e => openMenu(e, item)} className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0">
                      <MoreVertical className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Menú */}
      {mounted && menu && createPortal(
        <div ref={menuRef} style={{ position: 'fixed', top: menu.top, left: menu.left, width: 220 }} className="bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-[80]">
          <a href={reminderLink(menu.item)} target="_blank" rel="noopener noreferrer" onClick={() => setMenu(null)} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">
            <MessageCircle className="h-4 w-4 text-green-500" /> Recordar por WhatsApp
          </a>
          {menu.item.status === 'scheduled' && <Btn icon={Check} color="text-primary-600" label="Confirmar" onClick={() => { const it = menu.item; setMenu(null); setStatus(it, 'confirmed', 'Cita confirmada') }} />}
          {menu.item.status !== 'done' && <Btn icon={CheckCircle2} color="text-success-600" label="Marcar atendida" onClick={() => { const it = menu.item; setMenu(null); setDoneTarget(it) }} />}
          {menu.item.status !== 'cancelled' && <Btn icon={XCircle} label="Cancelar" onClick={() => { const it = menu.item; setMenu(null); setStatus(it, 'cancelled', 'Cita cancelada') }} />}
          {menu.item.status !== 'no_show' && <Btn icon={Ban} label="No asistió" onClick={() => { const it = menu.item; setMenu(null); setStatus(it, 'no_show', 'Marcada: no asistió') }} />}
          <div className="border-t border-gray-100 my-1" />
          <Btn icon={Edit} label="Editar" onClick={() => { const it = menu.item; setMenu(null); setEditing(it); setShowForm(true) }} />
          <Btn icon={Trash2} color="text-red-600" danger label="Eliminar" onClick={() => { const it = menu.item; setMenu(null); remove(it) }} />
        </div>,
        document.body
      )}

      {showForm && (
        <AppointmentForm
          appointment={editing}
          services={services}
          staff={staff}
          clients={clients}
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
          onClose={() => setShowServices(false)}
          onChanged={async () => { await loadStatic() }}
        />
      )}

      {showStaff && (
        <StaffManager
          staff={staff}
          onClose={() => setShowStaff(false)}
          onChanged={async () => { await loadStatic() }}
        />
      )}

      {showCommissions && <CommissionsSheet onClose={() => setShowCommissions(false)} />}

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
    </div>
  )
}

function Btn({ icon: Icon, label, onClick, color, danger }: { icon: any; label: string; onClick: () => void; color?: string; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left ${danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}`}>
      <Icon className={`h-4 w-4 ${color ?? 'text-gray-400'}`} /> {label}
    </button>
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

function AppointmentForm({ appointment, services, staff, clients, onClose, onSaved }: { appointment: Appointment | null; services: Service[]; staff: Staff[]; clients: ClientOption[]; onClose: () => void; onSaved: () => void }) {
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
  const [when, setWhen] = useState(appointment ? toLocalInput(appointment.startsAt) : defaultWhen())
  const [durationMin, setDurationMin] = useState(String(appointment?.durationMin ?? 30))
  const [price, setPrice] = useState(String(appointment?.price ?? ''))
  const [tip, setTip] = useState(appointment?.tip ? String(appointment.tip) : '')
  const [notes, setNotes] = useState(appointment?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pickService = (id: string) => {
    setServiceId(id)
    const s = services.find(x => x.id === id)
    if (s) {
      setTitle(s.name)
      setDurationMin(String(s.durationMin))
      setPrice(String(s.price))
    }
  }

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
            <select className="input mb-2" value={clientId} onChange={e => { setClientId(e.target.value); if (e.target.value) setClientName('') }}>
              <option value="">— Escribir a mano —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {!clientId && (
            <div className="grid grid-cols-2 gap-2">
              <input value={clientName} onChange={e => setClientName(e.target.value)} className="input" placeholder="Nombre" />
              <input value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="input" placeholder="WhatsApp" inputMode="tel" />
            </div>
          )}
        </div>

        {services.length > 0 && (
          <div>
            <label className="label">Servicio</label>
            <select className="input" value={serviceId} onChange={e => pickService(e.target.value)}>
              <option value="">— Sin servicio —</option>
              {services.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name} ({s.durationMin} min)</option>)}
            </select>
          </div>
        )}

        {staff.length > 0 && (
          <div>
            <label className="label">Barbero</label>
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

function ServicesManager({ services, onClose, onChanged }: { services: Service[]; onClose: () => void; onChanged: () => void }) {
  const toast = useToast()
  const confirm = useConfirm()
  const { format } = useCurrency()
  const [list, setList] = useState<Service[]>(services)
  const [name, setName] = useState('')
  const [duration, setDuration] = useState('30')
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)

  const reload = async () => {
    const s = await fetch('/api/services', { credentials: 'include' }).then(r => (r.ok ? r.json() : []))
    setList(Array.isArray(s) ? s : [])
    onChanged()
  }

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, durationMin: Number(duration) || 30, price: Number(price) || 0 }),
      })
      if (res.ok) {
        setName(''); setDuration('30'); setPrice('')
        await reload()
        toast.success('Servicio agregado')
      } else {
        toast.error('No se pudo agregar el servicio')
      }
    } finally {
      setSaving(false)
    }
  }

  const del = async (s: Service) => {
    const ok = await confirm({ title: 'Eliminar servicio', message: `¿Eliminar "${s.name}"?`, confirmText: 'Eliminar', danger: true })
    if (!ok) return
    const res = await fetch(`/api/services/${s.id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) { toast.success('Servicio eliminado'); await reload() }
    else toast.error('No se pudo eliminar')
  }

  return (
    <Sheet title="Servicios" onClose={onClose}>
      <form onSubmit={add} className="space-y-3 mb-5">
        <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="Nombre del servicio" />
        <div className="grid grid-cols-2 gap-2">
          <input value={duration} onChange={e => setDuration(e.target.value)} type="number" min="1" className="input" placeholder="Duración (min)" />
          <input value={price} onChange={e => setPrice(e.target.value)} type="number" step="0.01" min="0" className="input" placeholder="Precio" />
        </div>
        <button type="submit" disabled={saving || !name.trim()} className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Agregar servicio
        </button>
      </form>

      {list.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4 flex flex-col items-center gap-2">
          <Scissors className="h-6 w-6 text-gray-300" />
          Aún no tienes servicios. Agrega los que ofreces para agendar más rápido.
        </p>
      ) : (
        <div className="space-y-2">
          {list.map(s => (
            <div key={s.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                <p className="text-xs text-gray-500">{s.durationMin} min · {format(s.price)}</p>
              </div>
              <button onClick={() => del(s)} className="text-danger-500 hover:text-danger-700 p-1 flex-shrink-0" aria-label="Eliminar">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  )
}

function StaffManager({ staff, onClose, onChanged }: { staff: Staff[]; onClose: () => void; onChanged: () => void }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [list, setList] = useState<Staff[]>(staff)
  const [name, setName] = useState('')
  const [pct, setPct] = useState('')
  const [saving, setSaving] = useState(false)

  const reload = async () => {
    const s = await fetch('/api/staff', { credentials: 'include' }).then(r => (r.ok ? r.json() : []))
    setList(Array.isArray(s) ? s : [])
    onChanged()
  }

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, commissionPct: Number(pct) || 0 }),
      })
      if (res.ok) {
        setName(''); setPct('')
        await reload()
        toast.success('Barbero agregado')
      } else {
        toast.error('No se pudo agregar')
      }
    } finally {
      setSaving(false)
    }
  }

  const del = async (s: Staff) => {
    const ok = await confirm({ title: 'Eliminar barbero', message: `¿Eliminar "${s.name}"? Las citas ya registradas conservan su nombre.`, confirmText: 'Eliminar', danger: true })
    if (!ok) return
    const res = await fetch(`/api/staff/${s.id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) { toast.success('Barbero eliminado'); await reload() }
    else toast.error('No se pudo eliminar')
  }

  return (
    <Sheet title="Barberos" onClose={onClose}>
      <form onSubmit={add} className="space-y-3 mb-5">
        <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="Nombre del barbero" />
        <input value={pct} onChange={e => setPct(e.target.value)} type="number" step="1" min="0" max="100" className="input" placeholder="Comisión % (ej. 40)" />
        <button type="submit" disabled={saving || !name.trim()} className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Agregar barbero
        </button>
      </form>

      {list.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4 flex flex-col items-center gap-2">
          <Users className="h-6 w-6 text-gray-300" />
          Agrega a tus barberos con su % de comisión. Al asignarlos a una cita calculamos su pago.
        </p>
      ) : (
        <div className="space-y-2">
          {list.map(s => (
            <div key={s.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                <p className="text-xs text-gray-500">{s.commissionPct}% de comisión</p>
              </div>
              <button onClick={() => del(s)} className="text-danger-500 hover:text-danger-700 p-1 flex-shrink-0" aria-label="Eliminar">
                <Trash2 className="h-4 w-4" />
              </button>
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
  return (
    <Sheet title="Marcar como atendida" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          {appointment.clientName}
          {appointment.staffName ? ` · ✂ ${appointment.staffName}` : ''}
          {appointment.price > 0 ? ` · ${format(appointment.price)}` : ''}
        </p>
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

function CommissionsSheet({ onClose }: { onClose: () => void }) {
  const { format } = useCurrency()
  const now = new Date()
  const [from, setFrom] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`)
  const [to, setTo] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`)
  const [rows, setRows] = useState<CommissionRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/appointments/commissions?from=${from}&to=${to}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setRows(d.rows || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [from, to])

  const totalPay = rows.reduce((s, r) => s + r.total, 0)

  return (
    <Sheet title="Comisiones por barbero" onClose={onClose}>
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
