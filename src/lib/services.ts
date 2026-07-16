// Mapeo para el catálogo de servicios (módulo Agenda).

export const mapServiceRow = (row: any) => ({
  id: row.id,
  workspaceId: row.workspace_id,
  name: row.name,
  durationMin: Number(row.duration_min ?? 30),
  price: Number(row.price ?? 0),
  active: row.active !== false,
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
})
