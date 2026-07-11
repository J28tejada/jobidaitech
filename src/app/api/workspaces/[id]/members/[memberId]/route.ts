import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  ASSIGNABLE_ROLES,
  canManageMembers,
  getMembershipRole,
  getWorkspaceContext,
  type WorkspaceRole,
} from '@/lib/workspaces'

// Cambiar el rol de un miembro
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; memberId: string } }
) {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const myRole = await getMembershipRole(ctx.user.id, params.id)
  if (!myRole || !canManageMembers(myRole)) {
    return NextResponse.json({ error: 'No tienes permiso para gestionar miembros' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const supabase = getSupabaseClient()

    // No se puede modificar al Dueño
    const { data: target } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('id', params.memberId)
      .eq('workspace_id', params.id)
      .maybeSingle()

    if (!target) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    }
    if (target.role === 'owner') {
      return NextResponse.json({ error: 'No se puede modificar al Dueño' }, { status: 400 })
    }

    const updates: { role?: WorkspaceRole; scope?: 'all' | 'specific' } = {}

    if (body.role !== undefined) {
      if (!ASSIGNABLE_ROLES.includes(body.role)) {
        return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
      }
      updates.role = body.role
    }

    // Alcance por proyecto
    if (body.scope !== undefined) {
      if (body.scope !== 'all' && body.scope !== 'specific') {
        return NextResponse.json({ error: 'Alcance inválido' }, { status: 400 })
      }
      updates.scope = body.scope

      if (body.scope === 'all') {
        // Sin restricción: limpiar asignaciones
        await supabase.from('member_projects').delete().eq('member_id', params.memberId)
      } else {
        const projectIds: string[] = Array.isArray(body.projectIds) ? body.projectIds : []
        // Validar que los proyectos pertenezcan al negocio
        const { data: validProjects } = await supabase
          .from('projects')
          .select('id')
          .eq('workspace_id', params.id)
          .in('id', projectIds.length > 0 ? projectIds : ['00000000-0000-0000-0000-000000000000'])
        const validIds = new Set((validProjects ?? []).map((p: any) => p.id))
        const toAssign = projectIds.filter(id => validIds.has(id))

        // Reemplazar asignaciones
        await supabase.from('member_projects').delete().eq('member_id', params.memberId)
        if (toAssign.length > 0) {
          await supabase
            .from('member_projects')
            .insert(toAssign.map(pid => ({ member_id: params.memberId, project_id: pid })))
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('workspace_members')
        .update(updates)
        .eq('id', params.memberId)
        .eq('workspace_id', params.id)
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PATCH /api/workspaces/[id]/members/[memberId]', error)
    return NextResponse.json({ error: 'Error al actualizar el rol' }, { status: 500 })
  }
}

// Quitar un miembro
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; memberId: string } }
) {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const myRole = await getMembershipRole(ctx.user.id, params.id)
  if (!myRole || !canManageMembers(myRole)) {
    return NextResponse.json({ error: 'No tienes permiso para gestionar miembros' }, { status: 403 })
  }

  const supabase = getSupabaseClient()

  const { data: target } = await supabase
    .from('workspace_members')
    .select('id, role')
    .eq('id', params.memberId)
    .eq('workspace_id', params.id)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  }
  if (target.role === 'owner') {
    return NextResponse.json({ error: 'No se puede quitar al Dueño del negocio' }, { status: 400 })
  }

  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('id', params.memberId)
    .eq('workspace_id', params.id)

  if (error) {
    console.error('DELETE /api/workspaces/[id]/members/[memberId]', error)
    return NextResponse.json({ error: 'No se pudo quitar al miembro' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
