'use client'

import { useEffect, useState } from 'react'
import { Loader2, ShieldAlert, Search } from 'lucide-react'

import Layout from '@/components/Layout'
import { computeAccess, isoInMonths, type AccessRow } from '@/lib/subscription'

interface AdminUser extends AccessRow {
  id: string
  email: string | null
  name: string | null
  admin_note: string | null
  created_at: string
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
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
  }

  useEffect(() => {
    load()
  }, [])

  const patch = async (id: string, payload: Record<string, unknown>) => {
    await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    await load()
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    return !q || (u.email ?? '').toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q)
  })

  const toneClass = (tone: 'ok' | 'warn' | 'off') =>
    tone === 'ok'
      ? 'bg-green-100 text-green-700'
      : tone === 'warn'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-gray-200 text-gray-600'

  return (
    <Layout>
      <div className="space-y-6">
        <div className="pl-14 lg:pl-0">
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
              <p className="mt-2 text-sm text-gray-500">{filtered.length} usuario(s)</p>
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
                        <p className="text-sm font-medium text-gray-900 truncate">{u.name ?? u.email}</p>
                        <p className="text-xs text-gray-500 truncate">{u.email}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${toneClass(info.tone)}`}>{info.label}</span>
                      <button
                        onClick={() => setExpanded(open ? null : u.id)}
                        className="btn-icon bg-gray-100 text-gray-700 hover:bg-gray-200"
                      >
                        {open ? '−' : 'Gestionar'}
                      </button>
                    </div>

                    {open && (
                      <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                        {/* Activar */}
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">Activar acceso hasta:</p>
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => patch(u.id, { accessEnabled: true, accessUntil: null })} className="btn btn-success text-xs">
                              Indefinido
                            </button>
                            <button onClick={() => patch(u.id, { accessEnabled: true, accessUntil: isoInMonths(1) })} className="btn btn-secondary text-xs">
                              +1 mes
                            </button>
                            <button onClick={() => patch(u.id, { accessEnabled: true, accessUntil: isoInMonths(3) })} className="btn btn-secondary text-xs">
                              +3 meses
                            </button>
                            <button onClick={() => patch(u.id, { accessEnabled: true, accessUntil: isoInMonths(6) })} className="btn btn-secondary text-xs">
                              +6 meses
                            </button>
                            <button onClick={() => patch(u.id, { accessEnabled: true, accessUntil: isoInMonths(12) })} className="btn btn-secondary text-xs">
                              +1 año
                            </button>
                          </div>
                        </div>

                        {/* Desactivar */}
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">Pasar a solo lectura:</p>
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => patch(u.id, { accessEnabled: false })} className="btn btn-danger text-xs">
                              Ahora
                            </button>
                            <button onClick={() => patch(u.id, { accessEnabled: true, accessUntil: isoInMonths(1) })} className="btn btn-secondary text-xs">
                              En 1 mes
                            </button>
                            <button onClick={() => patch(u.id, { accessEnabled: true, accessUntil: isoInMonths(12) })} className="btn btn-secondary text-xs">
                              En 1 año
                            </button>
                          </div>
                        </div>

                        {/* Plan y nota */}
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Plan</label>
                            <select
                              defaultValue={u.plan ?? ''}
                              onChange={e => patch(u.id, { plan: e.target.value })}
                              className="input"
                            >
                              <option value="">Prueba / sin plan</option>
                              <option value="mensual">Mensual</option>
                              <option value="anual">Anual</option>
                              <option value="cortesia">Cortesía</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Nota interna</label>
                            <input
                              defaultValue={u.admin_note ?? ''}
                              onBlur={e => e.target.value !== (u.admin_note ?? '') && patch(u.id, { adminNote: e.target.value })}
                              placeholder="Ej. pagó por transferencia…"
                              className="input"
                            />
                          </div>
                        </div>

                        <p className="text-xs text-gray-400">
                          Registrado: {new Date(u.created_at).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
