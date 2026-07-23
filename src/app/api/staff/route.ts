import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { mapStaffRow } from '@/lib/staff'

export async function GET() {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('agenda')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return NextResponse.json((data ?? []).map(mapStaffRow))
  } catch (error) {
    console.error('GET /api/staff', error)
    return NextResponse.json({ error: 'Error al obtener barberos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('agenda')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 })
    }

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'Indica el nombre' }, { status: 400 })
    let commissionPct = Number(body.commissionPct)
    if (!Number.isFinite(commissionPct) || commissionPct < 0) commissionPct = 0
    if (commissionPct > 100) commissionPct = 100
    const phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null
    const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null
    const imageUrl = typeof body.imageUrl === 'string' && body.imageUrl.trim() ? body.imageUrl.trim() : null

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('staff')
      .insert({ workspace_id: ctx.workspaceId, user_id: ctx.user.id, name, commission_pct: commissionPct, phone, email, image_url: imageUrl })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(mapStaffRow(data), { status: 201 })
  } catch (error) {
    console.error('POST /api/staff', error)
    return NextResponse.json({ error: 'Error al crear el barbero' }, { status: 500 })
  }
}
