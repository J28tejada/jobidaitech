import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext, MODULE_LOCKED_ERROR } from '@/lib/workspaces'

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Comisiones y propinas por barbero (citas atendidas en el rango).
export async function GET(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('agenda')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })

    const { searchParams } = new URL(request.url)
    const now = new Date()
    const from = searchParams.get('from') || ymd(new Date(now.getFullYear(), now.getMonth(), 1))
    const to = searchParams.get('to') || ymd(now)
    const fromIso = new Date(`${from}T00:00:00`).toISOString()
    const toIso = new Date(`${to}T23:59:59`).toISOString()

    const supabase = getSupabaseClient()

    // Tarifa de comisión por barbero (mapa id -> pct).
    const { data: staff } = await supabase
      .from('staff')
      .select('id, name, commission_pct')
      .eq('workspace_id', ctx.workspaceId)
    const pctById = new Map<string, number>()
    for (const s of staff ?? []) pctById.set(s.id, Number(s.commission_pct ?? 0))

    // Citas atendidas del rango.
    const { data: appts, error } = await supabase
      .from('appointments')
      .select('staff_id, staff_name, price, tip')
      .eq('workspace_id', ctx.workspaceId)
      .eq('status', 'done')
      .gte('starts_at', fromIso)
      .lte('starts_at', toIso)
    if (error) throw error

    type Row = { staffId: string | null; staffName: string; count: number; serviceIncome: number; commission: number; tips: number; total: number }
    const map = new Map<string, Row>()
    for (const a of appts ?? []) {
      const key = a.staff_id ?? '__none__'
      const name = a.staff_name || (a.staff_id ? 'Barbero' : 'Sin asignar')
      let row = map.get(key)
      if (!row) {
        row = { staffId: a.staff_id ?? null, staffName: name, count: 0, serviceIncome: 0, commission: 0, tips: 0, total: 0 }
        map.set(key, row)
      }
      const price = Number(a.price ?? 0)
      const tip = Number(a.tip ?? 0)
      const pct = a.staff_id ? (pctById.get(a.staff_id) ?? 0) : 0
      row.count += 1
      row.serviceIncome += price
      row.commission += price * (pct / 100)
      row.tips += tip
      row.total += price * (pct / 100) + tip
    }

    const rows = Array.from(map.values())
      .map(r => ({
        ...r,
        commission: Math.round(r.commission * 100) / 100,
        total: Math.round(r.total * 100) / 100,
      }))
      .sort((a, b) => b.total - a.total)

    return NextResponse.json({ from, to, rows })
  } catch (error) {
    console.error('GET /api/appointments/commissions', error)
    return NextResponse.json({ error: 'Error al calcular comisiones' }, { status: 500 })
  }
}
