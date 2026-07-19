'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Search, MoreVertical, Users, Edit, Trash2, MessageCircle, Loader2, X, ClipboardList, Scissors, CalendarClock, Gift, HeartHandshake } from 'lucide-react'

import { useCurrency } from './CurrencyProvider'

import { useToast } from './Toaster'
import { useConfirm } from './ConfirmDialog'

interface Client {
  id: string
  name: string
  phone: string | null
  email: string | null
  taxId: string | null
  address: string | null
  notes: string | null
}

const waLink = (phone: string | null) => {
  const digits = (phone || '').replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}` : null
}

export default function ClientsList() {
  const toast = useToast()
  const confirm = useConfirm()
  const [items, setItems] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [mounted, setMounted] = useState(false)
  const [menu, setMenu] = useState<{ item: Client; top: number; left: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [historyClient, setHistoryClient] = useState<Client | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [showImport, setShowImport] = useState(false)

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
      const res = await fetch('/api/clients', { credentials: 'include' })
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const openMenu = (e: React.MouseEvent, item: Client) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenu({ item, top: rect.bottom + 6, left: Math.max(rect.right - 200, 8) })
  }

  const remove = async (item: Client) => {
    const ok = await confirm({
      title: 'Eliminar cliente',
      message: `¿Eliminar a "${item.name}"?`,
      confirmText: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    const res = await fetch(`/api/clients/${item.id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) toast.success('Cliente eliminado')
    else toast.error('No se pudo eliminar el cliente')
    await load()
  }

  const visible = items.filter(c => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    )
  })

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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-600 mt-1 sm:mt-2">Tu libreta de clientes: contacto, RNC/cédula y notas.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => setShowInactive(true)} className="btn btn-secondary flex items-center justify-center" title="Reactivar clientes">
            <HeartHandshake className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Reactivación</span>
          </button>
          <button onClick={() => setShowImport(true)} className="btn btn-secondary flex items-center justify-center" title="Importar contactos (pegar lista)">
            <ClipboardList className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Importar</span>
          </button>
          <button
            onClick={() => { setEditing(null); setShowForm(true) }}
            className="btn btn-primary flex items-center justify-center flex-1 sm:flex-none"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Nuevo cliente
          </button>
        </div>
      </div>

      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o correo..."
            className="input pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay clientes</h3>
          <p className="text-gray-500 mb-4">Agrega tus clientes para cotizar y cobrar más rápido.</p>
          {!search && (
            <button onClick={() => { setEditing(null); setShowForm(true) }} className="btn btn-primary text-sm">
              Nuevo cliente
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(item => (
            <div key={item.id} className="card flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 truncate">{item.name}</h3>
                <div className="flex flex-wrap items-center gap-x-3 text-xs text-gray-500 mt-0.5">
                  {item.phone && <span>{item.phone}</span>}
                  {item.email && <span className="truncate">{item.email}</span>}
                  {item.taxId && <span>RNC/Céd: {item.taxId}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {waLink(item.phone) && (
                  <a
                    href={waLink(item.phone)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-green-500 hover:text-green-600"
                    title="WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                )}
                <button onClick={e => openMenu(e, item)} className="text-gray-400 hover:text-gray-600 p-1" title="Opciones">
                  <MoreVertical className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {mounted &&
        menu &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: menu.top, left: menu.left, width: 192 }}
            className="bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-[80]"
          >
            <button
              onClick={() => { const it = menu.item; setMenu(null); setHistoryClient(it) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
            >
              <ClipboardList className="h-4 w-4 text-gray-400" /> Ficha / historial
            </button>
            <button
              onClick={() => { const it = menu.item; setMenu(null); setEditing(it); setShowForm(true) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
            >
              <Edit className="h-4 w-4 text-gray-400" /> Editar
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button
              onClick={() => { const it = menu.item; setMenu(null); remove(it) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 text-left"
            >
              <Trash2 className="h-4 w-4" /> Eliminar
            </button>
          </div>,
          document.body
        )}

      {showForm && (
        <ClientForm
          client={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={async () => {
            const wasEditing = !!editing
            setShowForm(false)
            setEditing(null)
            await load()
            toast.success(wasEditing ? 'Cliente actualizado' : 'Cliente creado')
          }}
        />
      )}

      {historyClient && (
        <ClientHistorySheet
          client={historyClient}
          onClose={() => setHistoryClient(null)}
          onEdit={() => { const c = historyClient; setHistoryClient(null); setEditing(c); setShowForm(true) }}
        />
      )}

      {showInactive && <InactiveSheet onClose={() => setShowInactive(false)} />}

      {showImport && (
        <BulkImportSheet
          onClose={() => setShowImport(false)}
          onDone={async () => { setShowImport(false); await load() }}
        />
      )}
    </div>
  )
}

// Parser de "pegar lista": una línea por contacto. Detecta el teléfono (7+
// dígitos) y toma el resto como nombre. Acepta separadores (coma/;/tab) o texto
// suelto ("Juan Pérez 809-555-1234").
export function parseContacts(text: string): { name: string; phone: string }[] {
  const digitCount = (s: string) => (s.match(/\d/g) || []).length
  const out: { name: string; phone: string }[] = []
  text.split(/\r?\n/).forEach(raw => {
    const line = raw.trim()
    if (!line) return
    let name = ''
    let phone = ''
    if (/[,;\t]/.test(line)) {
      const parts = line.split(/[,;\t]+/).map(p => p.trim()).filter(Boolean)
      let phoneIdx = -1
      let best = 6
      parts.forEach((p, i) => { const d = digitCount(p); if (d >= 7 && d > best) { best = d; phoneIdx = i } })
      if (phoneIdx >= 0) {
        phone = parts[phoneIdx]
        name = parts.filter((_, i) => i !== phoneIdx).join(' ').trim()
      } else {
        name = parts.join(' ').trim()
      }
    } else {
      const m = line.match(/\+?[\d][\d\s().-]{5,}\d/)
      if (m && digitCount(m[0]) >= 7) {
        phone = m[0].trim()
        name = line.replace(m[0], '').trim()
      } else {
        name = line
      }
    }
    if (!name && phone) name = phone
    if (name || phone) out.push({ name, phone })
  })
  return out
}

function BulkImportSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const parsed = parseContacts(text)

  const importAll = async () => {
    if (parsed.length === 0 || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/clients/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ contacts: parsed }),
      })
      const b = await res.json().catch(() => null)
      if (!res.ok) throw new Error(b?.error || 'No se pudo importar')
      const added = b?.added ?? 0
      const skipped = b?.skipped ?? 0
      toast.success(`${added} agregado(s)${skipped ? `, ${skipped} omitido(s)` : ''}`)
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al importar')
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-900">Importar contactos</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-gray-600">
            Pega tus contactos, <strong>uno por línea</strong>. Puede ser "Nombre, teléfono" o el nombre y el número juntos.
            No se duplican los que ya tengan el mismo teléfono.
          </p>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={8}
            className="input font-mono text-sm"
            placeholder={'Juan Pérez, 809-555-1234\nMaría, 8291234567\nPedro 849 111 2222'}
          />
          {parsed.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs text-gray-500 mb-1.5">Se detectaron {parsed.length} contacto(s):</p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {parsed.slice(0, 8).map((c, i) => (
                  <p key={i} className="text-sm text-gray-700 truncate">
                    {c.name}{c.phone ? <span className="text-gray-400"> · {c.phone}</span> : <span className="text-amber-600"> · sin teléfono</span>}
                  </p>
                ))}
                {parsed.length > 8 && <p className="text-xs text-gray-400">…y {parsed.length - 8} más</p>}
              </div>
            </div>
          )}
          <button
            onClick={importAll}
            disabled={parsed.length === 0 || saving}
            className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
            Importar {parsed.length > 0 ? `${parsed.length} contacto(s)` : ''}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

interface InactiveClient { id: string; name: string; phone: string | null; lastVisit: string; daysSince: number }

function InactiveSheet({ onClose }: { onClose: () => void }) {
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [list, setList] = useState<InactiveClient[]>([])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/clients/inactive?days=${days}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setList(d.clients || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [days])

  const wa = (c: InactiveClient) => {
    const digits = (c.phone || '').replace(/\D/g, '')
    const msg = `Hola ${c.name}, ¡te extrañamos! ✂ Vuelve esta semana y te tenemos una sorpresa. ¿Te agendo?`
    return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-900">Reactivación</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600">Clientes que no vienen hace tiempo. Escríbeles por WhatsApp para que vuelvan.</p>
          <div className="flex gap-2">
            {[30, 60, 90].map(d => (
              <button key={d} onClick={() => setDays(d)} className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${days === d ? 'bg-primary-600 text-white border-primary-600' : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'}`}>
                +{d} días
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary-600" /></div>
          ) : list.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">Ningún cliente inactivo por más de {days} días. 🎉</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">{list.length} cliente{list.length === 1 ? '' : 's'} para reactivar</p>
              {list.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                    <p className="text-xs text-gray-500">Hace {c.daysSince} días</p>
                  </div>
                  <a href={wa(c)} target="_blank" rel="noopener noreferrer" className="btn btn-success text-sm flex items-center gap-1.5 flex-shrink-0">
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

interface ApptLite {
  id: string
  startsAt: string
  title: string
  staffName: string
  price: number
  tip: number
  status: string
}
const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Agendada', confirmed: 'Confirmada', done: 'Atendida', cancelled: 'Cancelada', no_show: 'No asistió',
}

interface LoyaltyStatus { enabled: boolean; threshold: number; rewardPct: number; sinceRedemption: number; rewardAvailable: boolean }

function ClientHistorySheet({ client, onClose, onEdit }: { client: Client; onClose: () => void; onEdit: () => void }) {
  const { format } = useCurrency()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [appts, setAppts] = useState<ApptLite[]>([])
  const [summary, setSummary] = useState<{ visitCount: number; totalSpent: number; lastVisit: string | null; favoriteBarber: string | null } | null>(null)
  const [loyalty, setLoyalty] = useState<LoyaltyStatus | null>(null)
  const [redeeming, setRedeeming] = useState(false)

  const loadLoyalty = () => {
    fetch(`/api/clients/${client.id}/loyalty`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setLoyalty(d) })
      .catch(() => {})
  }

  useEffect(() => {
    fetch(`/api/clients/${client.id}/history`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) { setAppts(d.appointments || []); setSummary(d.summary || null) } })
      .catch(() => {})
      .finally(() => setLoading(false))
    loadLoyalty()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id])

  const redeem = async () => {
    if (redeeming) return
    setRedeeming(true)
    try {
      const res = await fetch(`/api/clients/${client.id}/loyalty/redeem`, { method: 'POST', credentials: 'include' })
      if (res.ok) { toast.success('Recompensa canjeada'); loadLoyalty() }
      else toast.error('No se pudo canjear')
    } finally {
      setRedeeming(false)
    }
  }

  const dt = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-900 truncate">{client.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Resumen */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-gray-900">{summary?.visitCount ?? 0}</p>
              <p className="text-[11px] text-gray-500">Visitas</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-gray-900">{format(summary?.totalSpent ?? 0)}</p>
              <p className="text-[11px] text-gray-500">Gastado</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-center">
              <p className="text-sm font-bold text-gray-900 truncate">{summary?.lastVisit ? dt(summary.lastVisit) : '—'}</p>
              <p className="text-[11px] text-gray-500">Última</p>
            </div>
          </div>

          {summary?.favoriteBarber && (
            <p className="text-sm text-gray-600 flex items-center gap-1.5">
              <Scissors className="h-4 w-4 text-primary-600" /> Barbero habitual: <strong className="text-gray-900">{summary.favoriteBarber}</strong>
            </p>
          )}

          {/* Fidelidad */}
          {loyalty?.enabled && (
            <div className={`rounded-lg p-3 border ${loyalty.rewardAvailable ? 'bg-success-50 border-success-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                  <Gift className="h-4 w-4 text-primary-600" /> Fidelidad
                </p>
                <p className="text-xs text-gray-500">
                  {Math.min(loyalty.sinceRedemption, loyalty.threshold)}/{loyalty.threshold}
                </p>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-primary-600" style={{ width: `${Math.min(100, (loyalty.sinceRedemption / loyalty.threshold) * 100)}%` }} />
              </div>
              {loyalty.rewardAvailable ? (
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-success-700">🎁 {loyalty.rewardPct >= 100 ? 'Servicio gratis' : `${loyalty.rewardPct}% de descuento`} disponible</p>
                  <button onClick={redeem} disabled={redeeming} className="btn btn-success text-sm flex items-center gap-1.5 disabled:opacity-60">
                    {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Canjear
                  </button>
                </div>
              ) : (
                <p className="text-xs text-gray-500 mt-1.5">Le faltan {loyalty.threshold - loyalty.sinceRedemption} visita{loyalty.threshold - loyalty.sinceRedemption === 1 ? '' : 's'} para {loyalty.rewardPct >= 100 ? 'un servicio gratis' : `${loyalty.rewardPct}% de descuento`}.</p>
              )}
            </div>
          )}

          {/* Preferencias / notas */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-700">Preferencias / notas</p>
              <button onClick={onEdit} className="text-xs text-primary-600 hover:underline">Editar</button>
            </div>
            <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3 min-h-[2.5rem] whitespace-pre-line">
              {client.notes || <span className="text-gray-400">Sin notas. Anota el corte preferido, número de guía, etc.</span>}
            </p>
          </div>

          {/* Historial */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5"><CalendarClock className="h-4 w-4 text-gray-400" /> Historial de visitas</p>
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary-600" /></div>
            ) : appts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Aún no tiene citas registradas.</p>
            ) : (
              <div className="space-y-2">
                {appts.map(a => (
                  <div key={a.id} className={`flex items-center justify-between border border-gray-200 rounded-lg p-2.5 ${a.status === 'cancelled' || a.status === 'no_show' ? 'opacity-60' : ''}`}>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 truncate">{a.title || 'Cita'}{a.staffName ? ` · ✂ ${a.staffName}` : ''}</p>
                      <p className="text-xs text-gray-500">{dt(a.startsAt)} · {STATUS_LABEL[a.status] || a.status}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-medium text-gray-900">{format(a.price)}</p>
                      {a.tip > 0 && <p className="text-[11px] text-gray-500">+{format(a.tip)} prop.</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function ClientForm({ client, onClose, onSaved }: { client: Client | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(client?.name ?? '')
  const [phone, setPhone] = useState(client?.phone ?? '')
  const [email, setEmail] = useState(client?.email ?? '')
  const [taxId, setTaxId] = useState(client?.taxId ?? '')
  const [address, setAddress] = useState(client?.address ?? '')
  const [notes, setNotes] = useState(client?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const payload = { name, phone, email, taxId, address, notes }
      const res = client
        ? await fetch(`/api/clients/${client.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
        : await fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
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

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">{client ? 'Editar cliente' : 'Nuevo cliente'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input value={name} onChange={e => setName(e.target.value)} required className="input" placeholder="Nombre del cliente" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Teléfono / WhatsApp</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" className="input" placeholder="809 123 4567" />
            </div>
            <div>
              <label className="label">RNC / Cédula</label>
              <input value={taxId} onChange={e => setTaxId(e.target.value)} className="input" placeholder="Opcional" />
            </div>
          </div>
          <div>
            <label className="label">Correo</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="input" placeholder="Opcional" />
          </div>
          <div>
            <label className="label">Dirección</label>
            <input value={address} onChange={e => setAddress(e.target.value)} className="input" placeholder="Opcional" />
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="input" placeholder="Opcional" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={saving} className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {client ? 'Guardar cambios' : 'Crear cliente'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  )
}
