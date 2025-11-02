import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { ensureUserAndCategories } from '@/lib/users'
import { calculateMonthlyReports } from '@/lib/statistics'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

const MONTHS = 12

export async function GET() {
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

    const supabase = getSupabaseClient()
    const now = new Date()
    const oldestMonth = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1), 1)

    const [{ data: transactions, error: transactionsError }, { data: projects, error: projectsError }] = await Promise.all([
      supabase
        .from('transactions')
        .select('type, amount, date, project_id')
        .eq('user_id', user.id)
        .gte('date', oldestMonth.toISOString().slice(0, 10)),
      supabase
        .from('projects')
        .select('id, start_date, end_date')
        .eq('user_id', user.id),
    ])

    if (transactionsError) {
      throw transactionsError
    }

    if (projectsError) {
      throw projectsError
    }

    if (!Array.isArray(transactions) || !Array.isArray(projects)) {
      console.error('Datos inesperados en /api/dashboard/monthly', { transactions, projects })
      return NextResponse.json([])
    }

    const normalizedTransactions = transactions.map(row => ({
      type: row.type,
      amount: Number(row.amount ?? 0),
      date: row.date,
      project_id: row.project_id,
    }))

    const reports = calculateMonthlyReports(normalizedTransactions, MONTHS)

    reports.forEach((report, monthIndex) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1 - monthIndex), 1)
      const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1)

      report.projectCount = (projects ?? []).filter(project => {
        const startDate = project.start_date ? new Date(project.start_date) : null
        const endDate = project.end_date ? new Date(project.end_date) : null

        if (startDate && Number.isNaN(startDate.getTime())) return false
        if (endDate && Number.isNaN(endDate.getTime())) return false

        const hasStarted = !startDate || startDate < nextMonth
        const notFinished = !endDate || endDate >= monthDate
        return hasStarted && notFinished
      }).length
    })

    return NextResponse.json(reports)
  } catch (error) {
    console.error('GET /api/dashboard/monthly', error)
    return NextResponse.json({ error: 'Error al obtener reportes mensuales' }, { status: 500 })
  }
}

