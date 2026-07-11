import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext } from '@/lib/workspaces'
import { calculateDashboardStats, calculateProjectSummary } from '@/lib/statistics'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const supabase = getSupabaseClient()

    if (projectId) {
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, name, status, start_date, end_date')
        .eq('id', projectId)
        .eq('workspace_id', ctx.workspaceId)
        .maybeSingle()

      if (projectError) {
        throw projectError
      }

      if (!project) {
        return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
      }

      const { data: projectTransactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('type, amount, date')
        .eq('workspace_id', ctx.workspaceId)
        .eq('project_id', projectId)

      if (transactionsError) {
        throw transactionsError
      }

      const summary = calculateProjectSummary(project, (projectTransactions ?? []).map(normalizeTransaction))
      return NextResponse.json(summary)
    }

    const [{ data: projects, error: projectsError }, { data: transactions, error: transactionsError }] = await Promise.all([
      supabase
        .from('projects')
        .select('id, name, status, start_date, end_date')
        .eq('workspace_id', ctx.workspaceId),
      supabase
        .from('transactions')
        .select('type, amount, date')
        .eq('workspace_id', ctx.workspaceId),
    ])

    if (projectsError) {
      throw projectsError
    }

    if (transactionsError) {
      throw transactionsError
    }

    const stats = calculateDashboardStats(projects ?? [], (transactions ?? []).map(normalizeTransaction))
    return NextResponse.json(stats)
  } catch (error) {
    console.error('GET /api/dashboard', error)
    return NextResponse.json({ error: 'Error al obtener estadísticas' }, { status: 500 })
  }
}

const normalizeTransaction = (row: any) => ({
  type: row.type,
  amount: Number(row.amount ?? 0),
  date: row.date,
})
