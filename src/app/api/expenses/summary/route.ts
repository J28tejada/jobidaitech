import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext } from '@/lib/workspaces'

// Resumen de gastos del mes en curso (para el KPI del dashboard).
export async function GET(request: Request) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // "Este mes" en la zona local del negocio (offset enviado por el cliente).
    const tzOffsetMin = Number(new URL(request.url).searchParams.get('tzOffset'))
    const offMs = (Number.isFinite(tzOffsetMin) ? tzOffsetMin : 0) * 60_000
    const shifted = new Date(Date.now() - offMs)
    const y = shifted.getUTCFullYear()
    const m = shifted.getUTCMonth()
    const pad = (n: number) => String(n).padStart(2, '0')
    const from = `${y}-${pad(m + 1)}-01`
    const to = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('expenses')
      .select('amount')
      .eq('workspace_id', ctx.workspaceId)
      .gte('date', from)
      .lte('date', to)
    if (error) throw error

    let monthTotal = 0
    let monthCount = 0
    for (const e of data ?? []) {
      monthTotal += Number(e.amount ?? 0)
      monthCount += 1
    }
    return NextResponse.json({ monthTotal: Number(monthTotal.toFixed(2)), monthCount })
  } catch (error) {
    console.error('GET /api/expenses/summary', error)
    return NextResponse.json({ error: 'Error al obtener el resumen' }, { status: 500 })
  }
}
