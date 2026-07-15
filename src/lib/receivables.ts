// Mapeo y utilidades para el módulo de Cobros (cuentas por cobrar).

export interface ReceivablePaymentRow {
  id: string
  receivable_id: string
  amount: number | string | null
  date: string | null
  method: string | null
  note: string | null
  created_at?: string | null
}

export const mapPaymentRow = (row: ReceivablePaymentRow) => ({
  id: row.id,
  receivableId: row.receivable_id,
  amount: Number(row.amount ?? 0),
  date: row.date ?? null,
  method: row.method ?? null,
  note: row.note ?? null,
  createdAt: row.created_at ?? null,
})

// row: fila de `receivables`; paid: suma de abonos (opcional).
export const mapReceivableRow = (row: any, paid = 0) => {
  const amount = Number(row.amount ?? 0)
  const paidNum = Number(paid ?? 0)
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id ?? null,
    client: row.client,
    clientPhone: row.client_phone ?? null,
    description: row.description ?? '',
    amount,
    dueDate: row.due_date ?? null,
    status: row.status as 'open' | 'paid' | 'cancelled',
    paid: paidNum,
    balance: Math.max(0, Number((amount - paidNum).toFixed(2))),
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }
}
