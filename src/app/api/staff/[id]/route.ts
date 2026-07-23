import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { mapStaffRow } from '@/lib/staff'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('agenda')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 })

    const body = await request.json()
    const patch: Record<string, unknown> = {}
    if (typeof body.name === 'string') {
      const name = body.name.trim()
      if (!name) return NextResponse.json({ error: 'Indica el nombre' }, { status: 400 })
      patch.name = name
    }
    if (body.commissionPct !== undefined) {
      let pct = Number(body.commissionPct)
      if (!Number.isFinite(pct) || pct < 0) pct = 0
      if (pct > 100) pct = 100
      patch.commission_pct = pct
    }
    if (typeof body.active === 'boolean') patch.active = body.active
    if (body.phone !== undefined) patch.phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null
    if (body.email !== undefined) patch.email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null
    if (body.imageUrl !== undefined) patch.image_url = typeof body.imageUrl === 'string' && body.imageUrl.trim() ? body.imageUrl.trim() : null

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('staff')
      .update(patch)
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(mapStaffRow(data))
  } catch (error) {
    console.error('PUT /api/staff/[id]', error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('agenda')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 })

    const supabase = getSupabaseClient()
    const { error } = await supabase.from('staff').delete().eq('id', params.id).eq('workspace_id', ctx.workspaceId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/staff/[id]', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
