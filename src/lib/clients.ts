// Mapeo para el módulo de Clientes.

export const mapClientRow = (row: any) => ({
  id: row.id,
  workspaceId: row.workspace_id,
  name: row.name,
  phone: row.phone ?? null,
  email: row.email ?? null,
  taxId: row.tax_id ?? null,
  address: row.address ?? null,
  notes: row.notes ?? null,
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
})
