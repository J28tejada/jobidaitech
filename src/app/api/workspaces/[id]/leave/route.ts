import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { ACTIVE_WORKSPACE_COOKIE, getMembershipRole, getWorkspaceContext } from '@/lib/workspaces'

// Un miembro (no dueño) se sale del negocio.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const role = await getMembershipRole(ctx.user.id, params.id)
  if (!role) {
    return NextResponse.json({ error: 'No perteneces a este negocio' }, { status: 403 })
  }
  if (role === 'owner') {
    return NextResponse.json(
      { error: 'El Dueño no puede salir. Transfiere la propiedad o elimina el negocio.' },
      { status: 400 }
    )
  }

  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', params.id)
    .eq('user_id', ctx.user.id)

  if (error) {
    console.error('POST /api/workspaces/[id]/leave', error)
    return NextResponse.json({ error: 'No se pudo salir del negocio' }, { status: 500 })
  }

  const response = NextResponse.json({ success: true, activeWorkspaceId: ctx.personalWorkspaceId })
  response.cookies.set(ACTIVE_WORKSPACE_COOKIE, ctx.personalWorkspaceId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return response
}
