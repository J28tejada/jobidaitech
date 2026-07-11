import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { sendInviteEmail } from '@/lib/email'
import {
  ASSIGNABLE_ROLES,
  canManageMembers,
  getMembershipRole,
  getWorkspaceContext,
  type WorkspaceRole,
} from '@/lib/workspaces'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const role = await getMembershipRole(ctx.user.id, params.id)
  if (!role || !canManageMembers(role)) {
    return NextResponse.json({ error: 'No tienes permiso para invitar en este espacio' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const inviteRole: WorkspaceRole = ASSIGNABLE_ROLES.includes(body.role) ? body.role : 'member'

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Correo inválido' }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    // ¿Ya es miembro?
    const { data: existingMember } = await supabase
      .from('workspace_members')
      .select('id, users:user_id ( email )')
      .eq('workspace_id', params.id)

    const already = (existingMember ?? []).some((m: any) => {
      const memberEmail = Array.isArray(m.users) ? m.users[0]?.email : m.users?.email
      return typeof memberEmail === 'string' && memberEmail.toLowerCase() === email
    })
    if (already) {
      return NextResponse.json({ error: 'Esa persona ya es miembro del negocio' }, { status: 409 })
    }

    // Reutilizar invitación pendiente si existe para ese correo
    const { data: invitation, error } = await supabase
      .from('invitations')
      .insert({
        workspace_id: params.id,
        email,
        role: inviteRole,
        scope: 'all',
        invited_by: ctx.user.id,
      })
      .select('id, token, email, role')
      .single()

    if (error || !invitation) {
      throw error ?? new Error('No se pudo crear la invitación')
    }

    const origin = new URL(request.url).origin
    const link = `${origin}/unirse?token=${invitation.token}`

    // Intentar enviar el correo (si Resend está configurado); si no, se comparte el enlace.
    const { data: ws } = await supabase.from('workspaces').select('name').eq('id', params.id).maybeSingle()
    const emailSent = await sendInviteEmail({
      to: invitation.email,
      workspaceName: ws?.name ?? 'un negocio',
      inviterName: ctx.user.name ?? null,
      role: invitation.role,
      link,
    })

    return NextResponse.json(
      {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        token: invitation.token,
        link,
        emailSent,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/workspaces/[id]/invitations', error)
    return NextResponse.json({ error: 'Error al crear la invitación' }, { status: 500 })
  }
}
