import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext, MODULE_LOCKED_ERROR } from '@/lib/workspaces'

// Totales del módulo de Cobros para el KPI del panel y el encabezado de /cobros.
export async function GET() {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!ctx.hasModule('receivables')) {
      return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    }

    const supabase = getSupabaseClient()
    const { data: rows, error } = await supabase
      .from('receivables')
      .select('id, project_id, amount, due_date, status')
      .eq('workspace_id', ctx.workspaceId)
      .eq('status', 'open')
    if (error) throw error

    let open = rows ?? []
    if (ctx.allowedProjectIds) {
      const allowed = new Set(ctx.allowedProjectIds)
      open = open.filter(r => !r.project_id || allowed.has(r.project_id))
    }

    const ids = open.map(r => r.id)
    const paidByReceivable: Record<string, number> = {}
    if (ids.length > 0) {
      const { data: payments, error: payErr } = await supabase
        .from('receivable_payments')
        .select('receivable_id, amount')
        .in('receivable_id', ids)
      if (payErr) throw payErr
      for (const p of payments ?? []) {
        paidByReceivable[p.receivable_id] = (paidByReceivable[p.receivable_id] ?? 0) + Number(p.amount ?? 0)
      }
    }

    const today = new Date().toISOString().slice(0, 10)
    let totalOutstanding = 0
    let overdueAmount = 0
    let overdueCount = 0
    let openCount = 0

    for (const r of open) {
      const balance = Math.max(0, Number(r.amount ?? 0) - (paidByReceivable[r.id] ?? 0))
      if (balance <= 0) continue
      totalOutstanding += balance
      openCount += 1
      if (r.due_date && r.due_date < today) {
        overdueAmount += balance
        overdueCount += 1
      }
    }

    return NextResponse.json({
      totalOutstanding: Number(totalOutstanding.toFixed(2)),
      overdueAmount: Number(overdueAmount.toFixed(2)),
      overdueCount,
      openCount,
    })
  } catch (error) {
    console.error('GET /api/receivables/summary', error)
    return NextResponse.json({ error: 'Error al obtener el resumen de cobros' }, { status: 500 })
  }
}
