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

export const mapClientRateRow = (row: any) => ({
  id: row.id,
  clientId: row.client_id,
  label: row.label ?? '',
  rate: Number(row.rate ?? 0),
})

/** Error de Supabase por tabla/columna que aún no existe (migración sin correr). */
export const isMissingSchema = (error: any) =>
  !!error && (error.code === '42P01' || error.code === '42703' || error.code === 'PGRST205')

/**
 * Primer precio de video configurado para el cliente (o null si no tiene).
 * Se usa como precio por defecto cuando no mandan uno explícito.
 */
export async function firstClientRate(supabase: any, workspaceId: string, clientId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('client_video_rates')
    .select('rate')
    .eq('workspace_id', workspaceId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })
    .limit(1)
  if (error || !data || data.length === 0) return null
  return Number(data[0].rate ?? 0)
}
