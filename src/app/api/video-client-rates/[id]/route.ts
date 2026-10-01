import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { mapClientRateRow } from '@/lib/videos'

async function guard() {
  const ctx = await getWorkspaceContext()
  if (!ctx) return { res: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  if (!ctx.hasModule('videos')) return { res: NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 }) }
  if (!ctx.canWrite) return { res: NextResponse.json(READ_ONLY_ERROR, { status: 403 }) }
  if (!getWriteAccess(ctx.role).allowed) {
    return { res: NextResponse.json({ error: 'No tienes permiso para editar precios' }, { status: 403 }) }
  }
  return { ctx }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { ctx, res } = await guard()
    if (!ctx) return res

    const body = await request.json()
    const patch: Record<string, unknown> = {}
    if (typeof body.label === 'string') patch.label = body.label.trim()
    if (body.rate !== undefined) {
      const rate = Number(body.rate)
      if (body.rate === '' || body.rate === null || !Number.isFinite(rate) || rate < 0) {
        return NextResponse.json({ error: 'Indica un precio válido' }, { status: 400 })
      }
      patch.rate = rate
    }
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('client_video_rates')
      .update(patch)
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .select()
      .maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Precio no encontrado' }, { status: 404 })
    return NextResponse.json(mapClientRateRow(data))
  } catch (error) {
    console.error('PUT /api/video-client-rates/[id]', error)
    return NextResponse.json({ error: 'Error al guardar el precio' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { ctx, res } = await guard()
    if (!ctx) return res

    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('client_video_rates')
      .delete()
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/video-client-rates/[id]', error)
    return NextResponse.json({ error: 'Error al eliminar el precio' }, { status: 500 })
  }
}
