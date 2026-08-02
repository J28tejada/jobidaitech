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
    // Incluye los videos de ESE cliente Y los que no tienen cliente asignado
    // (se consideran del cliente al que se factura). Así no se pierden videos
    // sin etiquetar al generar la factura para un cliente.
    if (report.client_id) query.or(`client_id.eq.${report.client_id},client_id.is.null`)
    const { data: videos } = await query

    // select('*') para tolerar la migración 0043 (invoice_*) aún no corrida.
    const { data: ws } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', report.workspace_id)
      .maybeSingle()

    // Logo del cliente (si el reporte es para un cliente con ficha).
    let clientLogoUrl: string | null = null
    if (report.client_id) {
      const { data: cli } = await supabase
        .from('clients')
        .select('logo_url')
        .eq('id', report.client_id)
        .maybeSingle()
      clientLogoUrl = (cli as { logo_url?: string | null } | null)?.logo_url ?? null
    }

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
      // Emisor de la factura (datos configurables en Ajustes).
      issuer: {
        name: ws?.invoice_name || ws?.name || 'Negocio',
        logoUrl: ws?.invoice_logo_url ?? null,
        taxId: ws?.invoice_tax_id ?? null,
        phone: ws?.invoice_phone ?? null,
        email: ws?.invoice_email ?? null,
        address: ws?.invoice_address ?? null,
      },
      client: { name: report.client_name ?? null, logoUrl: clientLogoUrl },
      currency: ws?.currency ?? 'DOP',
      locale: ws?.locale ?? 'es-DO',
    })
  } catch (error) {
    console.error(`GET /api/public/video-reports/${params.token}`, error)
    return NextResponse.json({ error: 'Error al cargar el reporte' }, { status: 500 })
  }
}
