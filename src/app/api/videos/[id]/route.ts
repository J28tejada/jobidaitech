import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { mapVideoRow } from '@/lib/videos'

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
    const supabase = getSupabaseClient()
    const patch: Record<string, unknown> = {}

    if (typeof body.videoRef === 'string') patch.video_ref = body.videoRef.trim() || null
    if (typeof body.topic === 'string') patch.topic = body.topic.trim()
    if (typeof body.videoDate === 'string' && body.videoDate) patch.video_date = body.videoDate
    if (typeof body.notes === 'string') patch.notes = body.notes.trim() || null
    if (body.price !== undefined) {
      const price = Number(body.price)
      patch.price = Number.isFinite(price) ? price : 0
    }
    if (body.recorderId !== undefined) {
      if (body.recorderId) {
        const { data: rec } = await supabase
          .from('video_recorders')
          .select('id, name, rate')
          .eq('id', body.recorderId)
          .eq('workspace_id', ctx.workspaceId)
          .maybeSingle()
        if (rec) {
          patch.recorder_id = rec.id
          patch.recorder_name = rec.name
          // Si no mandan precio explícito y no lo tenían, usa la tarifa.
          if (body.price === undefined) patch.price = Number(rec.rate)
        }
      } else {
        patch.recorder_id = null
      }
    }
    if (body.recorderName !== undefined && typeof body.recorderName === 'string') {
      patch.recorder_name = body.recorderName.trim()
    }
    if (body.clientId !== undefined) {
      if (body.clientId) {
        const { data: client } = await supabase
          .from('clients')
          .select('id')
          .eq('id', body.clientId)
          .eq('workspace_id', ctx.workspaceId)
          .maybeSingle()
        patch.client_id = client ? client.id : null
      } else {
        patch.client_id = null
      }
    }

    const { data, error } = await supabase
      .from('videos')
      .update(patch)
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(mapVideoRow(data))
  } catch (error) {
    console.error('PUT /api/videos/[id]', error)
    return NextResponse.json({ error: 'Error al actualizar el video' }, { status: 500 })
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
      .from('videos')
      .delete()
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/videos/[id]', error)
    return NextResponse.json({ error: 'Error al eliminar el video' }, { status: 500 })
  }
}
