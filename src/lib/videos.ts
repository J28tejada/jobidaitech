// Mapeos para el módulo Videos.

export const mapRecorderRow = (row: any) => ({
  id: row.id,
  workspaceId: row.workspace_id,
  name: row.name ?? '',
  rate: Number(row.rate ?? 0),
  active: row.active !== false,
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
})

export const mapVideoRow = (row: any) => ({
  id: row.id,
  workspaceId: row.workspace_id,
  clientId: row.client_id ?? null,
  recorderId: row.recorder_id ?? null,
  recorderName: row.recorder_name ?? '',
  videoRef: row.video_ref ?? '',
  topic: row.topic ?? '',
  videoDate: row.video_date ?? null,
  price: Number(row.price ?? 0),
  notes: row.notes ?? '',
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
})

export const mapReportRow = (row: any) => ({
  id: row.id,
  workspaceId: row.workspace_id,
  clientId: row.client_id ?? null,
  clientName: row.client_name ?? '',
  title: row.title ?? '',
  dateFrom: row.date_from ?? null,
  dateTo: row.date_to ?? null,
  total: Number(row.total ?? 0),
  videoCount: Number(row.video_count ?? 0),
  token: row.token ?? '',
  createdAt: row.created_at ?? null,
})
