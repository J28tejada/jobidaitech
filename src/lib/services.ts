// Mapeo y utilidades para el catálogo de servicios (módulo Agenda).

export interface ServiceVariant {
  label: string
  price: number
}

/** Valida/limpia las variantes de precio (ej. Niño/Adolescente/Adulto). */
export function normalizeVariants(raw: unknown): ServiceVariant[] {
  if (!Array.isArray(raw)) return []
  const out: ServiceVariant[] = []
  raw.forEach(v => {
    if (v && typeof v === 'object') {
      const label = typeof (v as { label?: unknown }).label === 'string' ? (v as { label: string }).label.trim() : ''
      const price = Number((v as { price?: unknown }).price)
      if (label && Number.isFinite(price) && price >= 0) out.push({ label, price: Math.round(price * 100) / 100 })
    }
  })
  return out.slice(0, 8)
}

export const mapServiceRow = (row: any) => ({
  id: row.id,
  workspaceId: row.workspace_id,
  name: row.name,
  durationMin: Number(row.duration_min ?? 30),
  price: Number(row.price ?? 0),
  variants: normalizeVariants(row.variants),
  active: row.active !== false,
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
})
