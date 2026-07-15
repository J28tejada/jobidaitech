// Mapeo y utilidades para el módulo de Inventario.

export const mapProductRow = (row: any) => {
  const stock = Number(row.stock ?? 0)
  const threshold = Number(row.low_stock_threshold ?? 0)
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    sku: row.sku ?? null,
    unit: row.unit ?? 'unidad',
    cost: Number(row.cost ?? 0),
    price: Number(row.price ?? 0),
    stock,
    lowStockThreshold: threshold,
    lowStock: threshold > 0 && stock <= threshold,
    active: row.active !== false,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }
}

export const mapMovementRow = (row: any) => ({
  id: row.id,
  productId: row.product_id,
  type: row.type as 'in' | 'out' | 'adjust',
  quantity: Number(row.quantity ?? 0),
  note: row.note ?? null,
  createdAt: row.created_at ?? null,
})
