'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus,
  MoreVertical,
  Coins,
  MessageCircle,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit,
  Lock,
  Rocket,
  AlertTriangle,
  Loader2,
  X,
} from 'lucide-react'

import { SUPPORT } from '@/lib/support'
import { useCurrency } from './CurrencyProvider'
import { useToast } from './Toaster'
import { useConfirm } from './ConfirmDialog'

interface Receivable {
  id: string
  projectId: string | null
  client: string
  clientPhone: string | null
  description: string
  amount: number
  dueDate: string | null
  status: 'open' | 'paid' | 'cancelled'
  paid: number
  balance: number
}

interface Summary {
  totalOutstanding: number
  overdueAmount: number
  overdueCount: number
  openCount: number
}

interface ProjectOption {
  id: string
  name: string
}

const todayStr = () => new Date().toISOString().slice(0, 10)
const isOverdue = (r: Receivable) => r.status === 'open' && r.balance > 0 && !!r.dueDate && r.dueDate < todayStr()

const formatDate = (value: string | null) => {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

const reminderLink = (r: Receivable, fmt: (n: number) => string) => {
  const digits = (r.clientPhone || '').replace(/\D/g, '')
  if (!digits) return null
  const msg =
    `Hola ${r.client}, te recuerdo tu saldo pendiente de ${fmt(r.balance)}` +
    (r.description ? ` por ${r.description}` : '') +
    (r.dueDate ? ` (vence ${formatDate(r.dueDate)})` : '') +
    `. ¡Gracias!`
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`
}

export default function ReceivablesList() {
  const { format: formatCurrency } = useCurrency()
  const toast = useToast()
  const confirm = useConfirm()
  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [items, setItems] = useState<Receivable[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [statusFilter, setStatusFilter] = useState<'open' | 'paid' | 'all'>('open')

  const [mounted, setMounted] = useState(false)
  const [menu, setMenu] = useState<{ item: Receivable; top: number; left: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Receivable | null>(null)
  const [abonoTarget, setAbonoTarget] = useState<Receivable | null>(null)

  useEffect(() => {
    setMounted(true)
    load()
  }, [])

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

  const load = async () => {
    try {
      const res = await fetch('/api/receivables', { credentials: 'include' })
      if (res.status === 403) {
        const body = await res.json().catch(() => null)
        if (body?.error === 'module_locked') {
          setLocked(true)
          setLoading(false)
          return
        }
      }
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
      // Resumen y proyectos (para el formulario)
      fetch('/api/receivables/summary', { credentials: 'include' })
        .then(r => (r.ok ? r.json() : null))
        .then(s => s && setSummary(s))
        .catch(() => {})
      fetch('/api/projects', { credentials: 'include' })
        .then(r => (r.ok ? r.json() : []))
        .then(p => setProjects(Array.isArray(p) ? p.map((x: any) => ({ id: x.id, name: x.name })) : []))
        .catch(() => {})
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const openMenu = (e: React.MouseEvent, item: Receivable) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenu({ item, top: rect.bottom + 6, left: Math.max(rect.right - 216, 8) })
  }

  const updateStatus = async (item: Receivable, status: 'paid' | 'cancelled') => {
    const res = await fetch(`/api/receivables/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      toast.success(status === 'paid' ? 'Cuenta marcada como pagada' : 'Cuenta cancelada')
    } else {
      toast.error('No se pudo actualizar la cuenta')
    }
    await load()
  }

  const remove = async (item: Receivable) => {
    const ok = await confirm({
      title: 'Eliminar cuenta por cobrar',
      message: `¿Eliminar la cuenta por cobrar de ${item.client}?`,
      confirmText: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    const res = await fetch(`/api/receivables/${item.id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) toast.success('Cuenta eliminada')
    else toast.error('No se pudo eliminar la cuenta')
    await load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (locked) {
    return <Paywall />
  }

  const visible = items.filter(r => (statusFilter === 'all' ? true : r.status === statusFilter))

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Cobros</h1>
          <p className="text-gray-600 mt-1 sm:mt-2">¿Quién me debe? Controla el fiado, los abonos y los saldos.</p>
        </div>
        <button
          onClick={() => {
            setEditing(null)
            setShowForm(true)
          }}
          className="btn btn-primary flex items-center justify-center w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Nueva cuenta por cobrar
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card border-l-4 border-l-yellow-500">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Por cobrar</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary?.totalOutstanding ?? 0)}</p>
          <p className="text-xs text-gray-500 mt-1">{summary?.openCount ?? 0} cuenta(s) abierta(s)</p>
        </div>
        <div className="card border-l-4 border-l-danger-600">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Vencido</p>
          <p className="text-2xl font-bold text-danger-600">{formatCurrency(summary?.overdueAmount ?? 0)}</p>
          <p className="text-xs text-gray-500 mt-1">{summary?.overdueCount ?? 0} cuenta(s) vencida(s)</p>
        </div>
        <div className="card">
          <label className="label">Mostrar</label>
          <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
            <option value="open">Abiertas</option>
            <option value="paid">Pagadas</option>
            <option value="all">Todas</option>
          </select>
        </div>
      </div>

      {/* Lista */}
      {visible.length === 0 ? (
        <div className="text-center py-12">
          <Coins className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay cuentas por cobrar</h3>
          <p className="text-gray-500 mb-4">Registra a quién le vendiste fiado para no perder de vista tus cobros.</p>
          <button
            onClick={() => {
              setEditing(null)
              setShowForm(true)
            }}
            className="btn btn-primary text-sm"
          >
            Nueva cuenta por cobrar
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(item => {
            const overdue = isOverdue(item)
            return (
              <div key={item.id} className="card flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{item.client}</h3>
                    {item.status === 'paid' && <span className="badge badge-success">Pagada</span>}
                    {item.status === 'cancelled' && <span className="badge badge-danger">Cancelada</span>}
                    {overdue && (
                      <span className="badge badge-danger inline-flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Vencida
                      </span>
                    )}
                  </div>
                  {item.description && <p className="text-xs text-gray-500 truncate mt-0.5">{item.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    {item.dueDate && (
                      <span className={overdue ? 'text-danger-600 font-medium' : ''}>Vence: {formatDate(item.dueDate)}</span>
                    )}
                    {item.paid > 0 && item.status === 'open' && <span>Abonado: {formatCurrency(item.paid)}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-base font-bold ${overdue ? 'text-danger-600' : 'text-gray-900'}`}>
                    {formatCurrency(item.status === 'open' ? item.balance : 0)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.status === 'open' ? 'Saldo' : `Total ${formatCurrency(item.amount)}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {item.status === 'open' && (
                    <button
                      onClick={() => setAbonoTarget(item)}
                      className="btn btn-success text-xs hidden sm:inline-flex items-center"
                      title="Registrar abono"
                    >
                      <Coins className="h-3.5 w-3.5 mr-1" /> Abono
                    </button>
                  )}
                  <button onClick={e => openMenu(e, item)} className="text-gray-400 hover:text-gray-600 p-1" title="Opciones">
                    <MoreVertical className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Menú de opciones (portal) */}
      {mounted &&
        menu &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: menu.top, left: menu.left, width: 208 }}
            className="bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-[80]"
          >
            {menu.item.status === 'open' && (
              <button
                onClick={() => {
                  const it = menu.item
                  setMenu(null)
                  setAbonoTarget(it)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
              >
                <Coins className="h-4 w-4 text-gray-400" /> Registrar abono
              </button>
            )}
            {reminderLink(menu.item, formatCurrency) && (
              <a
                href={reminderLink(menu.item, formatCurrency)!}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenu(null)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
              >
                <MessageCircle className="h-4 w-4 text-green-500" /> Recordar por WhatsApp
              </a>
            )}
            <button
              onClick={() => {
                const it = menu.item
                setMenu(null)
                setEditing(it)
                setShowForm(true)
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
            >
              <Edit className="h-4 w-4 text-gray-400" /> Editar
            </button>
            {menu.item.status === 'open' && (
              <button
                onClick={() => {
                  const it = menu.item
                  setMenu(null)
                  updateStatus(it, 'paid')
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
              >
                <CheckCircle2 className="h-4 w-4 text-success-600" /> Marcar como pagada
              </button>
            )}
            {menu.item.status === 'open' && (
              <button
                onClick={() => {
                  const it = menu.item
                  setMenu(null)
                  updateStatus(it, 'cancelled')
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
              >
                <XCircle className="h-4 w-4 text-gray-400" /> Cancelar
              </button>
            )}
            <div className="border-t border-gray-100 my-1" />
            <button
              onClick={() => {
                const it = menu.item
                setMenu(null)
                remove(it)
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 text-left"
            >
              <Trash2 className="h-4 w-4" /> Eliminar
            </button>
          </div>,
          document.body
        )}

      {showForm && (
        <ReceivableForm
          receivable={editing}
          projects={projects}
          onClose={() => {
            setShowForm(false)
            setEditing(null)
          }}
          onSaved={async () => {
            const wasEditing = !!editing
            setShowForm(false)
            setEditing(null)
            await load()
            toast.success(wasEditing ? 'Cuenta actualizada' : 'Cuenta por cobrar creada')
          }}
        />
      )}

      {abonoTarget && (
        <AbonoForm
          receivable={abonoTarget}
          onClose={() => setAbonoTarget(null)}
          onSaved={async () => {
            setAbonoTarget(null)
            await load()
            toast.success('Abono registrado')
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  )
}

function ReceivableForm({
  receivable,
  projects,
  onClose,
  onSaved,
}: {
  receivable: Receivable | null
  projects: ProjectOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const [client, setClient] = useState(receivable?.client ?? '')
  const [clientPhone, setClientPhone] = useState(receivable?.clientPhone ?? '')
  const [description, setDescription] = useState(receivable?.description ?? '')
  const [amount, setAmount] = useState(receivable ? String(receivable.amount) : '')
  const [dueDate, setDueDate] = useState(receivable?.dueDate ?? '')
  const [projectId, setProjectId] = useState(receivable?.projectId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const payload = {
        client,
        clientPhone,
        description,
        amount: Number(amount),
        dueDate: dueDate || null,
        projectId: projectId || null,
      }
      const res = receivable
        ? await fetch(`/api/receivables/${receivable.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
          })
        : await fetch('/api/receivables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
          })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.message || body?.error || 'No se pudo guardar')
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title={receivable ? 'Editar cuenta por cobrar' : 'Nueva cuenta por cobrar'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Cliente *</label>
          <input value={client} onChange={e => setClient(e.target.value)} required className="input" placeholder="Nombre del cliente" />
        </div>
        <div>
          <label className="label">WhatsApp del cliente</label>
          <input
            value={clientPhone}
            onChange={e => setClientPhone(e.target.value)}
            inputMode="tel"
            className="input"
            placeholder="Ej. 809 123 4567"
          />
        </div>
        <div>
          <label className="label">Monto *</label>
          <input
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
            inputMode="decimal"
            type="number"
            step="0.01"
            min="0"
            className="input"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="label">Descripción</label>
          <input value={description} onChange={e => setDescription(e.target.value)} className="input" placeholder="Ej. Muebles de cocina" />
        </div>
        <div>
          <label className="label">Fecha de vencimiento</label>
          <input value={dueDate ?? ''} onChange={e => setDueDate(e.target.value)} type="date" className="input" />
        </div>
        {projects.length > 0 && (
          <div>
            <label className="label">Proyecto (opcional)</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} className="input">
              <option value="">Sin proyecto</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving} className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {receivable ? 'Guardar cambios' : 'Crear cuenta por cobrar'}
        </button>
      </form>
    </Sheet>
  )
}

function AbonoForm({ receivable, onClose, onSaved }: { receivable: Receivable; onClose: () => void; onSaved: () => void }) {
  const { format: formatCurrency } = useCurrency()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayStr())
  const [method, setMethod] = useState('')
  const [note, setNote] = useState('')
  const [registerAsIncome, setRegisterAsIncome] = useState(!!receivable.projectId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/receivables/${receivable.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amount: Number(amount), date, method, note, registerAsIncome }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.message || body?.error || 'No se pudo registrar el abono')
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar el abono')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title={`Registrar abono — ${receivable.client}`} onClose={onClose}>
      <div className="mb-4 rounded-lg bg-gray-50 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Saldo actual</span>
          <span className="font-semibold text-gray-900">{formatCurrency(receivable.balance)}</span>
        </div>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Monto del abono *</label>
          <input
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
            autoFocus
            inputMode="decimal"
            type="number"
            step="0.01"
            min="0"
            className="input"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="label">Fecha</label>
          <input value={date} onChange={e => setDate(e.target.value)} type="date" className="input" />
        </div>
        <div>
          <label className="label">Método (opcional)</label>
          <input value={method} onChange={e => setMethod(e.target.value)} className="input" placeholder="Efectivo, transferencia…" />
        </div>
        <div>
          <label className="label">Nota (opcional)</label>
          <input value={note} onChange={e => setNote(e.target.value)} className="input" />
        </div>
        {receivable.projectId && (
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={registerAsIncome}
              onChange={e => setRegisterAsIncome(e.target.checked)}
              className="mt-0.5"
            />
            <span>Registrar también como ingreso del proyecto (cuenta en la ganancia)</span>
          </label>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving} className="btn btn-success w-full flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
          Registrar abono
        </button>
      </form>
    </Sheet>
  )
}

function Paywall() {
  const waNumber = (SUPPORT.whatsapp || '').replace(/\D/g, '')
  const waLink = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent('Hola, quiero activar el módulo de Cobros en Jobidai.')}`
    : null
  return (
    <div className="max-w-2xl mx-auto text-center py-10 space-y-6">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-100">
        <Lock className="h-8 w-8 text-primary-600" />
      </div>
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Cobros — ¿Quién me debe?</h1>
        <p className="text-gray-600 mt-2">
          Lleva el control del fiado: registra deudas de clientes, abonos, saldos y envía recordatorios por WhatsApp.
          Este módulo está incluido en los planes <strong>Negocio</strong> y <strong>Pro</strong>.
        </p>
      </div>
      <div className="grid sm:grid-cols-3 gap-4 text-left">
        {[
          { icon: Coins, t: 'Saldos al día', d: 'Sabé cuánto te deben y quién.' },
          { icon: AlertTriangle, t: 'Vencidos', d: 'Detecta las deudas atrasadas al instante.' },
          { icon: MessageCircle, t: 'Recordatorios', d: 'Cobra por WhatsApp con un toque.' },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="card">
            <Icon className="h-5 w-5 text-primary-600 mb-2" />
            <h3 className="font-semibold text-gray-900 text-sm">{t}</h3>
            <p className="text-xs text-gray-600 mt-1">{d}</p>
          </div>
        ))}
      </div>
      {waLink && (
        <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary inline-flex items-center gap-2">
          <Rocket className="h-4 w-4" /> Actualizar mi plan
        </a>
      )}
    </div>
  )
}
