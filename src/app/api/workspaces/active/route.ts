import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { ACTIVE_WORKSPACE_COOKIE, getWorkspaceContext } from '@/lib/workspaces'

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId es obligatorio' }, { status: 400 })
    }

    // Verificar que el usuario sea miembro del espacio solicitado.
    const supabase = getSupabaseClient()
    const { data: membership, error } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', ctx.user.id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!membership) {
      return NextResponse.json({ error: 'No perteneces a este espacio' }, { status: 403 })
    }

    const response = NextResponse.json({ activeWorkspaceId: workspaceId })
    response.cookies.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })

    return response
  } catch (error) {
    console.error('POST /api/workspaces/active', error)
    return NextResponse.json({ error: 'Error al cambiar de espacio' }, { status: 500 })
  }
}
