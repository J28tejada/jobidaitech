import type { Category } from '@/types'

export const mapCategoryRow = (row: any): Category => ({
  id: row.id,
  name: row.name,
  type: row.type,
  subcategories: Array.isArray(row.subcategories) ? row.subcategories : undefined,
  color: row.color ?? undefined,
})
