// Mapeo para las citas (módulo Agenda).

export const mapAppointmentRow = (row: any) => {
  const startsAt = row.starts_at
  const durationMin = Number(row.duration_min ?? 30)
  let endsAt: string | null = null
  if (startsAt) {
    const d = new Date(startsAt)
    if (!Number.isNaN(d.getTime())) endsAt = new Date(d.getTime() + durationMin * 60000).toISOString()
  }
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    clientId: row.client_id ?? null,
    clientName: row.client_name ?? '',
    clientPhone: row.client_phone ?? null,
    serviceId: row.service_id ?? null,
    title: row.title ?? '',
    startsAt: startsAt ?? null,
    endsAt,
    durationMin,
    price: Number(row.price ?? 0),
    status: row.status as 'scheduled' | 'confirmed' | 'done' | 'cancelled' | 'no_show',
    notes: row.notes ?? '',
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }
}
