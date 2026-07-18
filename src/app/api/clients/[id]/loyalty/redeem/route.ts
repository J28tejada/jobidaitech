import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext, getWriteAccess, READ_ONLY_ERROR } from '@/lib/workspaces'

// Canjea la recompensa: reinicia la tarjeta (guarda el nº de visitas actual).
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 })

    const supabase = getSupabaseClient()
    const { count } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId)
      .eq('client_id', params.id)
      .eq('status', 'done')

    const { error } = await supabase
      .from('clients')
      .update({ loyalty_redeemed_count: count ?? 0 })
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/clients/[id]/loyalty/redeem', error)
    return NextResponse.json({ error: 'Error al canjear' }, { status: 500 })
  }
}
