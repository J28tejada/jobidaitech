'use client'

import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { TrendingUp, TrendingDown, Wallet, Plus, Loader2, X, Edit, Trash2, Check } from 'lucide-react'

import Layout from '@/components/Layout'
import { useCurrency } from '@/components/CurrencyProvider'
import { useToast } from '@/components/Toaster'
import { useConfirm } from '@/components/ConfirmDialog'
import { EXPENSE_CATEGORIES } from '@/lib/expenses'

interface Expense { id: string; category: string; description: string; amount: number; date: string | null }
interface IncomeItem { id: string; clientName: string; title: string; price: number; tip: number; startsAt: string | null }

const pad = (n: number) => String(n).padStart(2, '0')
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const todayStr = () => isoDay(new Date())

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export default function FinanzasPage() {
  const { format } = useCurrency()
  const toast = useToast()
  const confirm = useConfirm()

  const [preset, setPreset] = useState<'this_month' | 'last_month' | 'this_year' | 'custom'>('this_month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [income, setIncome] = useState<IncomeItem[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showExpense, setShowExpense] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)

  const { from, to, label } = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    if (preset === 'last_month') {
      const f = new Date(y, m - 1, 1)
      const t = new Date(y, m, 0)
      return { from: isoDay(f), to: isoDay(t), label: `${MONTHS[f.getMonth()]} ${f.getFullYear()}` }
    }
    if (preset === 'this_year') {
      return { from: isoDay(new Date(y, 0, 1)), to: todayStr(), label: `${y}` }
    }
    if (preset === 'custom') {
      return { from: customFrom || isoDay(new Date(y, m, 1)), to: customTo || todayStr(), label: 'Periodo' }
    }
    return { from: isoDay(new Date(y, m, 1)), to: todayStr(), label: `${MONTHS[m]} ${y}` }
  }, [preset, customFrom, customTo])

  const load = async () => {
    setLoading(true)
    try {
      // Ingresos = citas atendidas (status=done) en el rango; gastos simples en el rango.
      const fromIso = new Date(`${from}T00:00:00`).toISOString()
      const toIso = new Date(`${to}T23:59:59`).toISOString()
      const [incRes, expRes] = await Promise.all([
        fetch(`/api/appointments?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&status=done`, { credentials: 'include' }),
        fetch(`/api/expenses?from=${from}&to=${to}`, { credentials: 'include' }),
      ])
      const inc = incRes.ok ? await incRes.json() : []
      const exp = expRes.ok ? await expRes.json() : []
      setIncome(Array.isArray(inc) ? inc : [])
      setExpenses(Array.isArray(exp) ? exp : [])
    } catch {
      setIncome([]); setExpenses([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [from, to]) // eslint-disable-line react-hooks/exhaustive-deps

  const incomeTotal = useMemo(() => income.reduce((s, a) => s + Number(a.price ?? 0) + Number(a.tip ?? 0), 0), [income])
  const expenseTotal = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0), [expenses])
  const balance = incomeTotal - expenseTotal

  const delExpense = async (e: Expense) => {
    const ok = await confirm({ title: 'Eliminar gasto', message: `¿Eliminar este gasto de ${format(e.amount)}?`, confirmText: 'Eliminar', danger: true })
    if (!ok) return
    const res = await fetch(`/api/expenses/${e.id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) { toast.success('Gasto eliminado'); load() }
    else toast.error('No se pudo eliminar')
  }

  return (
    <Layout>
      <div className="space-y-6 w-full max-w-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ingresos y gastos</h1>
            <p className="text-gray-600 mt-1 text-sm">Cuánto entra, cuánto sale y tu balance.</p>
          </div>
          <button onClick={() => { setEditing(null); setShowExpense(true) }} className="btn btn-primary flex items-center gap-1.5 flex-shrink-0">
            <Plus className="h-4 w-4" /> Gasto
          </button>
        </div>

        {/* Periodo */}
        <div className="flex flex-wrap gap-2">
          {([['this_month', 'Este mes'], ['last_month', 'Mes pasado'], ['this_year', 'Este año'], ['custom', 'Personalizado']] as const).map(([k, lbl]) => (
            <button
              key={k}
              onClick={() => setPreset(k)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${preset === k ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
            >
              {lbl}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="label">Desde</label>
              <input type="date" className="input" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">Hasta</label>
              <input type="date" className="input" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}

        {/* Resumen */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card border-l-4 border-l-success-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Ingresos</p>
                <p className="text-2xl font-bold text-gray-900">{format(incomeTotal)}</p>
                <p className="text-xs text-gray-500 mt-0.5">{income.length} cita(s) atendida(s)</p>
              </div>
              <div className="p-3 bg-success-100 rounded-lg"><TrendingUp className="h-6 w-6 text-success-600" /></div>
            </div>
          </div>
          <div className="card border-l-4 border-l-danger-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Gastos</p>
                <p className="text-2xl font-bold text-gray-900">{format(expenseTotal)}</p>
                <p className="text-xs text-gray-500 mt-0.5">{expenses.length} gasto(s)</p>
              </div>
              <div className="p-3 bg-danger-100 rounded-lg"><TrendingDown className="h-6 w-6 text-danger-600" /></div>
            </div>
          </div>
          <div className={`card border-l-4 ${balance >= 0 ? 'border-l-primary-600' : 'border-l-danger-600'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Balance</p>
                <p className={`text-2xl font-bold ${balance >= 0 ? 'text-success-600' : 'text-danger-600'}`}>{format(balance)}</p>
                <p className="text-xs text-gray-500 mt-0.5 capitalize">{label}</p>
              </div>
              <div className="p-3 bg-primary-100 rounded-lg"><Wallet className="h-6 w-6 text-primary-600" /></div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary-600" /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ingresos (citas atendidas) */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Ingresos del periodo</h2>
              <p className="text-xs text-gray-500 mb-4">De tus citas atendidas. Se registran solas al marcar una cita como atendida.</p>
              {income.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">Sin citas atendidas en este periodo.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {income.map(a => (
                    <div key={a.id} className="flex items-center justify-between py-2.5 gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{a.clientName || 'Cliente'}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {a.title || 'Cita'}{a.startsAt ? ` · ${new Date(a.startsAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-success-600 flex-shrink-0">{format(Number(a.price ?? 0) + Number(a.tip ?? 0))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Gastos */}
            <div className="card">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-semibold text-gray-900">Gastos del periodo</h2>
                <button onClick={() => { setEditing(null); setShowExpense(true) }} className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                  <Plus className="h-4 w-4" /> Agregar
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-4">Alquiler, productos, luz, salarios… lo que sale del negocio.</p>
              {expenses.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">Sin gastos en este periodo.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {expenses.map(e => (
                    <div key={e.id} className="flex items-center justify-between py-2.5 gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{e.description || e.category || 'Gasto'}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {e.category ? `${e.category}` : 'Sin categoría'}{e.date ? ` · ${new Date(`${e.date}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-semibold text-danger-600">{format(e.amount)}</span>
                        <button onClick={() => { setEditing(e); setShowExpense(true) }} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Editar"><Edit className="h-4 w-4" /></button>
                        <button onClick={() => delExpense(e)} className="text-danger-500 hover:text-danger-700 p-1" aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showExpense && (
        <ExpenseForm
          expense={editing}
          onClose={() => setShowExpense(false)}
          onSaved={() => { setShowExpense(false); load() }}
        />
      )}
    </Layout>
  )
}

function ExpenseForm({ expense, onClose, onSaved }: { expense: Expense | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '')
  const [category, setCategory] = useState(expense?.category ?? '')
  const [description, setDescription] = useState(expense?.description ?? '')
  const [date, setDate] = useState(expense?.date ?? todayStr())
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) { toast.error('Indica un monto válido'); return }
    setSaving(true)
    try {
      const payload = { amount: amt, category: category || null, description, date }
      const res = expense
        ? await fetch(`/api/expenses/${expense.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
        : await fetch('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
      if (res.ok) { toast.success(expense ? 'Gasto actualizado' : 'Gasto registrado'); onSaved() }
      else { const b = await res.json().catch(() => null); toast.error(b?.error || 'No se pudo guardar') }
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-900">{expense ? 'Editar gasto' : 'Registrar gasto'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="label">Monto</label>
            <input value={amount} onChange={e => setAmount(e.target.value)} type="number" step="0.01" min="0" className="input" placeholder="0.00" autoFocus />
          </div>
          <div>
            <label className="label">Categoría</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {EXPENSE_CATEGORIES.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${category === c ? 'bg-primary-600 text-white border-primary-600' : 'bg-gray-100 text-gray-700 border-transparent hover:bg-gray-200'}`}
                >
                  {category === c && <Check className="h-3.5 w-3.5 inline mr-1" />}{c}
                </button>
              ))}
            </div>
            <input value={category} onChange={e => setCategory(e.target.value)} className="input" placeholder="O escribe otra categoría" />
          </div>
          <div>
            <label className="label">Descripción (opcional)</label>
            <input value={description} onChange={e => setDescription(e.target.value)} className="input" placeholder="Ej. Compra de talco y navajas" />
          </div>
          <div>
            <label className="label">Fecha</label>
            <input value={date ?? ''} onChange={e => setDate(e.target.value)} type="date" className="input" />
          </div>
          <button type="submit" disabled={saving} className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {expense ? 'Guardar cambios' : 'Registrar gasto'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  )
}
