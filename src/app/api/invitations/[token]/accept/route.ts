import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { ACTIVE_WORKSPACE_COOKIE, getWorkspaceContext } from '@/lib/workspaces'

export async function POST(request: Request, { params }: { params: { token: string } }) {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseClient()

    const { data: invitation, error } = await supabase
      .from('invitations')
      .select('id, workspace_id, email, role, scope, status, expires_at')
      .eq('token', params.token)
      .maybeSingle()

    if (error) throw error

    if (!invitation) {
      return NextResponse.json({ error: 'Invitación no encontrada' }, { status: 404 })
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Esta invitación ya no está disponible' }, { status: 409 })
    }

    if (invitation.expires_at && new Date(invitation.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'La invitación expiró' }, { status: 410 })
    }

    // El correo de la sesión debe coincidir con el de la invitación.
    const myEmail = (ctx.user.email ?? '').toLowerCase()
    if (myEmail !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        {
          error: 'invitation_email_mismatch',
          message: `Esta invitación es para ${invitation.email}. Inicia sesión con ese correo para aceptarla.`,
        },
        { status: 403 }
      )
    }

    // Crear (o actualizar) la membresía.
    const { data: existing } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', invitation.workspace_id)
      .eq('user_id', ctx.user.id)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('workspace_members')
        .update({ role: invitation.role, scope: invitation.scope })
        .eq('id', existing.id)
    } else {
      await supabase.from('workspace_members').insert({
        workspace_id: invitation.workspace_id,
        user_id: ctx.user.id,
        role: invitation.role,
        scope: invitation.scope,
      })
    }

    await supabase.from('invitations').update({ status: 'accepted' }).eq('id', invitation.id)

    // Dejar el negocio recién aceptado como espacio activo.
    const response = NextResponse.json({ workspaceId: invitation.workspace_id })
    response.cookies.set(ACTIVE_WORKSPACE_COOKIE, invitation.workspace_id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
    return response
  } catch (error) {
    console.error('POST /api/invitations/[token]/accept', error)
    return NextResponse.json({ error: 'Error al aceptar la invitación' }, { status: 500 })
  }
}
