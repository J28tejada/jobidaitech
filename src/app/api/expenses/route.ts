import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext, getWriteAccess, READ_ONLY_ERROR } from '@/lib/workspaces'
import { mapExpenseRow } from '@/lib/expenses'
import { track } from '@/lib/analytics'

// Lista de gastos simples del negocio, opcionalmente filtrada por rango de
// fechas (YYYY-MM-DD).
export async function GET(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const supabase = getSupabaseClient()
    const query = supabase
      .from('expenses')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    if (from) query.gte('date', from)
    if (to) query.lte('date', to)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json((data ?? []).map(mapExpenseRow))
  } catch (error) {
    console.error('GET /api/expenses', error)
    return NextResponse.json({ error: 'Error al obtener los gastos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para registrar gastos' }, { status: 403 })
    }

    const body = await request.json()
    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Indica un monto válido' }, { status: 400 })
    }
    const category = typeof body.category === 'string' && body.category.trim() ? body.category.trim().slice(0, 60) : null
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 200) : ''
    const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : new Date().toISOString().slice(0, 10)

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('expenses')
      .insert({ workspace_id: ctx.workspaceId, user_id: ctx.user.id, category, description, amount, date })
      .select()
      .single()
    if (error) throw error

    await track('expense_created', { userId: ctx.user.id, workspaceId: ctx.workspaceId })
    return NextResponse.json(mapExpenseRow(data), { status: 201 })
  } catch (error) {
    console.error('POST /api/expenses', error)
    return NextResponse.json({ error: 'Error al registrar el gasto' }, { status: 500 })
  }
}
