import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getMembershipRole, getWorkspaceContext } from '@/lib/workspaces'

// Transferir la propiedad del negocio a otro miembro (solo el dueño actual).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const role = await getMembershipRole(ctx.user.id, params.id)
  if (role !== 'owner') {
    return NextResponse.json({ error: 'Solo el Dueño puede transferir la propiedad' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const memberId = typeof body.memberId === 'string' ? body.memberId : ''
    if (!memberId) {
      return NextResponse.json({ error: 'Falta el miembro destino' }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    // El miembro destino debe pertenecer al negocio
    const { data: target } = await supabase
      .from('workspace_members')
      .select('id, user_id')
      .eq('id', memberId)
      .eq('workspace_id', params.id)
      .maybeSingle()

    if (!target) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    }

    // Nuevo dueño
    await supabase.from('workspace_members').update({ role: 'owner', scope: 'all' }).eq('id', target.id)
    // El dueño anterior queda como admin
    await supabase
      .from('workspace_members')
      .update({ role: 'admin' })
      .eq('workspace_id', params.id)
      .eq('user_id', ctx.user.id)
    // Actualizar owner_id del negocio
    await supabase.from('workspaces').update({ owner_id: target.user_id }).eq('id', params.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/workspaces/[id]/transfer', error)
    return NextResponse.json({ error: 'Error al transferir la propiedad' }, { status: 500 })
  }
}
