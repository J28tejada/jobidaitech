import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { mapVideoRow } from '@/lib/videos'

// Vista pública de un reporte de videos por token (sin sesión). Solo lectura.
export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const supabase = getSupabaseClient()
    const { data: report, error } = await supabase
      .from('video_reports')
      .select('*')
      .eq('token', params.token)
      .maybeSingle()
    if (error) throw error
    if (!report) return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })

    // Videos del rango (y cliente si aplica) al momento de verlo.
    const query = supabase
      .from('videos')
      .select('*')
      .eq('workspace_id', report.workspace_id)
      .gte('video_date', report.date_from)
      .lte('video_date', report.date_to)
      .order('video_date', { ascending: true })
      .order('created_at', { ascending: true })
    if (report.client_id) query.eq('client_id', report.client_id)
    const { data: videos } = await query

    const { data: ws } = await supabase
      .from('workspaces')
      .select('name, currency, locale')
      .eq('id', report.workspace_id)
      .maybeSingle()

    const items = (videos ?? []).map(mapVideoRow)
    const liveTotal = items.reduce((sum, v) => sum + v.price, 0)

    return NextResponse.json({
      report: {
        title: report.title,
        clientName: report.client_name,
        dateFrom: report.date_from,
        dateTo: report.date_to,
        total: liveTotal,
        videoCount: items.length,
        createdAt: report.created_at,
        videos: items.map((v, i) => ({
          n: i + 1,
          videoDate: v.videoDate,
          videoRef: v.videoRef,
          topic: v.topic,
          recorderName: v.recorderName,
          price: v.price,
        })),
      },
      business: { name: ws?.name ?? 'Negocio' },
      currency: ws?.currency ?? 'DOP',
      locale: ws?.locale ?? 'es-DO',
    })
  } catch (error) {
    console.error(`GET /api/public/video-reports/${params.token}`, error)
    return NextResponse.json({ error: 'Error al cargar el reporte' }, { status: 500 })
  }
}
