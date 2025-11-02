import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { ensureUserAndCategories } from '@/lib/users'
import { calculateDashboardStats, calculateProjectSummary } from '@/lib/statistics'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

export async function GET(request: NextRequest) {
  try {
    const supabaseAuth = createSupabaseRouteClient()
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser()

    if (!user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    await ensureUserAndCategories({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email,
      image: user.user_metadata?.avatar_url,
    })

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const supabase = getSupabaseClient()

    if (projectId) {
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, name, status, start_date, end_date')
        .eq('id', projectId)
        .eq('user_id', user.id)
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
        .eq('user_id', user.id)
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
        .eq('user_id', user.id),
      supabase
        .from('transactions')
        .select('type, amount, date')
        .eq('user_id', user.id),
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

