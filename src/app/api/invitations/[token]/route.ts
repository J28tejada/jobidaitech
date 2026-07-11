import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'

// Detalles de una invitación a partir de su token (para la página de aceptación).
export async function GET(request: Request, { params }: { params: { token: string } }) {
  const supabase = getSupabaseClient()

  const { data: invitation, error } = await supabase
    .from('invitations')
    .select('id, email, role, status, expires_at, workspaces:workspace_id ( name ), inviter:invited_by ( name, email )')
    .eq('token', params.token)
    .maybeSingle()

  if (error) {
    console.error('GET /api/invitations/[token]', error)
    return NextResponse.json({ error: 'Error al leer la invitación' }, { status: 500 })
  }

  if (!invitation) {
    return NextResponse.json({ valid: false, reason: 'not_found' }, { status: 404 })
  }

  const workspace = Array.isArray(invitation.workspaces) ? invitation.workspaces[0] : invitation.workspaces
  const inviter = Array.isArray(invitation.inviter) ? invitation.inviter[0] : invitation.inviter

  const expired = invitation.expires_at ? new Date(invitation.expires_at).getTime() < Date.now() : false
  const valid = invitation.status === 'pending' && !expired

  return NextResponse.json({
    valid,
    reason: valid ? null : invitation.status !== 'pending' ? invitation.status : 'expired',
    email: invitation.email,
    role: invitation.role,
    workspaceName: workspace?.name ?? 'Negocio',
    inviterName: inviter?.name ?? inviter?.email ?? null,
  })
}
