'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, UserPlus, Building2, Copy, Check, Trash2, Mail, ShieldCheck } from 'lucide-react'

import Layout from '@/components/Layout'
import {
  ASSIGNABLE_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  canManageMembers,
  type WorkspaceRole,
} from '@/lib/roles'

interface Member {
  memberId: string
  userId: string
  name: string | null
  email: string | null
  imageUrl: string | null
  role: WorkspaceRole
  isYou: boolean
}

interface Invitation {
  id: string
  email: string
  role: WorkspaceRole
  token: string
}

interface ActiveWorkspace {
  id: string
  name: string
  type: 'personal' | 'business'
}

export default function MembersPage() {
  const [workspace, setWorkspace] = useState<ActiveWorkspace | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [myRole, setMyRole] = useState<WorkspaceRole>('viewer')
  const [loading, setLoading] = useState(true)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member')
  const [inviting, setInviting] = useState(false)
  const [newLink, setNewLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const loadMembers = useCallback(async (workspaceId: string) => {
    const res = await fetch(`/api/workspaces/${workspaceId}/members`)
    if (!res.ok) return
    const data = await res.json()
    setMembers(data.members ?? [])
    setInvitations(data.invitations ?? [])
    setMyRole(data.myRole ?? 'viewer')
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch('/api/workspaces')
        const data = await res.json()
        const current: ActiveWorkspace | undefined = (data.workspaces ?? []).find(
          (w: any) => w.id === data.activeWorkspaceId
        )
        if (!active) return
        if (current) {
          setWorkspace({ id: current.id, name: current.name, type: current.type })
          if (current.type === 'business') {
            await loadMembers(current.id)
          }
        }
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [loadMembers])

  const copyLink = (link: string, key: string) => {
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workspace || !inviteEmail.trim() || inviting) return
    setInviting(true)
    setError(null)
    setNewLink(null)
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo invitar')
      setNewLink(data.link)
      setInviteEmail('')
      await loadMembers(workspace.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al invitar')
    } finally {
      setInviting(false)
    }
  }

  const changeRole = async (memberId: string, role: WorkspaceRole) => {
    if (!workspace) return
    await fetch(`/api/workspaces/${workspace.id}/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    await loadMembers(workspace.id)
  }

  const removeMember = async (memberId: string) => {
    if (!workspace || !confirm('¿Quitar a esta persona del negocio?')) return
    await fetch(`/api/workspaces/${workspace.id}/members/${memberId}`, { method: 'DELETE' })
    await loadMembers(workspace.id)
  }

  const revokeInvite = async (invId: string) => {
    if (!workspace) return
    await fetch(`/api/workspaces/${workspace.id}/invitations/${invId}`, { method: 'DELETE' })
    await loadMembers(workspace.id)
  }

  const inviteLinkFor = (token: string) =>
    typeof window !== 'undefined' ? `${window.location.origin}/unirse?token=${token}` : ''

  const iCanManage = canManageMembers(myRole)

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl">
        <div className="pl-14 lg:pl-0">
          <h1 className="text-3xl font-bold text-gray-900">Miembros</h1>
          <p className="text-gray-600 mt-2">Invita colaboradores y controla qué puede hacer cada quien.</p>
        </div>

        {loading ? (
          <div className="flex items-center space-x-2 text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Cargando…</span>
          </div>
        ) : workspace?.type !== 'business' ? (
          <div className="card flex items-start gap-4">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Building2 className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Esto aplica a los negocios</h2>
              <p className="text-gray-600 mt-1">
                Estás en tu espacio <strong>Personal</strong>. Crea un negocio (o cámbiate a uno) desde el selector de
                espacios de arriba para invitar colaboradores.
              </p>
            </div>
          </div>
        ) : (
          <>
            {iCanManage && (
              <div className="card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary-100 rounded-lg">
                    <UserPlus className="h-5 w-5 text-primary-600" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">Invitar a {workspace.name}</h2>
                </div>

                <form onSubmit={handleInvite} className="space-y-3">
                  <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3">
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="correo@ejemplo.com"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <select
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value as WorkspaceRole)}
                      className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {ASSIGNABLE_ROLES.map(r => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                    <button type="submit" disabled={inviting} className="btn btn-primary flex items-center gap-2 disabled:opacity-60">
                      {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                      Invitar
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">{ROLE_DESCRIPTIONS[inviteRole]}</p>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                </form>

                {newLink && (
                  <div className="mt-4 p-3 bg-primary-50 border border-primary-200 rounded-lg">
                    <p className="text-sm font-medium text-gray-800 mb-2">
                      ✅ Invitación creada. Comparte este enlace con la persona:
                    </p>
                    <div className="flex items-center gap-2">
                      <input readOnly value={newLink} className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded bg-white" />
                      <button onClick={() => copyLink(newLink, 'new')} className="btn btn-primary flex items-center gap-1.5">
                        {copied === 'new' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied === 'new' ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Miembros */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Miembros ({members.length})</h2>
              <ul className="divide-y divide-gray-100">
                {members.map(m => (
                  <li key={m.memberId} className="flex items-center gap-3 py-3">
                    <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold flex-shrink-0">
                      {(m.name ?? m.email ?? 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {m.name ?? m.email}
                        {m.isYou && <span className="ml-2 text-xs text-gray-400">(tú)</span>}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{m.email}</p>
                    </div>
                    {iCanManage && m.role !== 'owner' && !m.isYou ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={m.role}
                          onChange={e => changeRole(m.memberId, e.target.value as WorkspaceRole)}
                          className="text-sm px-2 py-1 border border-gray-300 rounded bg-white"
                        >
                          {ASSIGNABLE_ROLES.map(r => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeMember(m.memberId)}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                          title="Quitar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                        {m.role === 'owner' && <ShieldCheck className="h-3 w-3" />}
                        {ROLE_LABELS[m.role]}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Invitaciones pendientes */}
            {iCanManage && invitations.length > 0 && (
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Invitaciones pendientes ({invitations.length})</h2>
                <ul className="divide-y divide-gray-100">
                  {invitations.map(inv => (
                    <li key={inv.id} className="flex items-center gap-3 py-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <Mail className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{inv.email}</p>
                        <p className="text-xs text-gray-500">Invitado como {ROLE_LABELS[inv.role]}</p>
                      </div>
                      <button
                        onClick={() => copyLink(inviteLinkFor(inv.token), inv.id)}
                        className="text-sm text-primary-700 hover:underline flex items-center gap-1"
                      >
                        {copied === inv.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied === inv.id ? 'Copiado' : 'Copiar enlace'}
                      </button>
                      <button
                        onClick={() => revokeInvite(inv.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                        title="Revocar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
