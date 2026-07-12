import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  ACTIVE_WORKSPACE_COOKIE,
  canManageWorkspace,
  getMembershipRole,
  getWorkspaceContext,
  READ_ONLY_ERROR,
} from '@/lib/workspaces'

// Renombrar el negocio (admin o dueño)
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  if (!ctx.canWrite) {
    return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
  }

  const role = await getMembershipRole(ctx.user.id, params.id)
  if (!role || !canManageWorkspace(role)) {
    return NextResponse.json({ error: 'No tienes permiso para editar este negocio' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    const { data: workspace } = await supabase
      .from('workspaces')
      .select('type')
      .eq('id', params.id)
      .maybeSingle()

    if (workspace?.type === 'personal') {
      return NextResponse.json({ error: 'No se puede renombrar el espacio personal' }, { status: 400 })
    }

    const { error } = await supabase.from('workspaces').update({ name }).eq('id', params.id)
    if (error) throw error

    return NextResponse.json({ success: true, name })
  } catch (error) {
    console.error('PATCH /api/workspaces/[id]', error)
    return NextResponse.json({ error: 'Error al actualizar el negocio' }, { status: 500 })
  }
}

// Eliminar el negocio (solo dueño). Borra en cascada sus datos.
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  if (!ctx.canWrite) {
    return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
  }

  const role = await getMembershipRole(ctx.user.id, params.id)
  if (role !== 'owner') {
    return NextResponse.json({ error: 'Solo el Dueño puede eliminar el negocio' }, { status: 403 })
  }

  const supabase = getSupabaseClient()

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('type')
    .eq('id', params.id)
    .maybeSingle()

  if (workspace?.type === 'personal') {
    return NextResponse.json({ error: 'No se puede eliminar el espacio personal' }, { status: 400 })
  }

  const { error } = await supabase.from('workspaces').delete().eq('id', params.id)
  if (error) {
    console.error('DELETE /api/workspaces/[id]', error)
    return NextResponse.json({ error: 'No se pudo eliminar el negocio' }, { status: 500 })
  }

  // Volver al espacio personal
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
