'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus,
  MoreVertical,
  Package,
  Boxes,
  PackagePlus,
  PackageMinus,
  SlidersHorizontal,
  History,
  Archive,
  Trash2,
  Edit,
  Lock,
  Rocket,
  AlertTriangle,
  Search,
  Loader2,
  X,
} from 'lucide-react'

import { SUPPORT } from '@/lib/support'
import { useCurrency } from './CurrencyProvider'

interface Movement {
  id: string
  type: 'in' | 'out' | 'adjust'
  quantity: number
  note: string | null
  createdAt: string | null
}

interface Product {
  id: string
  name: string
  sku: string | null
  unit: string
  cost: number
  price: number
  stock: number
  lowStockThreshold: number
  lowStock: boolean
  active: boolean
  movements?: Movement[]
}

interface Summary {
  totalProducts: number
  inventoryValue: number
  lowStockCount: number
}

const formatQty = (n: number) => {
  const v = Number.isFinite(n) ? n : 0
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

export default function InventoryList() {
  const { format: formatCurrency } = useCurrency()
  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [items, setItems] = useState<Product[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [search, setSearch] = useState('')
  const [onlyLow, setOnlyLow] = useState(false)

  const [mounted, setMounted] = useState(false)
  const [menu, setMenu] = useState<{ item: Product; top: number; left: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [moveTarget, setMoveTarget] = useState<{ product: Product; type: 'in' | 'out' | 'adjust' } | null>(null)
  const [historyTarget, setHistoryTarget] = useState<Product | null>(null)

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
      const res = await fetch('/api/products', { credentials: 'include' })
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
      fetch('/api/products/summary', { credentials: 'include' })
        .then(r => (r.ok ? r.json() : null))
        .then(s => s && setSummary(s))
        .catch(() => {})
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const openMenu = (e: React.MouseEvent, item: Product) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenu({ item, top: rect.bottom + 6, left: Math.max(rect.right - 220, 8) })
  }

  const archive = async (item: Product) => {
    await fetch(`/api/products/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ active: !item.active }),
    })
    await load()
  }

  const remove = async (item: Product) => {
    if (!window.confirm(`¿Eliminar "${item.name}"? Se borrará también su historial.`)) return
    await fetch(`/api/products/${item.id}`, { method: 'DELETE', credentials: 'include' })
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

  const visible = items.filter(p => {
    if (onlyLow && !p.lowStock) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Inventario</h1>
          <p className="text-gray-600 mt-1 sm:mt-2">¿Qué tengo y cuánto? Controla tus productos y existencias.</p>
        </div>
        <button
          onClick={() => {
            setEditing(null)
            setShowForm(true)
          }}
          className="btn btn-primary flex items-center justify-center w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Nuevo producto
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card border-l-4 border-l-primary-600">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Productos</p>
          <p className="text-2xl font-bold text-gray-900">{summary?.totalProducts ?? 0}</p>
        </div>
        <div className="card border-l-4 border-l-success-600">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Valor del inventario</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary?.inventoryValue ?? 0)}</p>
          <p className="text-xs text-gray-500 mt-1">al costo</p>
        </div>
        <button
          onClick={() => setOnlyLow(v => !v)}
          className={`card border-l-4 text-left transition-colors ${
            onlyLow ? 'border-l-danger-600 ring-2 ring-danger-200' : 'border-l-danger-600'
          }`}
        >
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Bajo stock</p>
          <p className="text-2xl font-bold text-danger-600">{summary?.lowStockCount ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">{onlyLow ? 'Mostrando solo estos' : 'Toca para filtrar'}</p>
        </button>
      </div>

      {/* Buscador */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o SKU..."
            className="input pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Lista */}
      {visible.length === 0 ? (
        <div className="text-center py-12">
          <Boxes className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay productos</h3>
          <p className="text-gray-500 mb-4">
            {search || onlyLow ? 'Ningún producto coincide con el filtro.' : 'Agrega tu primer producto para controlar el stock.'}
          </p>
          {!search && !onlyLow && (
            <button
              onClick={() => {
                setEditing(null)
                setShowForm(true)
              }}
              className="btn btn-primary text-sm"
            >
              Nuevo producto
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(item => (
            <div key={item.id} className={`card flex items-center justify-between gap-3 ${!item.active ? 'opacity-60' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{item.name}</h3>
                  {item.lowStock && item.active && (
                    <span className="badge badge-danger inline-flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Bajo stock
                    </span>
                  )}
                  {!item.active && <span className="badge badge-warning">Archivado</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                  {item.sku && <span>SKU: {item.sku}</span>}
                  {item.price > 0 && <span>Precio: {formatCurrency(item.price)}</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-base font-bold ${item.lowStock && item.active ? 'text-danger-600' : 'text-gray-900'}`}>
                  {formatQty(item.stock)} <span className="text-xs font-normal text-gray-500">{item.unit}</span>
                </p>
                <p className="text-xs text-gray-500">en stock</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {item.active && (
                  <>
                    <button
                      onClick={() => setMoveTarget({ product: item, type: 'in' })}
                      className="btn btn-success text-xs hidden sm:inline-flex items-center"
                      title="Registrar entrada"
                    >
                      <PackagePlus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setMoveTarget({ product: item, type: 'out' })}
                      className="btn btn-danger text-xs hidden sm:inline-flex items-center"
                      title="Registrar salida"
                    >
                      <PackageMinus className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                <button onClick={e => openMenu(e, item)} className="text-gray-400 hover:text-gray-600 p-1" title="Opciones">
                  <MoreVertical className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Menú de opciones (portal) */}
      {mounted &&
        menu &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: menu.top, left: menu.left, width: 212 }}
            className="bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-[80]"
          >
            {menu.item.active && (
              <>
                <button
                  onClick={() => {
                    const it = menu.item
                    setMenu(null)
                    setMoveTarget({ product: it, type: 'in' })
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                >
                  <PackagePlus className="h-4 w-4 text-success-600" /> Registrar entrada
                </button>
                <button
                  onClick={() => {
                    const it = menu.item
                    setMenu(null)
                    setMoveTarget({ product: it, type: 'out' })
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                >
                  <PackageMinus className="h-4 w-4 text-danger-600" /> Registrar salida
                </button>
                <button
                  onClick={() => {
                    const it = menu.item
                    setMenu(null)
                    setMoveTarget({ product: it, type: 'adjust' })
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                >
                  <SlidersHorizontal className="h-4 w-4 text-gray-400" /> Ajustar stock
                </button>
              </>
            )}
            <button
              onClick={() => {
                const it = menu.item
                setMenu(null)
                setHistoryTarget(it)
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
            >
              <History className="h-4 w-4 text-gray-400" /> Ver movimientos
            </button>
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
            <button
              onClick={() => {
                const it = menu.item
                setMenu(null)
                archive(it)
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
            >
              <Archive className="h-4 w-4 text-gray-400" /> {menu.item.active ? 'Archivar' : 'Reactivar'}
            </button>
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
        <ProductForm
          product={editing}
          onClose={() => {
            setShowForm(false)
            setEditing(null)
          }}
          onSaved={async () => {
            setShowForm(false)
            setEditing(null)
            await load()
          }}
        />
      )}

      {moveTarget && (
        <MovementForm
          product={moveTarget.product}
          type={moveTarget.type}
          onClose={() => setMoveTarget(null)}
          onSaved={async () => {
            setMoveTarget(null)
            await load()
          }}
        />
      )}

      {historyTarget && <HistorySheet product={historyTarget} onClose={() => setHistoryTarget(null)} />}
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

function ProductForm({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(product?.name ?? '')
  const [sku, setSku] = useState(product?.sku ?? '')
  const [unit, setUnit] = useState(product?.unit ?? 'unidad')
  const [cost, setCost] = useState(product ? String(product.cost) : '')
  const [price, setPrice] = useState(product ? String(product.price) : '')
  const [stock, setStock] = useState(product ? String(product.stock) : '')
  const [threshold, setThreshold] = useState(product ? String(product.lowStockThreshold) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const base = {
        name,
        sku,
        unit,
        cost: Number(cost) || 0,
        price: Number(price) || 0,
        lowStockThreshold: Number(threshold) || 0,
      }
      const res = product
        ? await fetch(`/api/products/${product.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(base),
          })
        : await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ ...base, stock: Number(stock) || 0 }),
          })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || body?.message || 'No se pudo guardar')
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title={product ? 'Editar producto' : 'Nuevo producto'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Nombre *</label>
          <input value={name} onChange={e => setName(e.target.value)} required className="input" placeholder="Ej. Cemento gris 42.5kg" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">SKU / código</label>
            <input value={sku} onChange={e => setSku(e.target.value)} className="input" placeholder="Opcional" />
          </div>
          <div>
            <label className="label">Unidad</label>
            <input value={unit} onChange={e => setUnit(e.target.value)} className="input" placeholder="unidad, caja, lb…" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Costo</label>
            <input value={cost} onChange={e => setCost(e.target.value)} type="number" step="0.01" min="0" className="input" placeholder="0.00" />
          </div>
          <div>
            <label className="label">Precio de venta</label>
            <input value={price} onChange={e => setPrice(e.target.value)} type="number" step="0.01" min="0" className="input" placeholder="0.00" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {!product && (
            <div>
              <label className="label">Stock inicial</label>
              <input value={stock} onChange={e => setStock(e.target.value)} type="number" step="0.01" min="0" className="input" placeholder="0" />
            </div>
          )}
          <div>
            <label className="label">Alerta de bajo stock</label>
            <input
              value={threshold}
              onChange={e => setThreshold(e.target.value)}
              type="number"
              step="0.01"
              min="0"
              className="input"
              placeholder="0 = sin alerta"
            />
          </div>
        </div>
        {product && (
          <p className="text-xs text-gray-500">
            El stock actual ({formatQty(product.stock)} {product.unit}) se cambia con entradas, salidas o ajustes.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving} className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {product ? 'Guardar cambios' : 'Crear producto'}
        </button>
      </form>
    </Sheet>
  )
}

function MovementForm({
  product,
  type,
  onClose,
  onSaved,
}: {
  product: Product
  type: 'in' | 'out' | 'adjust'
  onClose: () => void
  onSaved: () => void
}) {
  const [quantity, setQuantity] = useState('')
  const [newStock, setNewStock] = useState(String(product.stock))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const titles = {
    in: 'Registrar entrada',
    out: 'Registrar salida',
    adjust: 'Ajustar stock',
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const payload =
        type === 'adjust'
          ? { type, newStock: Number(newStock), note }
          : { type, quantity: Number(quantity), note }
      const res = await fetch(`/api/products/${product.id}/movements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || body?.message || 'No se pudo registrar')
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title={`${titles[type]} — ${product.name}`} onClose={onClose}>
      <div className="mb-4 rounded-lg bg-gray-50 p-3 text-sm flex justify-between">
        <span className="text-gray-600">Stock actual</span>
        <span className="font-semibold text-gray-900">
          {formatQty(product.stock)} {product.unit}
        </span>
      </div>
      <form onSubmit={submit} className="space-y-4">
        {type === 'adjust' ? (
          <div>
            <label className="label">Nuevo stock real *</label>
            <input
              value={newStock}
              onChange={e => setNewStock(e.target.value)}
              required
              autoFocus
              type="number"
              step="0.01"
              min="0"
              className="input"
              placeholder="0"
            />
            <p className="text-xs text-gray-500 mt-1">Se registrará la diferencia con el stock actual.</p>
          </div>
        ) : (
          <div>
            <label className="label">Cantidad ({type === 'in' ? 'entra' : 'sale'}) *</label>
            <input
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              required
              autoFocus
              type="number"
              step="0.01"
              min="0"
              className="input"
              placeholder="0"
            />
          </div>
        )}
        <div>
          <label className="label">Nota (opcional)</label>
          <input value={note} onChange={e => setNote(e.target.value)} className="input" placeholder="Ej. compra, venta, merma…" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className={`btn w-full flex items-center justify-center gap-2 disabled:opacity-60 ${
            type === 'in' ? 'btn-success' : type === 'out' ? 'btn-danger' : 'btn-primary'
          }`}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {titles[type]}
        </button>
      </form>
    </Sheet>
  )
}

function HistorySheet({ product, onClose }: { product: Product; onClose: () => void }) {
  const [movements, setMovements] = useState<Movement[] | null>(null)

  useEffect(() => {
    fetch(`/api/products/${product.id}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => setMovements(d?.movements ?? []))
      .catch(() => setMovements([]))
  }, [product.id])

  const typeLabel = { in: 'Entrada', out: 'Salida', adjust: 'Ajuste' }

  return (
    <Sheet title={`Movimientos — ${product.name}`} onClose={onClose}>
      {movements === null ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
        </div>
      ) : movements.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">Aún no hay movimientos.</p>
      ) : (
        <div className="space-y-2">
          {movements.map(m => (
            <div key={m.id} className="flex items-center justify-between border-b border-gray-100 pb-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{typeLabel[m.type]}</p>
                {m.note && <p className="text-xs text-gray-500 truncate">{m.note}</p>}
                {m.createdAt && (
                  <p className="text-xs text-gray-400">{new Date(m.createdAt).toLocaleString('es-ES')}</p>
                )}
              </div>
              <span className={`text-sm font-semibold ${m.quantity >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                {m.quantity >= 0 ? '+' : ''}
                {formatQty(m.quantity)} {product.unit}
              </span>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  )
}

function Paywall() {
  const waNumber = (SUPPORT.whatsapp || '').replace(/\D/g, '')
  const waLink = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent('Hola, quiero activar el módulo de Inventario en ContaTaller.')}`
    : null
  return (
    <div className="max-w-2xl mx-auto text-center py-10 space-y-6">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-100">
        <Lock className="h-8 w-8 text-primary-600" />
      </div>
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Inventario — ¿Qué tengo y cuánto?</h1>
        <p className="text-gray-600 mt-2">
          Controla tus productos y existencias: stock al día, entradas/salidas y alertas de bajo stock.
          Este módulo está incluido en los planes <strong>Negocio</strong> y <strong>Pro</strong>.
        </p>
      </div>
      <div className="grid sm:grid-cols-3 gap-4 text-left">
        {[
          { icon: Package, t: 'Catálogo', d: 'Productos con costo, precio y unidad.' },
          { icon: Boxes, t: 'Stock al día', d: 'Entradas, salidas y ajustes con historial.' },
          { icon: AlertTriangle, t: 'Bajo stock', d: 'Alerta cuando algo está por acabarse.' },
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
