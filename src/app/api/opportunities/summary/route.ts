import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext, MODULE_LOCKED_ERROR } from '@/lib/workspaces'
import { OPEN_STAGES } from '@/lib/opportunities'

// Resumen del embudo: valor/conteo por etapa + seguimientos pendientes.
export async function GET() {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('crm')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('opportunities')
      .select('stage, value, next_action_date')
      .eq('workspace_id', ctx.workspaceId)
    if (error) throw error

    const today = new Date().toISOString().slice(0, 10)
    const byStage: Record<string, { count: number; value: number }> = {}
    let openValue = 0
    let openCount = 0
    let followUpsDue = 0

    for (const o of data ?? []) {
      const stage = o.stage as string
      const value = Number(o.value ?? 0)
      byStage[stage] = byStage[stage] ?? { count: 0, value: 0 }
      byStage[stage].count += 1
      byStage[stage].value += value
      if (OPEN_STAGES.includes(stage as any)) {
        openValue += value
        openCount += 1
        if (o.next_action_date && o.next_action_date <= today) followUpsDue += 1
      }
    }

    return NextResponse.json({
      byStage,
      openValue: Number(openValue.toFixed(2)),
      openCount,
      followUpsDue,
    })
  } catch (error) {
    console.error('GET /api/opportunities/summary', error)
    return NextResponse.json({ error: 'Error al obtener el resumen' }, { status: 500 })
  }
}
