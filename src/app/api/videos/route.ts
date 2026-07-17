import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { mapVideoRow } from '@/lib/videos'
import { track } from '@/lib/analytics'

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export async function GET(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('videos')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    // Por defecto: mes en curso.
    const now = new Date()
    const from = searchParams.get('from') || ymd(new Date(now.getFullYear(), now.getMonth(), 1))
    const to = searchParams.get('to') || ymd(now)

    const supabase = getSupabaseClient()
    const query = supabase
      .from('videos')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .gte('video_date', from)
      .lte('video_date', to)
      .order('video_date', { ascending: true })
      .order('created_at', { ascending: true })
    if (clientId) query.eq('client_id', clientId)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json((data ?? []).map(mapVideoRow))
  } catch (error) {
    console.error('GET /api/videos', error)
    return NextResponse.json({ error: 'Error al obtener videos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('videos')) {
      await track('paywall_hit', { userId: ctx.user.id, workspaceId: ctx.workspaceId, props: { module: 'videos' } })
      return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    }
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para registrar videos' }, { status: 403 })
    }

    const body = await request.json()
    const supabase = getSupabaseClient()

    // Fecha (por defecto hoy)
    const videoDate = typeof body.videoDate === 'string' && body.videoDate ? body.videoDate : ymd(new Date())

    // Camarógrafo → snapshot del nombre y tarifa por defecto
    let recorderId: string | null = null
    let recorderName = typeof body.recorderName === 'string' ? body.recorderName.trim() : ''
    let price = Number(body.price)
    if (body.recorderId) {
      const { data: rec } = await supabase
        .from('video_recorders')
        .select('id, name, rate')
        .eq('id', body.recorderId)
        .eq('workspace_id', ctx.workspaceId)
        .maybeSingle()
      if (rec) {
        recorderId = rec.id
        recorderName = rec.name
        if (!Number.isFinite(price)) price = Number(rec.rate)
      }
    }
    if (!Number.isFinite(price)) price = 0

    // Cliente (opcional)
    let clientId: string | null = null
    if (body.clientId) {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('id', body.clientId)
        .eq('workspace_id', ctx.workspaceId)
        .maybeSingle()
      if (client) clientId = client.id
    }

    const { data, error } = await supabase
      .from('videos')
      .insert({
        workspace_id: ctx.workspaceId,
        user_id: ctx.user.id,
        client_id: clientId,
        recorder_id: recorderId,
        recorder_name: recorderName,
        video_ref: typeof body.videoRef === 'string' ? body.videoRef.trim() || null : null,
        topic: typeof body.topic === 'string' ? body.topic.trim() : '',
        video_date: videoDate,
        price,
        notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
      })
      .select()
      .single()
    if (error) throw error

    await track('video_created', { userId: ctx.user.id, workspaceId: ctx.workspaceId })
    return NextResponse.json(mapVideoRow(data), { status: 201 })
  } catch (error) {
    console.error('POST /api/videos', error)
    return NextResponse.json({ error: 'Error al registrar el video' }, { status: 500 })
  }
}
