import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { mapServiceRow, normalizeVariants } from '@/lib/services'
import { track } from '@/lib/analytics'

export async function GET() {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('agenda')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .order('name', { ascending: true })
    if (error) throw error
    return NextResponse.json((data ?? []).map(mapServiceRow))
  } catch (error) {
    console.error('GET /api/services', error)
    return NextResponse.json({ error: 'Error al obtener servicios' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('agenda')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para registrar servicios' }, { status: 403 })
    }

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'El nombre del servicio es obligatorio' }, { status: 400 })

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('services')
      .insert({
        workspace_id: ctx.workspaceId,
        user_id: ctx.user.id,
        name,
        duration_min: Number.isFinite(Number(body.durationMin)) ? Math.max(1, Math.round(Number(body.durationMin))) : 30,
        price: Number.isFinite(Number(body.price)) ? Number(body.price) : 0,
        variants: normalizeVariants(body.variants),
        image_url: typeof body.imageUrl === 'string' && body.imageUrl.trim() ? body.imageUrl.trim() : null,
        active: true,
      })
      .select()
      .single()
    if (error) throw error

    await track('service_created', { userId: ctx.user.id, workspaceId: ctx.workspaceId })
    return NextResponse.json(mapServiceRow(data), { status: 201 })
  } catch (error) {
    console.error('POST /api/services', error)
    return NextResponse.json({ error: 'Error al crear el servicio' }, { status: 500 })
  }
}
