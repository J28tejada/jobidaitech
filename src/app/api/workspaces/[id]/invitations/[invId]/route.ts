import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { canManageMembers, getMembershipRole, getWorkspaceContext, READ_ONLY_ERROR } from '@/lib/workspaces'

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; invId: string } }
) {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  if (!ctx.canWrite) {
    return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
  }

  const role = await getMembershipRole(ctx.user.id, params.id)
  if (!role || !canManageMembers(role)) {
    return NextResponse.json({ error: 'No tienes permiso para gestionar invitaciones' }, { status: 403 })
  }

  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('invitations')
    .update({ status: 'revoked' })
    .eq('id', params.invId)
    .eq('workspace_id', params.id)

  if (error) {
    console.error('DELETE /api/workspaces/[id]/invitations/[invId]', error)
    return NextResponse.json({ error: 'No se pudo revocar la invitación' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
