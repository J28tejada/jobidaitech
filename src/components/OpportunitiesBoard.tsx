'use client'

import { useState, useEffect } from 'react'
import ActionSheet from './ActionSheet'
import { createPortal } from 'react-dom'
import {
  Plus,
  MoreVertical,
  Target,
  Bell,
  MessageCircle,
  ClipboardList,
  Edit,
  Trash2,
  Trophy,
  ThumbsDown,
  MoveRight,
  Loader2,
  X,
} from 'lucide-react'

import { useToast } from './Toaster'
import { useConfirm } from './ConfirmDialog'
import { useCurrency } from './CurrencyProvider'

type Stage = 'new' | 'contacted' | 'quoted' | 'won' | 'lost'
const OPEN_STAGES: Stage[] = ['new', 'contacted', 'quoted']
const STAGE_META: Record<Stage, { label: string; badge: string }> = {
  new: { label: 'Nuevo', badge: 'bg-gray-100 text-gray-700' },
  contacted: { label: 'Contactado', badge: 'bg-blue-100 text-blue-700' },
  quoted: { label: 'Cotizado', badge: 'bg-purple-100 text-purple-700' },
  won: { label: 'Ganado', badge: 'bg-success-100 text-success-700' },
  lost: { label: 'Perdido', badge: 'bg-danger-100 text-danger-700' },
}
const SOURCES = ['WhatsApp', 'Instagram / Facebook', 'Referido', 'Anuncio', 'Llamada', 'Otro']

interface Activity {
  id: string
  type: string
  body: string
  createdAt: string | null
}
interface Opportunity {
  id: string
  clientId: string | null
  clientName: string
  clientPhone: string | null
  title: string
  stage: Stage
  value: number
  source: string | null
  expectedClose: string | null
  nextAction: string | null
  nextActionDate: string | null
  lostReason: string | null
  projectId: string | null
  notes: string
  activities?: Activity[]
}
interface ClientOption {
  id: string
  name: string
  phone: string | null
}

const todayStr = () => new Date().toISOString().slice(0, 10)
const isOverdue = (o: Opportunity) => !!o.nextActionDate && o.nextActionDate <= todayStr() && OPEN_STAGES.includes(o.stage)
const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : null)
const waLink = (phone: string | null, msg: string) => {
  const d = (phone || '').replace(/\D/g, '')
  return d ? `https://wa.me/${d}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`
}

export default function OpportunitiesBoard() {
  const toast = useToast()
  const confirm = useConfirm()
  const { format } = useCurrency()

  const [items, setItems] = useState<Opportunity[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [summary, setSummary] = useState<{ openValue: number; openCount: number; followUpsDue: number; byStage: Record<string, { count: number; value: number }> } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showClosed, setShowClosed] = useState(false)

  const [menuItem, setMenuItem] = useState<Opportunity | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Opportunity | null>(null)
  const [activityTarget, setActivityTarget] = useState<Opportunity | null>(null)
  const [wonTarget, setWonTarget] = useState<Opportunity | null>(null)
  const [lostTarget, setLostTarget] = useState<Opportunity | null>(null)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const [o, c, s] = await Promise.all([
        fetch('/api/opportunities', { credentials: 'include' }).then(r => (r.ok ? r.json() : [])),
        fetch('/api/clients', { credentials: 'include' }).then(r => (r.ok ? r.json() : [])),
        fetch('/api/opportunities/summary', { credentials: 'include' }).then(r => (r.ok ? r.json() : null)),
      ])
      setItems(Array.isArray(o) ? o : [])
      setClients(Array.isArray(c) ? c.map((x: any) => ({ id: x.id, name: x.name, phone: x.phone })) : [])
      setSummary(s)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const changeStage = async (item: Opportunity, stage: Stage) => {
    const res = await fetch(`/api/opportunities/${item.id}/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ stage }),
    })
    if (res.ok) toast.success(`Movida a "${STAGE_META[stage].label}"`)
    else toast.error('No se pudo cambiar la etapa')
    await load()
  }

  const remove = async (item: Opportunity) => {
    const ok = await confirm({
      title: 'Eliminar oportunidad',
      message: `¿Eliminar la oportunidad de ${item.clientName}?`,
      confirmText: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    const res = await fetch(`/api/opportunities/${item.id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) toast.success('Oportunidad eliminada')
    else toast.error('No se pudo eliminar')
    await load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const followUps = items.filter(isOverdue)

  const card = (item: Opportunity) => {
    const overdue = isOverdue(item)
    return (
      <div key={item.id} className="card">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-900 truncate">{item.clientName}</h3>
              {item.projectId && <span className="badge badge-info">Proyecto</span>}
            </div>
            {item.title && <p className="text-xs text-gray-500 truncate mt-0.5">{item.title}</p>}
          </div>
          <button onClick={() => setMenuItem(item)} className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-base font-bold text-gray-900">{format(item.value)}</span>
          {item.source && <span className="text-xs text-gray-400">{item.source}</span>}
        </div>
        {item.nextAction && (
          <div className={`mt-2 text-xs flex items-center gap-1.5 ${overdue ? 'text-danger-600 font-medium' : 'text-gray-500'}`}>
            <Bell className="h-3.5 w-3.5" />
            <span className="truncate">{item.nextAction}</span>
            {item.nextActionDate && <span>· {fmtDate(item.nextActionDate)}</span>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Oportunidades</h1>
          <p className="text-gray-600 mt-1 sm:mt-2">Tu embudo de ventas: prospecta, da seguimiento y cierra.</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true) }} className="btn btn-primary flex items-center justify-center w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-1.5" />
          Nueva oportunidad
        </button>
      </div>

      {/* Resumen del embudo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">En el embudo</p>
          <p className="text-xl font-bold text-gray-900">{format(summary?.openValue ?? 0)}</p>
          <p className="text-xs text-gray-500">{summary?.openCount ?? 0} abiertas</p>
        </div>
        {OPEN_STAGES.map(st => (
          <div key={st} className="card">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{STAGE_META[st].label}</p>
            <p className="text-lg font-bold text-gray-900">{format(summary?.byStage?.[st]?.value ?? 0)}</p>
            <p className="text-xs text-gray-500">{summary?.byStage?.[st]?.count ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Bandeja de seguimientos */}
      {followUps.length > 0 && (
        <div className="card border-l-4 border-l-danger-600 bg-danger-50">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-5 w-5 text-danger-600" />
            <h2 className="font-semibold text-gray-900">Seguimientos de hoy y vencidos ({followUps.length})</h2>
          </div>
          <div className="space-y-2">
            {followUps.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-3 bg-white rounded-lg p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.clientName}</p>
                  <p className="text-xs text-gray-500 truncate">{item.nextAction} · {fmtDate(item.nextActionDate)}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <a
                    href={waLink(item.clientPhone, `Hola ${item.clientName}, ¿cómo vamos con lo que conversamos?`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-success text-xs inline-flex items-center"
                  >
                    <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
                  </a>
                  <button onClick={() => setActivityTarget(item)} className="btn btn-secondary text-xs">
                    Seguimiento
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Secciones por etapa */}
      {items.length === 0 ? (
        <div className="text-center py-12">
          <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay oportunidades</h3>
          <p className="text-gray-500 mb-4">Registra tus prospectos y dales seguimiento hasta cerrar la venta.</p>
          <button onClick={() => { setEditing(null); setShowForm(true) }} className="btn btn-primary text-sm">Nueva oportunidad</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {OPEN_STAGES.map(st => {
              const list = items.filter(i => i.stage === st)
              return (
                <div key={st} className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-sm font-semibold text-gray-700">
                      {STAGE_META[st].label} <span className="text-gray-400">({list.length})</span>
                    </h2>
                  </div>
                  {list.length === 0 ? (
                    <p className="text-xs text-gray-400 px-1">Sin oportunidades</p>
                  ) : (
                    list.map(card)
                  )}
                </div>
              )
            })}
          </div>

          {/* Cerradas */}
          <div>
            <button onClick={() => setShowClosed(v => !v)} className="text-sm text-primary-600 hover:text-primary-700">
              {showClosed ? 'Ocultar' : 'Ver'} ganadas y perdidas
            </button>
            {showClosed && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
                {(['won', 'lost'] as Stage[]).map(st => {
                  const list = items.filter(i => i.stage === st)
                  return (
                    <div key={st} className="space-y-3">
                      <h2 className="text-sm font-semibold text-gray-700 px-1">
                        {STAGE_META[st].label} <span className="text-gray-400">({list.length})</span>
                      </h2>
                      {list.length === 0 ? <p className="text-xs text-gray-400 px-1">Ninguna</p> : list.map(card)}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Menú */}
      {menuItem && (
        <ActionSheet
          title={menuItem.clientName}
          subtitle={menuItem.title || undefined}
          onClose={() => setMenuItem(null)}
          actions={[
            { icon: ClipboardList, label: 'Registrar seguimiento', onClick: () => { const it = menuItem; setMenuItem(null); setActivityTarget(it) } },
            ...(menuItem.clientPhone ? [{ icon: MessageCircle, color: 'text-green-500', label: 'WhatsApp', href: waLink(menuItem.clientPhone, `Hola ${menuItem.clientName}`) }] : []),
            ...OPEN_STAGES.filter(s => s !== menuItem.stage).map((s, idx) => ({ icon: MoveRight, label: `Mover a ${STAGE_META[s].label}`, divider: idx === 0, onClick: () => { const it = menuItem; setMenuItem(null); changeStage(it, s) } })),
            ...(menuItem.stage !== 'won' ? [{ icon: Trophy, color: 'text-success-600', label: 'Marcar ganada', onClick: () => { const it = menuItem; setMenuItem(null); setWonTarget(it) } }] : []),
            ...(menuItem.stage !== 'lost' ? [{ icon: ThumbsDown, label: 'Marcar perdida', onClick: () => { const it = menuItem; setMenuItem(null); setLostTarget(it) } }] : []),
            { icon: Edit, label: 'Editar', divider: true, onClick: () => { const it = menuItem; setMenuItem(null); setEditing(it); setShowForm(true) } },
            { icon: Trash2, label: 'Eliminar', danger: true, onClick: () => { const it = menuItem; setMenuItem(null); remove(it) } },
          ]}
        />
      )}

      {showForm && (
        <OpportunityForm
          opportunity={editing}
          clients={clients}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={async () => {
            const wasEditing = !!editing
            setShowForm(false)
            setEditing(null)
            await load()
            toast.success(wasEditing ? 'Oportunidad actualizada' : 'Oportunidad creada')
          }}
        />
      )}

      {activityTarget && (
        <ActivityForm
          opportunity={activityTarget}
          onClose={() => setActivityTarget(null)}
          onSaved={async () => { setActivityTarget(null); await load(); toast.success('Seguimiento registrado') }}
        />
      )}

      {wonTarget && (
        <WonDialog
          opportunity={wonTarget}
          onClose={() => setWonTarget(null)}
          onDone={async (msg) => { setWonTarget(null); await load(); toast.success(msg) }}
        />
      )}

      {lostTarget && (
        <LostDialog
          opportunity={lostTarget}
          onClose={() => setLostTarget(null)}
          onDone={async () => { setLostTarget(null); await load(); toast.success('Marcada como perdida') }}
        />
      )}
    </div>
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

function OpportunityForm({ opportunity, clients, onClose, onSaved }: { opportunity: Opportunity | null; clients: ClientOption[]; onClose: () => void; onSaved: () => void }) {
  const [clientId, setClientId] = useState(opportunity?.clientId ?? '')
  const [clientName, setClientName] = useState(opportunity?.clientId ? '' : opportunity?.clientName ?? '')
  const [clientPhone, setClientPhone] = useState(opportunity?.clientPhone ?? '')
  const [title, setTitle] = useState(opportunity?.title ?? '')
  const [value, setValue] = useState(opportunity ? String(opportunity.value) : '')
  const [source, setSource] = useState(opportunity?.source ?? '')
  const [nextAction, setNextAction] = useState(opportunity?.nextAction ?? '')
  const [nextActionDate, setNextActionDate] = useState(opportunity?.nextActionDate ?? '')
  const [notes, setNotes] = useState(opportunity?.notes ?? '')
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
        clientName: clientId ? undefined : clientName,
        clientPhone,
        title,
        value: Number(value) || 0,
        source: source || null,
        nextAction,
        nextActionDate: nextActionDate || null,
        notes,
      }
      const res = opportunity
        ? await fetch(`/api/opportunities/${opportunity.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
        : await fetch('/api/opportunities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
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
    <Sheet title={opportunity ? 'Editar oportunidad' : 'Nueva oportunidad'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Cliente / prospecto *</label>
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
        <div>
          <label className="label">¿Qué quiere? (título)</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="input" placeholder="Ej. Cocina empotrada" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Monto estimado</label>
            <input value={value} onChange={e => setValue(e.target.value)} type="number" step="0.01" min="0" className="input" placeholder="0.00" />
          </div>
          <div>
            <label className="label">Origen</label>
            <select className="input" value={source} onChange={e => setSource(e.target.value)}>
              <option value="">—</option>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Próxima acción</label>
            <input value={nextAction} onChange={e => setNextAction(e.target.value)} className="input" placeholder="Ej. Llamar" />
          </div>
          <div>
            <label className="label">¿Cuándo?</label>
            <input value={nextActionDate ?? ''} onChange={e => setNextActionDate(e.target.value)} type="date" className="input" />
          </div>
        </div>
        <div>
          <label className="label">Notas</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="input" placeholder="Opcional" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving} className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {opportunity ? 'Guardar cambios' : 'Crear oportunidad'}
        </button>
      </form>
    </Sheet>
  )
}

const ACTIVITY_TYPES = [
  { value: 'note', label: 'Nota' },
  { value: 'call', label: 'Llamada' },
  { value: 'message', label: 'Mensaje' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'meeting', label: 'Reunión' },
]

function ActivityForm({ opportunity, onClose, onSaved }: { opportunity: Opportunity; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState('note')
  const [body, setBody] = useState('')
  const [nextAction, setNextAction] = useState(opportunity.nextAction ?? '')
  const [nextActionDate, setNextActionDate] = useState(opportunity.nextActionDate ?? '')
  const [history, setHistory] = useState<Activity[] | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/opportunities/${opportunity.id}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => setHistory(d?.activities ?? []))
      .catch(() => setHistory([]))
  }, [opportunity.id])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/opportunities/${opportunity.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type, body, nextAction, nextActionDate: nextActionDate || null }),
      })
      if (res.ok) onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title={`Seguimiento — ${opportunity.clientName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Tipo</label>
            <select className="input" value={type} onChange={e => setType(e.target.value)}>
              {ACTIVITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">¿Qué pasó?</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={2} className="input" placeholder="Ej. Llamé, quedó en pensarlo" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Próxima acción</label>
            <input value={nextAction} onChange={e => setNextAction(e.target.value)} className="input" placeholder="Ej. Volver a llamar" />
          </div>
          <div>
            <label className="label">¿Cuándo?</label>
            <input value={nextActionDate ?? ''} onChange={e => setNextActionDate(e.target.value)} type="date" className="input" />
          </div>
        </div>
        <button type="submit" disabled={saving} className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Registrar seguimiento
        </button>
      </form>

      {history && history.length > 0 && (
        <div className="mt-5 border-t border-gray-100 pt-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Historial</h3>
          <div className="space-y-2">
            {history.map(a => (
              <div key={a.id} className="text-sm border-b border-gray-100 pb-2">
                <p className="text-gray-900">{a.body || ACTIVITY_TYPES.find(t => t.value === a.type)?.label}</p>
                {a.createdAt && <p className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleString('es-ES')}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  )
}

function WonDialog({ opportunity, onClose, onDone }: { opportunity: Opportunity; onClose: () => void; onDone: (msg: string) => void }) {
  const { format } = useCurrency()
  const [createProject, setCreateProject] = useState(true)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/opportunities/${opportunity.id}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stage: 'won', createProject }),
      })
      const b = await res.json().catch(() => null)
      if (res.ok) onDone(b?.projectId && createProject ? '¡Ganada! Proyecto creado' : '¡Oportunidad ganada!')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title="Marcar como ganada" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          ¡Felicidades! Cerraste la venta con <strong>{opportunity.clientName}</strong> por <strong>{format(opportunity.value)}</strong>.
        </p>
        {!opportunity.projectId && (
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={createProject} onChange={e => setCreateProject(e.target.checked)} className="mt-0.5" />
            <span>Crear un proyecto para darle seguimiento al trabajo (con el monto como presupuesto).</span>
          </label>
        )}
        <button onClick={submit} disabled={saving} className="btn btn-success w-full flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
          Confirmar venta ganada
        </button>
      </div>
    </Sheet>
  )
}

function LostDialog({ opportunity, onClose, onDone }: { opportunity: Opportunity; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/opportunities/${opportunity.id}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stage: 'lost', lostReason: reason }),
      })
      if (res.ok) onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title="Marcar como perdida" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">¿Por qué se perdió? (opcional)</label>
          <input value={reason} onChange={e => setReason(e.target.value)} className="input" placeholder="Ej. Precio, se fue con otro…" />
        </div>
        <button onClick={submit} disabled={saving} className="btn btn-danger w-full flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
          Marcar como perdida
        </button>
      </div>
    </Sheet>
  )
}
