'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus,
  MoreVertical,
  FileText,
  MessageCircle,
  Link2,
  Send,
  CheckCircle2,
  XCircle,
  FolderPlus,
  Edit,
  Trash2,
  Loader2,
  X,
} from 'lucide-react'

import { useToast } from './Toaster'
import { useConfirm } from './ConfirmDialog'
import { useCurrency } from './CurrencyProvider'

interface QuoteItem {
  description: string
  quantity: number
  unitPrice: number
  lineTotal?: number
}
interface Quote {
  id: string
  clientId: string | null
  clientName: string
  clientPhone: string | null
  number: string | null
  title: string
  notes: string
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
  taxEnabled: boolean
  taxRate: number
  subtotal: number
  taxAmount: number
  total: number
  validUntil: string | null
  token: string | null
  projectId: string | null
  items: QuoteItem[]
}
interface ClientOption {
  id: string
  name: string
  phone: string | null
}

const STATUS: Record<Quote['status'], { label: string; cls: string }> = {
  draft: { label: 'Borrador', cls: 'badge-warning' },
  sent: { label: 'Enviada', cls: 'badge-info' },
  accepted: { label: 'Aceptada', cls: 'badge-success' },
  rejected: { label: 'Rechazada', cls: 'badge-danger' },
  expired: { label: 'Vencida', cls: 'badge-warning' },
}

const publicUrl = (token: string | null) =>
  token && typeof window !== 'undefined' ? `${window.location.origin}/cotizacion/${token}` : ''

export default function QuotesList() {
  const toast = useToast()
  const confirm = useConfirm()
  const { format } = useCurrency()

  const [items, setItems] = useState<Quote[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const [mounted, setMounted] = useState(false)
  const [menu, setMenu] = useState<{ item: Quote; top: number; left: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Quote | null>(null)
  const [convertTarget, setConvertTarget] = useState<Quote | null>(null)

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
      const [q, c] = await Promise.all([
        fetch('/api/quotes', { credentials: 'include' }).then(r => (r.ok ? r.json() : [])),
        fetch('/api/clients', { credentials: 'include' }).then(r => (r.ok ? r.json() : [])),
      ])
      setItems(Array.isArray(q) ? q : [])
      setClients(Array.isArray(c) ? c.map((x: any) => ({ id: x.id, name: x.name, phone: x.phone })) : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const openMenu = (e: React.MouseEvent, item: Quote) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenu({ item, top: rect.bottom + 6, left: Math.max(rect.right - 220, 8) })
  }

  const setStatus = async (item: Quote, status: string, successMsg: string) => {
    const res = await fetch(`/api/quotes/${item.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    })
    if (res.ok) toast.success(successMsg)
    else toast.error('No se pudo actualizar la cotización')
    await load()
  }

  const remove = async (item: Quote) => {
    const ok = await confirm({
      title: 'Eliminar cotización',
      message: `¿Eliminar la cotización ${item.number ?? ''}?`,
      confirmText: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    const res = await fetch(`/api/quotes/${item.id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) toast.success('Cotización eliminada')
    else toast.error('No se pudo eliminar')
    await load()
  }

  const share = (item: Quote) => {
    const url = publicUrl(item.token)
    const msg = `Hola ${item.clientName}, aquí está tu cotización ${item.number ?? ''} por ${format(item.total)}: ${url}`
    const digits = (item.clientPhone || '').replace(/\D/g, '')
    const wa = digits ? `https://wa.me/${digits}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(wa, '_blank', 'noopener,noreferrer')
    // Si estaba en borrador, marcarla como enviada.
    if (item.status === 'draft') setStatus(item, 'sent', 'Cotización marcada como enviada')
  }

  const copyLink = async (item: Quote) => {
    const url = publicUrl(item.token)
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Enlace copiado')
    } catch {
      toast.info(url)
    }
  }

  const visible = items.filter(q => (statusFilter === 'all' ? true : q.status === statusFilter))

  if (loading) {
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Cotizaciones</h1>
          <p className="text-gray-600 mt-1 sm:mt-2">Presupuestos que tu cliente puede aceptar en línea.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="btn btn-primary flex items-center justify-center w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Nueva cotización
        </button>
      </div>

      <div className="card">
        <div className="sm:max-w-xs">
          <label className="label">Estado</label>
          <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">Todas</option>
            <option value="draft">Borrador</option>
            <option value="sent">Enviadas</option>
            <option value="accepted">Aceptadas</option>
            <option value="rejected">Rechazadas</option>
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay cotizaciones</h3>
          <p className="text-gray-500 mb-4">Crea un presupuesto y compártelo por WhatsApp para cerrarlo más rápido.</p>
          <button onClick={() => { setEditing(null); setShowForm(true) }} className="btn btn-primary text-sm">
            Nueva cotización
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(item => (
            <div key={item.id} className="card flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-gray-400">{item.number}</span>
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{item.clientName}</h3>
                  <span className={`badge ${STATUS[item.status].cls}`}>{STATUS[item.status].label}</span>
                  {item.projectId && <span className="badge badge-info">Proyecto creado</span>}
                </div>
                {item.title && <p className="text-xs text-gray-500 truncate mt-0.5">{item.title}</p>}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-base font-bold text-gray-900">{format(item.total)}</p>
                {item.validUntil && <p className="text-xs text-gray-500">Vence {new Date(item.validUntil).toLocaleDateString('es-ES')}</p>}
              </div>
              <button onClick={e => openMenu(e, item)} className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0" title="Opciones">
                <MoreVertical className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {mounted &&
        menu &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: menu.top, left: menu.left, width: 220 }}
            className="bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-[80]"
          >
            <MenuBtn icon={MessageCircle} color="text-green-500" label="Compartir por WhatsApp" onClick={() => { const it = menu.item; setMenu(null); share(it) }} />
            <MenuBtn icon={Link2} label="Copiar enlace" onClick={() => { const it = menu.item; setMenu(null); copyLink(it) }} />
            <MenuBtn icon={Edit} label="Editar" onClick={() => { const it = menu.item; setMenu(null); setEditing(it); setShowForm(true) }} />
            <div className="border-t border-gray-100 my-1" />
            {item_status(menu.item, 'sent') && <MenuBtn icon={Send} label="Marcar enviada" onClick={() => { const it = menu.item; setMenu(null); setStatus(it, 'sent', 'Marcada como enviada') }} />}
            {menu.item.status !== 'accepted' && <MenuBtn icon={CheckCircle2} color="text-success-600" label="Marcar aceptada" onClick={() => { const it = menu.item; setMenu(null); setStatus(it, 'accepted', 'Marcada como aceptada') }} />}
            {menu.item.status !== 'rejected' && <MenuBtn icon={XCircle} label="Marcar rechazada" onClick={() => { const it = menu.item; setMenu(null); setStatus(it, 'rejected', 'Marcada como rechazada') }} />}
            {!menu.item.projectId && <MenuBtn icon={FolderPlus} color="text-primary-600" label="Convertir a proyecto" onClick={() => { const it = menu.item; setMenu(null); setConvertTarget(it) }} />}
            <div className="border-t border-gray-100 my-1" />
            <MenuBtn icon={Trash2} color="text-red-600" danger label="Eliminar" onClick={() => { const it = menu.item; setMenu(null); remove(it) }} />
          </div>,
          document.body
        )}

      {showForm && (
        <QuoteForm
          quote={editing}
          clients={clients}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={async () => {
            const wasEditing = !!editing
            setShowForm(false)
            setEditing(null)
            await load()
            toast.success(wasEditing ? 'Cotización actualizada' : 'Cotización creada')
          }}
        />
      )}

      {convertTarget && (
        <ConvertDialog
          quote={convertTarget}
          onClose={() => setConvertTarget(null)}
          onDone={async (msg) => {
            setConvertTarget(null)
            await load()
            toast.success(msg)
          }}
        />
      )}
    </div>
  )
}

function item_status(q: Quote, target: string) {
  // Mostrar "Marcar enviada" solo si aún es borrador.
  return target === 'sent' && q.status === 'draft'
}

function MenuBtn({ icon: Icon, label, onClick, color, danger }: { icon: any; label: string; onClick: () => void; color?: string; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left ${danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}`}
    >
      <Icon className={`h-4 w-4 ${color ?? 'text-gray-400'}`} /> {label}
    </button>
  )
}

// ---------------------------------------------------------------------------

function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative bg-white w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto`}>
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

interface Row { description: string; quantity: string; unitPrice: string }

function QuoteForm({ quote, clients, onClose, onSaved }: { quote: Quote | null; clients: ClientOption[]; onClose: () => void; onSaved: () => void }) {
  const { format } = useCurrency()
  const [clientId, setClientId] = useState(quote?.clientId ?? '')
  const [clientName, setClientName] = useState(quote?.clientId ? '' : quote?.clientName ?? '')
  const [clientPhone, setClientPhone] = useState(quote?.clientPhone ?? '')
  const [title, setTitle] = useState(quote?.title ?? '')
  const [validUntil, setValidUntil] = useState(quote?.validUntil ?? '')
  const [notes, setNotes] = useState(quote?.notes ?? '')
  const [taxEnabled, setTaxEnabled] = useState(quote?.taxEnabled ?? false)
  const [taxRate, setTaxRate] = useState(String(quote?.taxRate ?? 18))
  const [rows, setRows] = useState<Row[]>(
    quote && quote.items.length > 0
      ? quote.items.map(it => ({ description: it.description, quantity: String(it.quantity), unitPrice: String(it.unitPrice) }))
      : [{ description: '', quantity: '1', unitPrice: '' }]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setRow = (i: number, patch: Partial<Row>) => setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const addRow = () => setRows(rs => [...rs, { description: '', quantity: '1', unitPrice: '' }])
  const removeRow = (i: number) => setRows(rs => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs))

  const lineTotal = (r: Row) => (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0)
  const subtotal = rows.reduce((s, r) => s + lineTotal(r), 0)
  const taxAmount = taxEnabled ? subtotal * ((Number(taxRate) || 0) / 100) : 0
  const total = subtotal + taxAmount

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const items = rows
        .filter(r => r.description.trim() || Number(r.unitPrice) > 0)
        .map(r => ({ description: r.description.trim(), quantity: Number(r.quantity) || 0, unitPrice: Number(r.unitPrice) || 0 }))
      if (items.length === 0) throw new Error('Agrega al menos una partida')

      const payload = {
        clientId: clientId || null,
        clientName: clientId ? undefined : clientName,
        clientPhone,
        title,
        validUntil: validUntil || null,
        notes,
        taxEnabled,
        taxRate: Number(taxRate) || 0,
        items,
      }
      const res = quote
        ? await fetch(`/api/quotes/${quote.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
        : await fetch('/api/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
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
    <Sheet title={quote ? 'Editar cotización' : 'Nueva cotización'} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Cliente *</label>
          {clients.length > 0 && (
            <select
              className="input mb-2"
              value={clientId}
              onChange={e => { setClientId(e.target.value); if (e.target.value) setClientName('') }}
            >
              <option value="">— Escribir a mano —</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          {!clientId && (
            <div className="grid grid-cols-2 gap-2">
              <input value={clientName} onChange={e => setClientName(e.target.value)} className="input" placeholder="Nombre del cliente" />
              <input value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="input" placeholder="WhatsApp (opcional)" inputMode="tel" />
            </div>
          )}
        </div>

        <div>
          <label className="label">Título / trabajo</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="input" placeholder="Ej. Muebles de cocina" />
        </div>

        {/* Partidas */}
        <div>
          <label className="label">Partidas *</label>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex gap-2 items-start">
                <input
                  value={r.description}
                  onChange={e => setRow(i, { description: e.target.value })}
                  className="input flex-1"
                  placeholder="Descripción"
                />
                <input
                  value={r.quantity}
                  onChange={e => setRow(i, { quantity: e.target.value })}
                  className="input w-16"
                  inputMode="decimal"
                  placeholder="Cant."
                  title="Cantidad"
                />
                <input
                  value={r.unitPrice}
                  onChange={e => setRow(i, { unitPrice: e.target.value })}
                  className="input w-24"
                  inputMode="decimal"
                  placeholder="Precio"
                  title="Precio unitario"
                />
                <button type="button" onClick={() => removeRow(i)} className="p-2 text-gray-400 hover:text-red-500 flex-shrink-0" title="Quitar">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addRow} className="mt-2 text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
            <Plus className="h-4 w-4" /> Agregar partida
          </button>
        </div>

        {/* Totales */}
        <div className="rounded-lg bg-gray-50 p-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium text-gray-900">{format(subtotal)}</span>
          </div>
          <label className="flex items-center gap-2 text-gray-700">
            <input type="checkbox" checked={taxEnabled} onChange={e => setTaxEnabled(e.target.checked)} />
            <span>Aplicar ITBIS</span>
            {taxEnabled && (
              <input value={taxRate} onChange={e => setTaxRate(e.target.value)} className="input w-16 h-8 py-0" inputMode="decimal" />
            )}
            {taxEnabled && <span>%</span>}
          </label>
          {taxEnabled && (
            <div className="flex justify-between">
              <span className="text-gray-600">ITBIS</span>
              <span className="font-medium text-gray-900">{format(taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-gray-200">
            <span className="font-semibold text-gray-900">Total</span>
            <span className="font-bold text-gray-900">{format(total)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Válida hasta</label>
            <input type="date" value={validUntil ?? ''} onChange={e => setValidUntil(e.target.value)} className="input" />
          </div>
        </div>
        <div>
          <label className="label">Notas / condiciones</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="input" placeholder="Ej. Válida por 15 días. 50% de anticipo." />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving} className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {quote ? 'Guardar cambios' : 'Crear cotización'}
        </button>
      </form>
    </Sheet>
  )
}

function ConvertDialog({ quote, onClose, onDone }: { quote: Quote; onClose: () => void; onDone: (msg: string) => void }) {
  const { format } = useCurrency()
  const [createReceivable, setCreateReceivable] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const convert = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/quotes/${quote.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ createReceivable }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || 'No se pudo convertir')
      onDone(body?.receivableCreated ? 'Proyecto y cuenta por cobrar creados' : 'Proyecto creado desde la cotización')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al convertir')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title="Convertir a proyecto" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Se creará un proyecto para <strong>{quote.clientName}</strong> con presupuesto de <strong>{format(quote.total)}</strong> y la cotización quedará como aceptada.
        </p>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={createReceivable} onChange={e => setCreateReceivable(e.target.checked)} className="mt-0.5" />
          <span>Crear también la cuenta por cobrar por el total (para darle seguimiento al pago).</span>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={convert} disabled={saving} className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
          Convertir a proyecto
        </button>
      </div>
    </Sheet>
  )
}
