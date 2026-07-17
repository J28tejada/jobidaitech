import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { track } from '@/lib/analytics'

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const isYmd = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

interface IncomingRow {
  videoDate?: string
  videoRef?: string
  topic?: string
  recorderName?: string
  price?: number | string
}

// Importación masiva de videos (desde Excel/CSV parseado en el cliente).
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
      return NextResponse.json({ error: 'No tienes permiso para importar videos' }, { status: 403 })
    }

    const body = await request.json()
    const rows: IncomingRow[] = Array.isArray(body.rows) ? body.rows : []
    if (rows.length === 0) return NextResponse.json({ error: 'No hay filas para importar' }, { status: 400 })
    if (rows.length > 2000) return NextResponse.json({ error: 'Máximo 2000 filas por importación' }, { status: 400 })

    const supabase = getSupabaseClient()

    // Cliente opcional (se aplica a todas las filas).
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

    // Camarógrafos existentes: mapa nombre(normalizado) -> {id, rate}.
    const { data: recorders } = await supabase
      .from('video_recorders')
      .select('id, name, rate')
      .eq('workspace_id', ctx.workspaceId)
    const recorderMap = new Map<string, { id: string; rate: number }>()
    for (const r of recorders ?? []) {
      recorderMap.set(String(r.name).trim().toLowerCase(), { id: r.id, rate: Number(r.rate ?? 0) })
    }

    const today = ymd(new Date())
    const payload = []
    for (const row of rows) {
      const recorderName = typeof row.recorderName === 'string' ? row.recorderName.trim() : ''
      const topic = typeof row.topic === 'string' ? row.topic.trim() : ''
      const videoRef = typeof row.videoRef === 'string' ? row.videoRef.trim() : ''
      // Saltar filas totalmente vacías.
      if (!recorderName && !topic && !videoRef && row.price === undefined && !isYmd(row.videoDate)) continue

      const matched = recorderName ? recorderMap.get(recorderName.toLowerCase()) : undefined
      let price = Number(row.price)
      if (!Number.isFinite(price)) price = matched ? matched.rate : 0

      payload.push({
        workspace_id: ctx.workspaceId,
        user_id: ctx.user.id,
        client_id: clientId,
        recorder_id: matched ? matched.id : null,
        recorder_name: recorderName,
        video_ref: videoRef || null,
        topic,
        video_date: isYmd(row.videoDate) ? row.videoDate : today,
        price,
      })
    }

    if (payload.length === 0) return NextResponse.json({ error: 'No hay filas válidas para importar' }, { status: 400 })

    // Insertar en lotes para no exceder límites.
    let inserted = 0
    for (let i = 0; i < payload.length; i += 500) {
      const chunk = payload.slice(i, i + 500)
      const { error, count } = await supabase.from('videos').insert(chunk, { count: 'exact' })
      if (error) throw error
      inserted += count ?? chunk.length
    }

    await track('videos_imported', { userId: ctx.user.id, workspaceId: ctx.workspaceId, props: { count: inserted } })
    return NextResponse.json({ inserted })
  } catch (error) {
    console.error('POST /api/videos/import', error)
    return NextResponse.json({ error: 'Error al importar los videos' }, { status: 500 })
  }
}
