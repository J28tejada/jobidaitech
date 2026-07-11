import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getMembershipRole, getWorkspaceContext } from '@/lib/workspaces'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const role = await getMembershipRole(ctx.user.id, params.id)
  if (!role) {
    return NextResponse.json({ error: 'No perteneces a este espacio' }, { status: 403 })
  }

  try {
    const supabase = getSupabaseClient()

    const [{ data: memberRows, error: membersError }, { data: inviteRows, error: invitesError }] = await Promise.all([
      supabase
        .from('workspace_members')
        .select('id, role, scope, user_id, created_at, users:user_id ( name, email, image_url )')
        .eq('workspace_id', params.id),
      supabase
        .from('invitations')
        .select('id, email, role, status, token, created_at, expires_at')
        .eq('workspace_id', params.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ])

    if (membersError) throw membersError
    if (invitesError) throw invitesError

    // Proyectos asignados por miembro (para alcance 'specific')
    const memberIds = (memberRows ?? []).map((m: any) => m.id)
    const assignedByMember: Record<string, string[]> = {}
    if (memberIds.length > 0) {
      const { data: mp } = await supabase
        .from('member_projects')
        .select('member_id, project_id')
        .in('member_id', memberIds)
      for (const row of mp ?? []) {
        ;(assignedByMember[row.member_id] ??= []).push(row.project_id)
      }
    }

    const members = (memberRows ?? []).map((m: any) => {
      const u = Array.isArray(m.users) ? m.users[0] : m.users
      return {
        memberId: m.id,
        userId: m.user_id,
        name: u?.name ?? null,
        email: u?.email ?? null,
        imageUrl: u?.image_url ?? null,
        role: m.role,
        scope: m.scope ?? 'all',
        assignedProjectIds: assignedByMember[m.id] ?? [],
        isYou: m.user_id === ctx.user.id,
      }
    })

    // Dueño primero, luego por rol descendente
    const rankOrder: Record<string, number> = { owner: 4, admin: 3, editor: 2, member: 1, viewer: 0 }
    members.sort((a, b) => (rankOrder[b.role] ?? 0) - (rankOrder[a.role] ?? 0))

    return NextResponse.json({
      myRole: role,
      members,
      invitations: inviteRows ?? [],
    })
  } catch (error) {
    console.error('GET /api/workspaces/[id]/members', error)
    return NextResponse.json({ error: 'Error al obtener los miembros' }, { status: 500 })
  }
}
