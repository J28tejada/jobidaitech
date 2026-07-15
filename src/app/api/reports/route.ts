import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext } from '@/lib/workspaces'
import { monthlyBucketsInRange } from '@/lib/statistics'

interface TxRow {
  type: 'income' | 'expense'
  amount: number
  date: string
  category_name: string | null
  project_id: string | null
}

// Reporte financiero del espacio activo, con rango de fechas y desgloses.
export async function GET(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const now = new Date()
    const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    const fromStr = searchParams.get('from') || defaultFrom.toISOString().slice(0, 10)
    const toStr = searchParams.get('to') || now.toISOString().slice(0, 10)
    const fromDate = new Date(fromStr)
    const toDate = new Date(toStr)

    const supabase = getSupabaseClient()

    const txQuery = supabase
      .from('transactions')
      .select('type, amount, date, category_name, project_id')
      .eq('workspace_id', ctx.workspaceId)
      .gte('date', fromStr)
      .lte('date', toStr)

    const projectsQuery = supabase
      .from('projects')
      .select('id, name')
      .eq('workspace_id', ctx.workspaceId)

    if (projectId) txQuery.eq('project_id', projectId)
    if (ctx.allowedProjectIds) {
      txQuery.in('project_id', ctx.allowedProjectIds)
      projectsQuery.in('id', ctx.allowedProjectIds)
    }

    const [{ data: txData, error: txErr }, { data: projData, error: projErr }, { data: ws }] = await Promise.all([
      txQuery,
      projectsQuery,
      supabase.from('workspaces').select('name').eq('id', ctx.workspaceId).maybeSingle(),
    ])
    if (txErr) throw txErr
    if (projErr) throw projErr

    const transactions: TxRow[] = (txData ?? []).map(r => ({
      type: r.type,
      amount: Number(r.amount ?? 0),
      date: r.date,
      category_name: r.category_name ?? null,
      project_id: r.project_id ?? null,
    }))
    const projectNames = new Map<string, string>((projData ?? []).map(p => [p.id, p.name]))

    // Totales
    let income = 0
    let expenses = 0
    for (const t of transactions) {
      if (t.type === 'income') income += t.amount
      else expenses += t.amount
    }

    // Mensual
    const monthly = monthlyBucketsInRange(transactions, fromDate, toDate)

    // Por categoría (ingreso/gasto)
    const catMap = new Map<string, { category: string; type: 'income' | 'expense'; total: number }>()
    for (const t of transactions) {
      const category = t.category_name || 'Sin categoría'
      const key = `${t.type}::${category}`
      const entry = catMap.get(key) ?? { category, type: t.type, total: 0 }
      entry.total += t.amount
      catMap.set(key, entry)
    }
    const byCategory = Array.from(catMap.values()).sort((a, b) => b.total - a.total)

    // Por proyecto
    const projMap = new Map<string, { projectId: string | null; projectName: string; income: number; expenses: number }>()
    for (const t of transactions) {
      const key = t.project_id ?? 'none'
      const name = t.project_id ? projectNames.get(t.project_id) ?? 'Proyecto eliminado' : 'Sin proyecto'
      const entry = projMap.get(key) ?? { projectId: t.project_id, projectName: name, income: 0, expenses: 0 }
      if (t.type === 'income') entry.income += t.amount
      else entry.expenses += t.amount
      projMap.set(key, entry)
    }
    const byProject = Array.from(projMap.values())
      .map(p => ({ ...p, profit: p.income - p.expenses }))
      .sort((a, b) => b.profit - a.profit)

    return NextResponse.json({
      range: { from: fromStr, to: toStr },
      workspaceName: ws?.name ?? 'Mi negocio',
      currency: ctx.currency,
      locale: ctx.locale,
      totals: { income, expenses, profit: income - expenses },
      monthly,
      byCategory,
      byProject,
    })
  } catch (error) {
    console.error('GET /api/reports', error)
    return NextResponse.json({ error: 'Error al generar el reporte' }, { status: 500 })
  }
}
