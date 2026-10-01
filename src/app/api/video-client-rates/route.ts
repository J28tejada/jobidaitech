import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { mapClientRateRow, isMissingSchema } from '@/lib/videos'

const MIGRATION_ERROR = { error: 'Falta correr la migración 0045 en Supabase' }

// Precios de video por cliente (módulo Videos). Cada cliente puede tener
// varios (ej. "Reel" 750, "Video largo" 1,500).
export async function GET() {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('videos')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })

    const supabase = getSupabaseClient()
    const [{ data: clients, error }, { data: rates, error: ratesError }] = await Promise.all([
      supabase.from('clients').select('id, name').eq('workspace_id', ctx.workspaceId).order('name', { ascending: true }),
      supabase
        .from('client_video_rates')
        .select('*')
        .eq('workspace_id', ctx.workspaceId)
        .order('created_at', { ascending: true }),
    ])
    if (error) throw error
    if (ratesError && !isMissingSchema(ratesError)) throw ratesError

    const byClient = new Map<string, ReturnType<typeof mapClientRateRow>[]>()
    ;(rates ?? []).forEach((r: any) => {
      const row = mapClientRateRow(r)
      const list = byClient.get(row.clientId) ?? []
      list.push(row)
      byClient.set(row.clientId, list)
    })

    return NextResponse.json(
      (clients ?? []).map((c: any) => ({ clientId: c.id, name: c.name ?? '', rates: byClient.get(c.id) ?? [] })),
    )
  } catch (error) {
    console.error('GET /api/video-client-rates', error)
    return NextResponse.json({ error: 'Error al obtener los precios' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('videos')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para editar precios' }, { status: 403 })
    }

    const body = await request.json()
    const clientId = typeof body.clientId === 'string' ? body.clientId : ''
    if (!clientId) return NextResponse.json({ error: 'Falta el cliente' }, { status: 400 })
    const rate = Number(body.rate)
    if (body.rate === '' || body.rate === null || !Number.isFinite(rate) || rate < 0) {
      return NextResponse.json({ error: 'Indica un precio válido' }, { status: 400 })
    }
    const label = typeof body.label === 'string' ? body.label.trim() : ''

    const supabase = getSupabaseClient()
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()
    if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    const { data, error } = await supabase
      .from('client_video_rates')
      .insert({ workspace_id: ctx.workspaceId, client_id: clientId, label, rate })
      .select()
      .single()
    if (error) {
      if (isMissingSchema(error)) return NextResponse.json(MIGRATION_ERROR, { status: 500 })
      throw error
    }
    return NextResponse.json(mapClientRateRow(data), { status: 201 })
  } catch (error) {
    console.error('POST /api/video-client-rates', error)
    return NextResponse.json({ error: 'Error al guardar el precio' }, { status: 500 })
  }
}
