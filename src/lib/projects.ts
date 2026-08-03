export const mapProjectRow = (row: any) => ({
  id: row.id,
  name: row.name,
  description: row.description ?? '',
  client: row.client,
  startDate: row.start_date ? new Date(row.start_date) : undefined,
  endDate: row.end_date ? new Date(row.end_date) : undefined,
  status: row.status,
  budget: Number(row.budget ?? 0),
  initialPayment: row.initial_payment ? Number(row.initial_payment) : undefined,
  createdAt: row.created_at ? new Date(row.created_at) : undefined,
  updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
})

export const toDateOnly = (value: string | undefined | null) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------
// Avance de obra (tabla project_tasks, migración 0044)
// ---------------------------------------------------------------------

export const mapProjectTaskRow = (row: any) => ({
  id: row.id,
  projectId: row.project_id,
  title: row.title ?? '',
  done: Boolean(row.done),
  dueDate: row.due_date ?? null,
  position: Number(row.position ?? 0),
  doneAt: row.done_at ?? null,
  createdAt: row.created_at ?? null,
})

export type ProjectTask = ReturnType<typeof mapProjectTaskRow>

/**
 * La migración 0044 la corre el dueño a mano en el SQL Editor, así que la app
 * puede estar desplegada antes que la tabla exista. En ese caso respondemos
 * "sin tareas" en lugar de romper el detalle del proyecto.
 */
export const isMissingRelation = (error: any) => {
  if (!error) return false
  const code = String(error.code ?? '')
  // 42P01 = undefined_table (Postgres); PGRST205 = tabla ausente del schema cache.
  if (code === '42P01' || code === 'PGRST205') return true
  const message = String(error.message ?? '').toLowerCase()
  return message.indexOf('does not exist') !== -1 || message.indexOf('schema cache') !== -1
}

// ---------------------------------------------------------------------
// "¿Cuánto gano en este trabajo?" — cálculos compartidos por API y UI
// ---------------------------------------------------------------------

export type BudgetStatus = 'none' | 'ok' | 'warning' | 'over'

/**
 * Estado del presupuesto según cuánto se lleva gastado.
 * `none` = el proyecto no tiene presupuesto cargado, no hay nada que comparar.
 */
export const budgetStatusFor = (budget: number, expenses: number): BudgetStatus => {
  if (!budget || budget <= 0) return 'none'
  const used = (expenses / budget) * 100
  if (used > 100) return 'over'
  if (used >= 80) return 'warning'
  return 'ok'
}

export interface ProjectTotals {
  income: number
  expenses: number
  profit: number
  /** Margen sobre los ingresos cobrados, en %. */
  margin: number
  /** % del presupuesto ya consumido por gastos. */
  budgetUsed: number
  budgetStatus: BudgetStatus
  tasksTotal: number
  tasksDone: number
  /** % de avance; null cuando el proyecto todavía no tiene etapas cargadas. */
  progress: number | null
}

export const computeProjectTotals = (
  budget: number,
  income: number,
  expenses: number,
  tasksTotal = 0,
  tasksDone = 0
): ProjectTotals => {
  const profit = income - expenses
  return {
    income,
    expenses,
    profit,
    margin: income > 0 ? (profit / income) * 100 : 0,
    budgetUsed: budget > 0 ? (expenses / budget) * 100 : 0,
    budgetStatus: budgetStatusFor(budget, expenses),
    tasksTotal,
    tasksDone,
    progress: tasksTotal > 0 ? (tasksDone / tasksTotal) * 100 : null,
  }
}
