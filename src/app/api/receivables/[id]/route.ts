import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { mapReceivableRow, mapPaymentRow } from '@/lib/receivables'
import { toDateOnly } from '@/lib/projects'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!ctx.hasModule('receivables')) {
      return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('receivables')
      .select('*')
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()
    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: 'Cuenta por cobrar no encontrada' }, { status: 404 })
    }
    if (ctx.allowedProjectIds && data.project_id && !ctx.allowedProjectIds.includes(data.project_id)) {
      return NextResponse.json({ error: 'Cuenta por cobrar no encontrada' }, { status: 404 })
    }

    const { data: payments } = await supabase
      .from('receivable_payments')
      .select('*')
      .eq('receivable_id', params.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    const paid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0)
    return NextResponse.json({
      ...mapReceivableRow(data, paid),
      payments: (payments ?? []).map(mapPaymentRow),
    })
  } catch (error) {
    console.error(`GET /api/receivables/${params.id}`, error)
    return NextResponse.json({ error: 'Error al obtener la cuenta por cobrar' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!ctx.hasModule('receivables')) {
      return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    }
    if (!ctx.canWrite) {
      return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    }
    const access = getWriteAccess(ctx.role)
    if (!access.allowed) {
      return NextResponse.json({ error: 'No tienes permiso para editar en este espacio' }, { status: 403 })
    }

    const body = await request.json()
    const updates: Record<string, unknown> = {}
    if (body.client !== undefined) updates.client = String(body.client).trim()
    if (body.clientPhone !== undefined) updates.client_phone = body.clientPhone ? String(body.clientPhone).trim() : null
    if (body.description !== undefined) updates.description = body.description ? String(body.description).trim() : null
    if (body.amount !== undefined) updates.amount = Number(body.amount)
    if (body.dueDate !== undefined) updates.due_date = toDateOnly(body.dueDate)
    if (body.status !== undefined && ['open', 'paid', 'cancelled'].includes(body.status)) {
      updates.status = body.status
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    const supabase = getSupabaseClient()
    const query = supabase
      .from('receivables')
      .update(updates)
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
    if (access.ownOnly) query.eq('user_id', ctx.user.id)

    const { data, error } = await query.select().maybeSingle()
    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: 'Cuenta por cobrar no encontrada o sin permiso' }, { status: 404 })
    }

    const { data: payments } = await supabase
      .from('receivable_payments')
      .select('amount')
      .eq('receivable_id', params.id)
    const paid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0)

    return NextResponse.json(mapReceivableRow(data, paid))
  } catch (error) {
    console.error(`PUT /api/receivables/${params.id}`, error)
    return NextResponse.json({ error: 'Error al actualizar la cuenta por cobrar' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!ctx.hasModule('receivables')) {
      return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    }
    if (!ctx.canWrite) {
      return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    }
    const access = getWriteAccess(ctx.role)
    if (!access.allowed) {
      return NextResponse.json({ error: 'No tienes permiso para eliminar en este espacio' }, { status: 403 })
    }

    const supabase = getSupabaseClient()
    const query = supabase
      .from('receivables')
      .delete()
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
    if (access.ownOnly) query.eq('user_id', ctx.user.id)

    const { error } = await query
    if (error) throw error

    return NextResponse.json({ message: 'Cuenta por cobrar eliminada correctamente' })
  } catch (error) {
    console.error(`DELETE /api/receivables/${params.id}`, error)
    return NextResponse.json({ error: 'Error al eliminar la cuenta por cobrar' }, { status: 500 })
  }
}
