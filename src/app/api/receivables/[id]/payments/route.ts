import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { mapReceivableRow } from '@/lib/receivables'
import { toDateOnly } from '@/lib/projects'
import { track } from '@/lib/analytics'

// Registrar un abono a una cuenta por cobrar.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para registrar abonos en este espacio' }, { status: 403 })
    }

    const body = await request.json()
    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'El monto del abono debe ser mayor a 0' }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    // La cuenta debe existir en el espacio activo
    const { data: receivable, error: rcvErr } = await supabase
      .from('receivables')
      .select('*')
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()
    if (rcvErr) throw rcvErr
    if (!receivable) {
      return NextResponse.json({ error: 'Cuenta por cobrar no encontrada' }, { status: 404 })
    }

    const date = toDateOnly(body.date) ?? new Date().toISOString().slice(0, 10)

    const { error: payErr } = await supabase.from('receivable_payments').insert({
      receivable_id: params.id,
      workspace_id: ctx.workspaceId,
      user_id: ctx.user.id,
      amount,
      date,
      method: typeof body.method === 'string' ? body.method.trim() || null : null,
      note: typeof body.note === 'string' ? body.note.trim() || null : null,
    })
    if (payErr) throw payErr

    // Recalcular saldo y marcar como pagada si llegó a 0
    const { data: payments } = await supabase
      .from('receivable_payments')
      .select('amount')
      .eq('receivable_id', params.id)
    const paid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0)
    const balance = Number(receivable.amount ?? 0) - paid

    if (balance <= 0 && receivable.status === 'open') {
      await supabase.from('receivables').update({ status: 'paid' }).eq('id', params.id)
      receivable.status = 'paid'
    }

    // Glue con "cuánto gano": registrar el abono también como ingreso del proyecto
    if (body.registerAsIncome && receivable.project_id) {
      const { data: incomeCat } = await supabase
        .from('categories')
        .select('id, name')
        .eq('workspace_id', ctx.workspaceId)
        .eq('type', 'income')
        .limit(1)
        .maybeSingle()

      await supabase.from('transactions').insert({
        workspace_id: ctx.workspaceId,
        user_id: ctx.user.id,
        project_id: receivable.project_id,
        type: 'income',
        category_id: incomeCat?.id ?? null,
        category_name: incomeCat?.name ?? 'Cobro',
        subcategory: null,
        description: `Abono de ${receivable.client}`,
        amount,
        date,
        payment_method: typeof body.method === 'string' && body.method ? body.method : 'cash',
        reference: null,
        attachments: [],
      })
    }

    await track('payment_created', {
      userId: ctx.user.id,
      workspaceId: ctx.workspaceId,
      props: { amount, settled: balance <= 0 },
    })

    return NextResponse.json(mapReceivableRow(receivable, paid), { status: 201 })
  } catch (error) {
    console.error(`POST /api/receivables/${params.id}/payments`, error)
    return NextResponse.json({ error: 'Error al registrar el abono' }, { status: 500 })
  }
}
