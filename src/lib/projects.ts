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
