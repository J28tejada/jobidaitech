// Mapeo para el módulo CRM (oportunidades + actividades).

export type Stage = 'new' | 'contacted' | 'quoted' | 'won' | 'lost'
export const OPEN_STAGES: Stage[] = ['new', 'contacted', 'quoted']

export const mapActivityRow = (row: any) => ({
  id: row.id,
  type: row.type as 'note' | 'call' | 'message' | 'meeting' | 'whatsapp',
  body: row.body ?? '',
  createdAt: row.created_at ?? null,
})

export const mapOpportunityRow = (row: any, activities: any[] = []) => ({
  id: row.id,
  workspaceId: row.workspace_id,
  clientId: row.client_id ?? null,
  clientName: row.client_name ?? '',
  clientPhone: row.client_phone ?? null,
  title: row.title ?? '',
  stage: row.stage as Stage,
  value: Number(row.value ?? 0),
  source: row.source ?? null,
  expectedClose: row.expected_close ?? null,
  nextAction: row.next_action ?? null,
  nextActionDate: row.next_action_date ?? null,
  lostReason: row.lost_reason ?? null,
  quoteId: row.quote_id ?? null,
  projectId: row.project_id ?? null,
  notes: row.notes ?? '',
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
  activities: activities.map(mapActivityRow),
})
