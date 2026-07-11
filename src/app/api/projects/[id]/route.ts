import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext, getWriteAccess } from '@/lib/workspaces'
import { mapProjectRow, toDateOnly } from '@/lib/projects'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    return NextResponse.json(mapProjectRow(data))
  } catch (error) {
    console.error(`GET /api/projects/${params.id}`, error)
    return NextResponse.json({ error: 'Error al obtener proyecto' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const access = getWriteAccess(ctx.role)
    if (!access.allowed) {
      return NextResponse.json({ error: 'No tienes permiso para editar en este espacio' }, { status: 403 })
    }

    const body = await request.json()

    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description
    if (body.client !== undefined) updates.client = body.client
    if (body.status !== undefined) updates.status = body.status
    if (body.budget !== undefined) updates.budget = Number(body.budget)
    if (body.initialPayment !== undefined) updates.initial_payment = body.initialPayment ? Number(body.initialPayment) : null
    if (body.startDate !== undefined) updates.start_date = toDateOnly(body.startDate)
    if (body.endDate !== undefined) updates.end_date = toDateOnly(body.endDate)
    updates.updated_at = new Date().toISOString()

    const supabase = getSupabaseClient()
    const query = supabase
      .from('projects')
      .update(updates)
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)

    // 'member' solo puede editar lo que él creó
    if (access.ownOnly) {
      query.eq('user_id', ctx.user.id)
    }

    const { data, error } = await query.select().maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: 'Proyecto no encontrado o sin permiso' }, { status: 404 })
    }

    return NextResponse.json(mapProjectRow(data))
  } catch (error) {
    console.error(`PUT /api/projects/${params.id}`, error)
    return NextResponse.json({ error: 'Error al actualizar proyecto' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const access = getWriteAccess(ctx.role)
    if (!access.allowed) {
      return NextResponse.json({ error: 'No tienes permiso para eliminar en este espacio' }, { status: 403 })
    }

    const supabase = getSupabaseClient()
    const query = supabase
      .from('projects')
      .delete()
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)

    if (access.ownOnly) {
      query.eq('user_id', ctx.user.id)
    }

    const { error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({ message: 'Proyecto eliminado correctamente' })
  } catch (error) {
    console.error(`DELETE /api/projects/${params.id}`, error)
    return NextResponse.json({ error: 'Error al eliminar proyecto' }, { status: 500 })
  }
}
