'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, UserPlus, Building2, Copy, Check, Trash2, Mail, ShieldCheck, FolderCog, ChevronDown } from 'lucide-react'

import Layout from '@/components/Layout'
import { useToast } from '@/components/Toaster'
import { useConfirm } from '@/components/ConfirmDialog'
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
  scope: 'all' | 'specific'
  assignedProjectIds: string[]
  isYou: boolean
}

interface WorkspaceProject {
  id: string
  name: string
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
  const toast = useToast()
  const confirm = useConfirm()
  const [workspace, setWorkspace] = useState<ActiveWorkspace | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [projects, setProjects] = useState<WorkspaceProject[]>([])
  const [myRole, setMyRole] = useState<WorkspaceRole>('viewer')
  const [loading, setLoading] = useState(true)
  const [expandedMember, setExpandedMember] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [transferTarget, setTransferTarget] = useState('')

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member')
  const [inviting, setInviting] = useState(false)
  const [newLink, setNewLink] = useState<string | null>(null)
  const [newEmailSent, setNewEmailSent] = useState(false)
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
          setRenameValue(current.name)
          if (current.type === 'business') {
            await loadMembers(current.id)
            const projRes = await fetch('/api/projects')
            if (projRes.ok) {
              const projData = await projRes.json()
              if (active) setProjects((projData ?? []).map((p: any) => ({ id: p.id, name: p.name })))
            }
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
      setNewEmailSent(Boolean(data.emailSent))
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
    if (!workspace) return
    const ok = await confirm({
      title: 'Quitar miembro',
      message: '¿Quitar a esta persona del negocio?',
      confirmText: 'Quitar',
      danger: true,
    })
    if (!ok) return
    const res = await fetch(`/api/workspaces/${workspace.id}/members/${memberId}`, { method: 'DELETE' })
    if (res.ok) toast.success('Miembro removido')
    else toast.error('No se pudo remover al miembro')
    await loadMembers(workspace.id)
  }

  const revokeInvite = async (invId: string) => {
    if (!workspace) return
    await fetch(`/api/workspaces/${workspace.id}/invitations/${invId}`, { method: 'DELETE' })
    await loadMembers(workspace.id)
  }

  const saveAccess = async (memberId: string, scope: 'all' | 'specific', projectIds: string[]) => {
    if (!workspace) return
    await fetch(`/api/workspaces/${workspace.id}/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, projectIds }),
    })
    await loadMembers(workspace.id)
    setExpandedMember(null)
  }

  const renameBusiness = async (name: string) => {
    if (!workspace || !name.trim()) return
    const res = await fetch(`/api/workspaces/${workspace.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    if (res.ok) window.location.reload()
  }

  const transferOwnership = async (memberId: string) => {
    if (!workspace) return
    const ok = await confirm({
      title: 'Transferir propiedad',
      message: '¿Transferir la propiedad del negocio a esta persona? Tú pasarás a ser Administrador.',
      confirmText: 'Transferir',
    })
    if (!ok) return
    const res = await fetch(`/api/workspaces/${workspace.id}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
    })
    if (res.ok) window.location.reload()
    else toast.error('No se pudo transferir la propiedad')
  }

  const leaveBusiness = async () => {
    if (!workspace) return
    const ok = await confirm({
      title: 'Salir del negocio',
      message: '¿Salir de este negocio? Perderás el acceso a sus datos.',
      confirmText: 'Salir',
      danger: true,
    })
    if (!ok) return
    const res = await fetch(`/api/workspaces/${workspace.id}/leave`, { method: 'POST' })
    if (res.ok) window.location.href = '/'
    else toast.error('No se pudo salir del negocio')
  }

  const deleteBusiness = async () => {
    if (!workspace) return
    const ok = await confirm({
      title: 'Eliminar negocio',
      message: `¿ELIMINAR el negocio "${workspace.name}"? Se borrarán TODOS sus proyectos y transacciones. Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar todo',
      danger: true,
    })
    if (!ok) return
    const res = await fetch(`/api/workspaces/${workspace.id}`, { method: 'DELETE' })
    if (res.ok) window.location.href = '/'
    else toast.error('No se pudo eliminar el negocio')
  }

  const inviteLinkFor = (token: string) =>
    typeof window !== 'undefined' ? `${window.location.origin}/unirse?token=${token}` : ''

  const iCanManage = canManageMembers(myRole)

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl">
        <div className="">
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
                      {newEmailSent
                        ? '✅ Invitación enviada por correo. También puedes compartir este enlace:'
                        : '✅ Invitación creada. Comparte este enlace con la persona:'}
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
                {members.map(m => {
                  const manageable = iCanManage && m.role !== 'owner' && !m.isYou
                  return (
                    <li key={m.memberId} className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold flex-shrink-0">
                          {(m.name ?? m.email ?? 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {m.name ?? m.email}
                            {m.isYou && <span className="ml-2 text-xs text-gray-400">(tú)</span>}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {m.email}
                            {m.scope === 'specific' && (
                              <span className="ml-2 text-primary-600">· {m.assignedProjectIds.length} proyecto(s)</span>
                            )}
                          </p>
                        </div>
                        {manageable ? (
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
                              onClick={() => setExpandedMember(expandedMember === m.memberId ? null : m.memberId)}
                              className={`p-1.5 rounded transition-colors ${
                                expandedMember === m.memberId ? 'bg-primary-100 text-primary-700' : 'text-gray-400 hover:text-primary-600'
                              }`}
                              title="Acceso a proyectos"
                            >
                              <FolderCog className="h-4 w-4" />
                            </button>
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
                      </div>
                      {manageable && expandedMember === m.memberId && (
                        <MemberAccessEditor
                          member={m}
                          projects={projects}
                          onSave={(scope, ids) => saveAccess(m.memberId, scope, ids)}
                          onCancel={() => setExpandedMember(null)}
                        />
                      )}
                    </li>
                  )
                })}
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

            {/* Configuración del negocio */}
            <div className="card space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Configuración del negocio</h2>

              {iCanManage && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del negocio</label>
                  <div className="flex gap-2">
                    <input
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      onClick={() => renameBusiness(renameValue)}
                      disabled={!renameValue.trim() || renameValue.trim() === workspace.name}
                      className="btn btn-primary disabled:opacity-50"
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              )}

              {myRole === 'owner' && members.some(m => !m.isYou) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Transferir propiedad</label>
                  <div className="flex gap-2">
                    <select
                      value={transferTarget}
                      onChange={e => setTransferTarget(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Elegir persona…</option>
                      {members.filter(m => !m.isYou).map(m => (
                        <option key={m.memberId} value={m.memberId}>
                          {m.name ?? m.email}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => transferTarget && transferOwnership(transferTarget)}
                      disabled={!transferTarget}
                      className="btn btn-secondary disabled:opacity-50"
                    >
                      Transferir
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Pasarás a ser Administrador; la otra persona será el Dueño.</p>
                </div>
              )}

              {/* Zona de peligro */}
              <div className="border-t border-gray-100 pt-4">
                {myRole === 'owner' ? (
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-sm font-medium text-red-700">Eliminar negocio</p>
                      <p className="text-xs text-gray-500">Borra todos sus proyectos y transacciones. No se puede deshacer.</p>
                    </div>
                    <button
                      onClick={deleteBusiness}
                      className="px-4 py-2 rounded-lg border border-red-300 text-red-700 text-sm font-medium hover:bg-red-50"
                    >
                      Eliminar negocio
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Salir del negocio</p>
                      <p className="text-xs text-gray-500">Perderás el acceso a los datos de este negocio.</p>
                    </div>
                    <button
                      onClick={leaveBusiness}
                      className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                    >
                      Salir del negocio
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}

function MemberAccessEditor({
  member,
  projects,
  onSave,
  onCancel,
}: {
  member: Member
  projects: WorkspaceProject[]
  onSave: (scope: 'all' | 'specific', projectIds: string[]) => void
  onCancel: () => void
}) {
  const [scope, setScope] = useState<'all' | 'specific'>(member.scope)
  const [selected, setSelected] = useState<string[]>(member.assignedProjectIds)
  const [saving, setSaving] = useState(false)

  const toggle = (id: string) => {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  return (
    <div className="mt-3 ml-12 rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
      <p className="text-sm font-medium text-gray-800">Acceso a proyectos</p>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="radio" checked={scope === 'all'} onChange={() => setScope('all')} />
          Todo el negocio
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="radio" checked={scope === 'specific'} onChange={() => setScope('specific')} />
          Solo proyectos específicos
        </label>
      </div>

      {scope === 'specific' && (
        <div className="max-h-48 overflow-y-auto rounded border border-gray-200 bg-white p-2 space-y-1">
          {projects.length === 0 ? (
            <p className="text-xs text-gray-400 p-2">Aún no hay proyectos en este negocio.</p>
          ) : (
            projects.map(p => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-gray-700 px-1 py-1 hover:bg-gray-50 rounded">
                <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
                <span className="truncate">{p.name}</span>
              </label>
            ))
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5">
          Cancelar
        </button>
        <button
          onClick={() => {
            setSaving(true)
            onSave(scope, scope === 'specific' ? selected : [])
          }}
          disabled={saving}
          className="btn btn-primary text-sm disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar acceso'}
        </button>
      </div>
    </div>
  )
}
