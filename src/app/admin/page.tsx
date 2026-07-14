'use client'

import { useEffect, useState } from 'react'
import { Loader2, ShieldAlert, Search, Check } from 'lucide-react'

import Layout from '@/components/Layout'
import { computeAccess, ymdInMonths, toYmd, ymdToIso, type AccessRow } from '@/lib/subscription'
import { ASSIGNABLE_TIERS, PLAN_LABELS, type PlanTier } from '@/lib/modules'

interface AdminUser extends AccessRow {
  id: string
  email: string | null
  name: string | null
  admin_note: string | null
  plan_tier?: string | null
  created_at: string
}

interface Metrics {
  totalUsers: number
  newUsers7d: number
  newLeads: number
  activatedUsers30d: number
  events30d: Record<string, number>
}

interface Lead {
  id: string
  name: string | null
  email: string | null
  whatsapp: string | null
  business: string | null
  message: string | null
  status: string
  created_at: string
}

const RECENT_DAYS = 7

function isRecent(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() < RECENT_DAYS * 86_400_000
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = async () => {
    const res = await fetch('/api/admin/users')
    if (res.status === 403) {
      setForbidden(true)
      setLoading(false)
      return
    }
    const data = await res.json()
    setUsers(data.users ?? [])
    setLoading(false)
    // KPIs y leads (no bloquean la lista)
    fetch('/api/admin/metrics').then(r => (r.ok ? r.json() : null)).then(m => m && setMetrics(m)).catch(() => {})
    fetch('/api/admin/leads').then(r => (r.ok ? r.json() : { leads: [] })).then(d => setLeads(d.leads ?? [])).catch(() => {})
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    return !q || (u.email ?? '').toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q)
  })

  const recentCount = users.filter(u => isRecent(u.created_at)).length

  const toneClass = (tone: 'ok' | 'warn' | 'off') =>
    tone === 'ok'
      ? 'bg-green-100 text-green-700'
      : tone === 'warn'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-gray-200 text-gray-600'

  return (
    <Layout>
      <div className="space-y-6">
        <div className="">
          <h1 className="text-3xl font-bold text-gray-900">Administración</h1>
          <p className="text-gray-600 mt-2">Gestiona el acceso y las suscripciones de los usuarios.</p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : forbidden ? (
          <div className="card flex items-start gap-4">
            <div className="p-2 bg-red-100 rounded-lg">
              <ShieldAlert className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Acceso restringido</h2>
              <p className="text-gray-600 mt-1">Esta sección es solo para administradores de la plataforma.</p>
            </div>
          </div>
        ) : (
          <>
            {metrics && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Usuarios', value: metrics.totalUsers },
                  { label: 'Nuevos (7d)', value: metrics.newUsers7d },
                  { label: 'Activados (30d)', value: metrics.activatedUsers30d },
                  { label: 'Leads sin atender', value: metrics.newLeads },
                ].map(k => (
                  <div key={k.label} className="card">
                    <p className="text-2xl font-bold text-gray-900">{k.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{k.label}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="card">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por correo o nombre…"
                  className="input pl-10"
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                {filtered.length} usuario(s)
                {recentCount > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 text-primary-700 font-medium">
                    · {recentCount} nuevo(s) en los últimos {RECENT_DAYS} días
                  </span>
                )}
              </p>
            </div>

            <div className="space-y-3">
              {filtered.map(u => {
                const info = computeAccess(u)
                const open = expanded === u.id
                return (
                  <div key={u.id} className="card">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold flex-shrink-0">
                        {(u.name ?? u.email ?? 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-2">
                          {u.name ?? u.email}
                          {isRecent(u.created_at) && (
                            <span className="text-[10px] uppercase tracking-wide bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full">
                              Nuevo
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{u.email}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${toneClass(info.tone)}`}>{info.label}</span>
                      <button
                        onClick={() => setExpanded(open ? null : u.id)}
                        className="btn-icon bg-gray-100 text-gray-700 hover:bg-gray-200 whitespace-nowrap px-3 w-auto"
                      >
                        {open ? 'Cerrar' : 'Gestionar'}
                      </button>
                    </div>

                    {open && <AdminUserEditor user={u} onSaved={load} />}
                  </div>
                )
              })}
            </div>

            {leads.length > 0 && (
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Leads del servicio de marketing</h2>
                <ul className="divide-y divide-gray-100">
                  {leads.map(l => (
                    <li key={l.id} className="py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {l.name ?? l.email ?? 'Sin nombre'}
                            {l.business && <span className="text-gray-500"> · {l.business}</span>}
                          </p>
                          <p className="text-xs text-gray-500">
                            {l.whatsapp ?? l.email ?? ''} · {new Date(l.created_at).toLocaleDateString('es-ES')}
                          </p>
                        </div>
                        {l.whatsapp && (
                          <a
                            href={`https://wa.me/${l.whatsapp.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-success text-xs flex-shrink-0"
                          >
                            WhatsApp
                          </a>
                        )}
                      </div>
                      {l.message && <p className="text-sm text-gray-600 mt-1">{l.message}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}

function AdminUserEditor({ user, onSaved }: { user: AdminUser; onSaved: () => void }) {
  const [enabled, setEnabled] = useState(user.access_enabled !== false)
  const [mode, setMode] = useState<'unlimited' | 'date'>(user.access_until ? 'date' : 'unlimited')
  const [date, setDate] = useState<string>(toYmd(user.access_until) || ymdInMonths(1))
  const [plan, setPlan] = useState<string>(user.plan ?? '')
  const [tier, setTier] = useState<PlanTier>((user.plan_tier as PlanTier) ?? 'pro')
  const [note, setNote] = useState<string>(user.admin_note ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    setSaving(true)
    setSaved(false)
    const accessUntil = !enabled ? undefined : mode === 'unlimited' ? null : ymdToIso(date)
    const payload: Record<string, unknown> = {
      accessEnabled: enabled,
      plan,
      planTier: tier,
      adminNote: note,
    }
    // Solo cambiamos la fecha cuando está Activo (si está en solo lectura, no importa)
    if (enabled) payload.accessUntil = accessUntil
    await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    setSaved(true)
    onSaved()
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
      {/* Estado */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Estado de acceso</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEnabled(true)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${enabled ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 text-gray-600'}`}
          >
            Activo (puede editar)
          </button>
          <button
            type="button"
            onClick={() => setEnabled(false)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${!enabled ? 'bg-gray-700 text-white border-gray-700' : 'border-gray-300 text-gray-600'}`}
          >
            Solo lectura
          </button>
        </div>
      </div>

      {/* Vencimiento (solo si está activo) */}
      {enabled && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Acceso hasta</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="radio" checked={mode === 'unlimited'} onChange={() => setMode('unlimited')} />
              Sin límite
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="radio" checked={mode === 'date'} onChange={() => setMode('date')} />
              Hasta fecha:
            </label>
            <input
              type="date"
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={e => {
                setDate(e.target.value)
                setMode('date')
              }}
              className="input w-auto"
            />
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {[
              { label: '+1 mes', m: 1 },
              { label: '+3 meses', m: 3 },
              { label: '+6 meses', m: 6 },
              { label: '+1 año', m: 12 },
            ].map(b => (
              <button
                key={b.m}
                type="button"
                onClick={() => {
                  setDate(ymdInMonths(b.m))
                  setMode('date')
                }}
                className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Plan (módulos), cobro y nota */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Plan (módulos)</label>
          <select value={tier} onChange={e => setTier(e.target.value as PlanTier)} className="input">
            {ASSIGNABLE_TIERS.map(t => (
              <option key={t} value={t}>
                {PLAN_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Cobro</label>
          <select value={plan} onChange={e => setPlan(e.target.value)} className="input">
            <option value="">Sin plan</option>
            <option value="mensual">Mensual</option>
            <option value="anual">Anual</option>
            <option value="cortesia">Cortesía</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Nota interna</label>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Ej. pagó por transferencia…"
            className="input"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">Registrado: {new Date(user.created_at).toLocaleDateString('es-ES')}</p>
        <button onClick={save} disabled={saving} className="btn btn-primary flex items-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
          {saved ? 'Guardado' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}
