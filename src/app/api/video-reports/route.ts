import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { mapReportRow } from '@/lib/videos'
import { track } from '@/lib/analytics'

export async function GET() {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('videos')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('video_reports')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return NextResponse.json((data ?? []).map(mapReportRow))
  } catch (error) {
    console.error('GET /api/video-reports', error)
    return NextResponse.json({ error: 'Error al obtener reportes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('videos')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para generar reportes' }, { status: 403 })
    }

    const body = await request.json()
    const from = typeof body.from === 'string' ? body.from : ''
    const to = typeof body.to === 'string' ? body.to : ''
    if (!from || !to) return NextResponse.json({ error: 'Indica el rango de fechas' }, { status: 400 })

    const supabase = getSupabaseClient()

    // Cliente (opcional): resuelve el nombre desde la ficha si viene el id.
    let clientId: string | null = null
    let clientName = typeof body.clientName === 'string' ? body.clientName.trim() : ''
    if (body.clientId) {
      const { data: client } = await supabase
        .from('clients')
        .select('id, name')
        .eq('id', body.clientId)
        .eq('workspace_id', ctx.workspaceId)
        .maybeSingle()
      if (client) {
        clientId = client.id
        clientName = client.name
      }
    }

    // Total y conteo del rango (snapshot).
    const videoQuery = supabase
      .from('videos')
      .select('price')
      .eq('workspace_id', ctx.workspaceId)
      .gte('video_date', from)
      .lte('video_date', to)
    // Incluye videos del cliente Y los sin cliente asignado (se consideran del
    // cliente al que se factura). Debe coincidir con la consulta pública.
    if (clientId) videoQuery.or(`client_id.eq.${clientId},client_id.is.null`)
    const { data: vids, error: vErr } = await videoQuery
    if (vErr) throw vErr
    const rows = vids ?? []
    const total = rows.reduce((sum, r) => sum + Number(r.price ?? 0), 0)

    const { data, error } = await supabase
      .from('video_reports')
      .insert({
        workspace_id: ctx.workspaceId,
        user_id: ctx.user.id,
        client_id: clientId,
        client_name: clientName,
        title: typeof body.title === 'string' ? body.title.trim() || null : null,
        date_from: from,
        date_to: to,
        total,
        video_count: rows.length,
      })
      .select()
      .single()
    if (error) throw error

    await track('video_report_created', { userId: ctx.user.id, workspaceId: ctx.workspaceId })
    return NextResponse.json(mapReportRow(data), { status: 201 })
  } catch (error) {
    console.error('POST /api/video-reports', error)
    return NextResponse.json({ error: 'Error al generar el reporte' }, { status: 500 })
  }
}
