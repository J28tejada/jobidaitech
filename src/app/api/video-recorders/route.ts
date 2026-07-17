import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { mapRecorderRow } from '@/lib/videos'

export async function GET() {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('videos')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('video_recorders')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return NextResponse.json((data ?? []).map(mapRecorderRow))
  } catch (error) {
    console.error('GET /api/video-recorders', error)
    return NextResponse.json({ error: 'Error al obtener camarógrafos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('videos')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para editar camarógrafos' }, { status: 403 })
    }

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'Indica el nombre' }, { status: 400 })
    const rate = Number(body.rate)

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('video_recorders')
      .insert({
        workspace_id: ctx.workspaceId,
        user_id: ctx.user.id,
        name,
        rate: Number.isFinite(rate) ? rate : 0,
      })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(mapRecorderRow(data), { status: 201 })
  } catch (error) {
    console.error('POST /api/video-recorders', error)
    return NextResponse.json({ error: 'Error al crear el camarógrafo' }, { status: 500 })
  }
}
