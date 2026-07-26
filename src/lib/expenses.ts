// Gastos simples del negocio (sin proyecto). Ver migración 0038_expenses.sql.

// Categorías sugeridas (chips en el formulario). El negocio puede escribir otra.
export const EXPENSE_CATEGORIES = [
  'Alquiler',
  'Productos e insumos',
  'Servicios (luz, agua, internet)',
  'Salarios',
  'Publicidad',
  'Equipos',
  'Otro',
]

export const mapExpenseRow = (row: any) => ({
  id: row.id,
  workspaceId: row.workspace_id,
  category: row.category ?? '',
  description: row.description ?? '',
  amount: Number(row.amount ?? 0),
  date: row.date ?? null,
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
})
