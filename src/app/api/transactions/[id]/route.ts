import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext, getWriteAccess } from '@/lib/workspaces'
import { mapTransactionRow } from '@/lib/transactions'
import { toDateOnly } from '@/lib/projects'

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
    const getQuery = supabase
      .from('transactions')
      .select('*')
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)

    if (ctx.allowedProjectIds) {
      getQuery.in('project_id', ctx.allowedProjectIds)
    }

    const { data, error } = await getQuery.maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: 'Transacción no encontrada' }, { status: 404 })
    }

    return NextResponse.json(mapTransactionRow(data))
  } catch (error) {
    console.error(`GET /api/transactions/${params.id}`, error)
    return NextResponse.json({ error: 'Error al obtener transacción' }, { status: 500 })
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
    const supabase = getSupabaseClient()

    const updates: Record<string, unknown> = {}

    if (body.projectId !== undefined) {
      if (ctx.allowedProjectIds && !ctx.allowedProjectIds.includes(body.projectId)) {
        return NextResponse.json({ error: 'No tienes acceso a ese proyecto' }, { status: 403 })
      }

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id')
        .eq('id', body.projectId)
        .eq('workspace_id', ctx.workspaceId)
        .maybeSingle()

      if (projectError) {
        throw projectError
      }

      if (!project) {
        return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
      }

      updates.project_id = body.projectId
    }

    if (body.type !== undefined) {
      updates.type = body.type
    }

    if (body.category !== undefined) {
      const { data: categoryRow } = await supabase
        .from('categories')
        .select('id, name, type')
        .eq('workspace_id', ctx.workspaceId)
        .eq('name', body.category)
        .eq('type', body.type ?? updates.type)
        .maybeSingle()

      updates.category_id = categoryRow?.id ?? null
      updates.category_name = body.category
    }

    if (body.subcategory !== undefined) updates.subcategory = body.subcategory ?? null
    if (body.description !== undefined) updates.description = body.description
    if (body.amount !== undefined) updates.amount = Number(body.amount)
    if (body.date !== undefined) updates.date = toDateOnly(body.date)
    if (body.paymentMethod !== undefined) updates.payment_method = body.paymentMethod
    if (body.reference !== undefined) updates.reference = body.reference ?? null
    if (body.attachments !== undefined) {
      updates.attachments = Array.isArray(body.attachments) ? body.attachments : []
    }
    updates.updated_at = new Date().toISOString()

    const updateQuery = supabase
      .from('transactions')
      .update(updates)
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)

    if (access.ownOnly) {
      updateQuery.eq('user_id', ctx.user.id)
    }

    if (ctx.allowedProjectIds) {
      updateQuery.in('project_id', ctx.allowedProjectIds)
    }

    const { data, error } = await updateQuery.select().maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: 'Transacción no encontrada o sin permiso' }, { status: 404 })
    }

    return NextResponse.json(mapTransactionRow(data))
  } catch (error) {
    console.error(`PUT /api/transactions/${params.id}`, error)
    return NextResponse.json({ error: 'Error al actualizar transacción' }, { status: 500 })
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
    const deleteQuery = supabase
      .from('transactions')
      .delete()
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)

    if (access.ownOnly) {
      deleteQuery.eq('user_id', ctx.user.id)
    }

    if (ctx.allowedProjectIds) {
      deleteQuery.in('project_id', ctx.allowedProjectIds)
    }

    const { error } = await deleteQuery

    if (error) {
      throw error
    }

    return NextResponse.json({ message: 'Transacción eliminada correctamente' })
  } catch (error) {
    console.error(`DELETE /api/transactions/${params.id}`, error)
    return NextResponse.json({ error: 'Error al eliminar transacción' }, { status: 500 })
  }
}
