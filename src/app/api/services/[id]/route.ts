import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { mapServiceRow, normalizeVariants } from '@/lib/services'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('agenda')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para editar servicios' }, { status: 403 })
    }

    const body = await request.json()
    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) {
      const n = String(body.name).trim()
      if (!n) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
      updates.name = n
    }
    if (body.durationMin !== undefined) updates.duration_min = Math.max(1, Math.round(Number(body.durationMin) || 30))
    if (body.price !== undefined) updates.price = Number(body.price) || 0
    if (body.variants !== undefined) updates.variants = normalizeVariants(body.variants)
    if (body.active !== undefined) updates.active = !!body.active

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('services')
      .update(updates)
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .select()
      .maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })
    return NextResponse.json(mapServiceRow(data))
  } catch (error) {
    console.error(`PUT /api/services/${params.id}`, error)
    return NextResponse.json({ error: 'Error al actualizar el servicio' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('agenda')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para eliminar servicios' }, { status: 403 })
    }

    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
    if (error) throw error
    return NextResponse.json({ message: 'Servicio eliminado' })
  } catch (error) {
    console.error(`DELETE /api/services/${params.id}`, error)
    return NextResponse.json({ error: 'Error al eliminar el servicio' }, { status: 500 })
  }
}
