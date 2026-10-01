import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'

// Precio por video de cada cliente (módulo Videos). NULL = sin precio propio.
const mapRate = (row: any) => ({
  clientId: row.id,
  name: row.name ?? '',
  rate: row.video_rate === null || row.video_rate === undefined ? null : Number(row.video_rate),
})

export async function GET() {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('videos')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .order('name', { ascending: true })
    if (error) throw error
    return NextResponse.json((data ?? []).map(mapRate))
  } catch (error) {
    console.error('GET /api/video-client-rates', error)
    return NextResponse.json({ error: 'Error al obtener los precios' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
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

    let rate: number | null = null
    if (body.rate !== null && body.rate !== undefined && body.rate !== '') {
      const n = Number(body.rate)
      if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: 'Precio inválido' }, { status: 400 })
      rate = n
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('clients')
      .update({ video_rate: rate })
      .eq('id', clientId)
      .eq('workspace_id', ctx.workspaceId)
      .select()
      .maybeSingle()
    if (error) {
      if (error.code === '42703' || /video_rate/.test(error.message ?? '')) {
        return NextResponse.json({ error: 'Falta correr la migración 0044 en Supabase' }, { status: 500 })
      }
      throw error
    }
    if (!data) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    return NextResponse.json(mapRate(data))
  } catch (error) {
    console.error('PUT /api/video-client-rates', error)
    return NextResponse.json({ error: 'Error al guardar el precio' }, { status: 500 })
  }
}
