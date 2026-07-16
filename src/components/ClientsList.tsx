'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Search, MoreVertical, Users, Edit, Trash2, MessageCircle, Loader2, X } from 'lucide-react'

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
        <button
          onClick={() => {
            setEditing(null)
            setShowForm(true)
          }}
          className="btn btn-primary flex items-center justify-center w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Nuevo cliente
        </button>
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
    </div>
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
