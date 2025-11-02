import type { DashboardStats, MonthlyReport, ProjectSummary } from '@/types'

interface TransactionRow {
  type: 'income' | 'expense'
  amount: number
  date: string
  project_id?: string
}

interface ProjectRow {
  id: string
  name: string
  status: string
  start_date: string
  end_date?: string | null
}

export function calculateDashboardStats(projects: ProjectRow[], transactions: TransactionRow[]): DashboardStats {
  const totalProjects = projects.length
  const activeProjects = projects.filter(project => project.status === 'active').length

  let totalIncome = 0
  let totalExpenses = 0
  let monthlyIncome = 0
  let monthlyExpenses = 0

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  transactions.forEach(transaction => {
    const amount = Number(transaction.amount ?? 0)
    if (transaction.type === 'income') {
      totalIncome += amount
    } else {
      totalExpenses += amount
    }

    const date = new Date(transaction.date)
    if (!Number.isNaN(date.getTime()) && date >= monthStart && date < nextMonthStart) {
      if (transaction.type === 'income') {
        monthlyIncome += amount
      } else {
        monthlyExpenses += amount
      }
    }
  })

  const totalProfit = totalIncome - totalExpenses
  const averageProfitMargin = totalIncome > 0 ? (totalProfit / totalIncome) * 100 : 0

  return {
    totalProjects,
    activeProjects,
    totalIncome,
    totalExpenses,
    totalProfit,
    averageProfitMargin,
    monthlyIncome,
    monthlyExpenses,
  }
}

export function calculateProjectSummary(project: ProjectRow, transactions: TransactionRow[]): ProjectSummary {
  let totalIncome = 0
  let totalExpenses = 0
  let lastTransactionDate: string | undefined

  transactions.forEach(transaction => {
    const amount = Number(transaction.amount ?? 0)
    if (transaction.type === 'income') {
      totalIncome += amount
    } else {
      totalExpenses += amount
    }

    if (!lastTransactionDate || new Date(transaction.date) > new Date(lastTransactionDate)) {
      lastTransactionDate = transaction.date
    }
  })

  const profit = totalIncome - totalExpenses
  const profitMargin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0

  return {
    projectId: project.id,
    projectName: project.name,
    totalIncome,
    totalExpenses,
    profit,
    profitMargin,
    transactionCount: transactions.length,
    lastTransactionDate: lastTransactionDate ?? undefined,
  }
}

export function calculateMonthlyReports(transactions: TransactionRow[], months: number): MonthlyReport[] {
  const now = new Date()
  const reports: MonthlyReport[] = []

  for (let i = 0; i < months; i++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)

    let income = 0
    let expenses = 0
    const monthTransactions = transactions.filter(transaction => {
      const date = new Date(transaction.date)
      return !Number.isNaN(date.getTime()) && date >= monthDate && date < nextMonth
    })

    monthTransactions.forEach(transaction => {
      const amount = Number(transaction.amount ?? 0)
      if (transaction.type === 'income') {
        income += amount
      } else {
        expenses += amount
      }
    })

    const profit = income - expenses

    reports.push({
      month: monthDate.toLocaleDateString('es-ES', { month: 'long' }),
      year: monthDate.getFullYear(),
      income,
      expenses,
      profit,
      projectCount: 0, // se completará externamente si es necesario
    })
  }

  return reports.reverse()
}
