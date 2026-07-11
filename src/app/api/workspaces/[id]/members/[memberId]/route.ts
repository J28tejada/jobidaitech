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
    const newRole: WorkspaceRole = body.role
    if (!ASSIGNABLE_ROLES.includes(newRole)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    // No se puede cambiar el rol del Dueño
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
      return NextResponse.json({ error: 'No se puede cambiar el rol del Dueño' }, { status: 400 })
    }

    const { error } = await supabase
      .from('workspace_members')
      .update({ role: newRole })
      .eq('id', params.memberId)
      .eq('workspace_id', params.id)

    if (error) throw error

    return NextResponse.json({ success: true, role: newRole })
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
