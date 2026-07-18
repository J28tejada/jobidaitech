import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext, MODULE_LOCKED_ERROR } from '@/lib/workspaces'

// Resumen de la agenda: citas de hoy, próximas 7 días e ingreso estimado de hoy.
export async function GET() {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('agenda')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })

    const now = new Date()
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endToday = new Date(startToday.getTime() + 86_400_000)
    const in7 = new Date(startToday.getTime() + 7 * 86_400_000)
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const supabase = getSupabaseClient()
    const [{ data, error }, { data: monthData, error: monthErr }] = await Promise.all([
      supabase
        .from('appointments')
        .select('starts_at, price, status')
        .eq('workspace_id', ctx.workspaceId)
        .gte('starts_at', startToday.toISOString())
        .lt('starts_at', in7.toISOString()),
      // Ingreso real del mes: citas atendidas (servicio + propina).
      supabase
        .from('appointments')
        .select('price, tip')
        .eq('workspace_id', ctx.workspaceId)
        .eq('status', 'done')
        .gte('starts_at', startMonth.toISOString())
        .lte('starts_at', now.toISOString()),
    ])
    if (error) throw error
    if (monthErr) throw monthErr

    let todayCount = 0
    let upcomingCount = 0
    let todayIncome = 0
    for (const a of data ?? []) {
      if (a.status === 'cancelled' || a.status === 'no_show') continue
      const d = new Date(a.starts_at)
      if (d >= startToday && d < endToday) {
        todayCount += 1
        todayIncome += Number(a.price ?? 0)
      } else if (d >= endToday && d < in7) {
        upcomingCount += 1
      }
    }

    let monthIncome = 0
    let monthDone = 0
    for (const a of monthData ?? []) {
      monthIncome += Number(a.price ?? 0) + Number(a.tip ?? 0)
      monthDone += 1
    }

    return NextResponse.json({
      todayCount,
      upcomingCount,
      todayIncome: Number(todayIncome.toFixed(2)),
      monthIncome: Number(monthIncome.toFixed(2)),
      monthDone,
    })
  } catch (error) {
    console.error('GET /api/appointments/summary', error)
    return NextResponse.json({ error: 'Error al obtener el resumen' }, { status: 500 })
  }
}
