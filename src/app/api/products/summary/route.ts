import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext, MODULE_LOCKED_ERROR } from '@/lib/workspaces'

// Totales del módulo de Inventario para el KPI del panel y el encabezado.
export async function GET() {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!ctx.hasModule('inventory')) {
      return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    }

    const supabase = getSupabaseClient()
    const { data: rows, error } = await supabase
      .from('products')
      .select('cost, stock, low_stock_threshold, active')
      .eq('workspace_id', ctx.workspaceId)
      .eq('active', true)
    if (error) throw error

    let totalProducts = 0
    let inventoryValue = 0
    let lowStockCount = 0

    for (const r of rows ?? []) {
      totalProducts += 1
      const stock = Number(r.stock ?? 0)
      const cost = Number(r.cost ?? 0)
      const threshold = Number(r.low_stock_threshold ?? 0)
      inventoryValue += stock * cost
      if (threshold > 0 && stock <= threshold) lowStockCount += 1
    }

    return NextResponse.json({
      totalProducts,
      inventoryValue: Number(inventoryValue.toFixed(2)),
      lowStockCount,
    })
  } catch (error) {
    console.error('GET /api/products/summary', error)
    return NextResponse.json({ error: 'Error al obtener el resumen de inventario' }, { status: 500 })
  }
}
