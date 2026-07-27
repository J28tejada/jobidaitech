export const mapTransactionRow = (row: any) => ({
  id: row.id,
  projectId: row.project_id,
  type: row.type,
  category: row.category_name,
  subcategory: row.subcategory ?? null,
  description: row.description,
  amount: Number(row.amount ?? 0),
  date: row.date ? new Date(row.date) : undefined,
  paymentMethod: row.payment_method,
  reference: row.reference ?? null,
  // De dónde salió el registro ('whatsapp' o null si se cargó desde la app).
  // Se expone para poder marcarlo en la UI: si no se ve, la trazabilidad solo
  // sirve consultando la base.
  source: row.source ?? null,
  attachments: Array.isArray(row.attachments) ? row.attachments : [],
  createdAt: row.created_at ? new Date(row.created_at) : undefined,
  updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
})
