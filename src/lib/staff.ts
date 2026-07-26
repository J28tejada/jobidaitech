// Mapeo para barberos / personal (módulo Agenda).

export const mapStaffRow = (row: any) => ({
  id: row.id,
  workspaceId: row.workspace_id,
  name: row.name ?? '',
  commissionPct: Number(row.commission_pct ?? 0),
  phone: row.phone ?? null,
  email: row.email ?? null,
  imageUrl: row.image_url ?? null,
  // IDs de servicios que hace el barbero. Vacío = hace todos (compatibilidad).
  serviceIds: Array.isArray(row.service_ids) ? row.service_ids.map(String) : [],
  active: row.active !== false,
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
})
