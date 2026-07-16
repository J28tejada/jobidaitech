// Mapeo y cálculos para el módulo de Cotizaciones.

export interface QuoteItemInput {
  description?: string
  quantity?: number | string
  unitPrice?: number | string
}

export const mapQuoteItemRow = (row: any) => ({
  id: row.id,
  description: row.description ?? '',
  quantity: Number(row.quantity ?? 0),
  unitPrice: Number(row.unit_price ?? 0),
  lineTotal: Number((Number(row.quantity ?? 0) * Number(row.unit_price ?? 0)).toFixed(2)),
  position: Number(row.position ?? 0),
})

export const mapQuoteRow = (row: any, items: any[] = []) => ({
  id: row.id,
  workspaceId: row.workspace_id,
  clientId: row.client_id ?? null,
  clientName: row.client_name ?? '',
  clientPhone: row.client_phone ?? null,
  number: row.number ?? null,
  title: row.title ?? '',
  notes: row.notes ?? '',
  status: row.status as 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired',
  taxEnabled: row.tax_enabled === true,
  taxRate: Number(row.tax_rate ?? 0),
  subtotal: Number(row.subtotal ?? 0),
  taxAmount: Number(row.tax_amount ?? 0),
  total: Number(row.total ?? 0),
  validUntil: row.valid_until ?? null,
  token: row.token ?? null,
  acceptedAt: row.accepted_at ?? null,
  projectId: row.project_id ?? null,
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
  items: items.map(mapQuoteItemRow).sort((a, b) => a.position - b.position),
})

/** Calcula subtotal/impuesto/total a partir de las partidas. */
export function computeTotals(
  items: QuoteItemInput[],
  taxEnabled: boolean,
  taxRate: number
): { subtotal: number; taxAmount: number; total: number } {
  const subtotal = items.reduce((sum, it) => {
    const qty = Number(it.quantity ?? 0)
    const price = Number(it.unitPrice ?? 0)
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return sum
    return sum + qty * price
  }, 0)
  const rate = Number.isFinite(taxRate) ? taxRate : 0
  const taxAmount = taxEnabled ? subtotal * (rate / 100) : 0
  const round = (n: number) => Number(n.toFixed(2))
  return { subtotal: round(subtotal), taxAmount: round(taxAmount), total: round(subtotal + taxAmount) }
}

/** Normaliza las partidas que llegan del cliente. */
export function normalizeItems(raw: unknown): { description: string; quantity: number; unitPrice: number }[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((it: any) => ({
      description: typeof it?.description === 'string' ? it.description.trim() : '',
      quantity: Number(it?.quantity ?? 0),
      unitPrice: Number(it?.unitPrice ?? 0),
    }))
    .filter(it => it.description || it.quantity > 0 || it.unitPrice > 0)
}
