import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { mapRecorderRow } from '@/lib/videos'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('videos')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 })
    }

    const body = await request.json()
    const patch: Record<string, unknown> = {}
    if (typeof body.name === 'string') {
      const name = body.name.trim()
      if (!name) return NextResponse.json({ error: 'Indica el nombre' }, { status: 400 })
      patch.name = name
    }
    if (body.rate !== undefined) {
      const rate = Number(body.rate)
      patch.rate = Number.isFinite(rate) ? rate : 0
    }
    if (typeof body.active === 'boolean') patch.active = body.active

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('video_recorders')
      .update(patch)
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(mapRecorderRow(data))
  } catch (error) {
    console.error('PUT /api/video-recorders/[id]', error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('videos')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 })
    }

    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('video_recorders')
      .delete()
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/video-recorders/[id]', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
