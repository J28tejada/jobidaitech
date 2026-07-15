import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { mapProductRow, mapMovementRow } from '@/lib/inventory'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!ctx.hasModule('inventory')) {
      return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()
    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    const { data: movements } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('product_id', params.id)
      .order('created_at', { ascending: false })
      .limit(100)

    return NextResponse.json({
      ...mapProductRow(data),
      movements: (movements ?? []).map(mapMovementRow),
    })
  } catch (error) {
    console.error(`GET /api/products/${params.id}`, error)
    return NextResponse.json({ error: 'Error al obtener el producto' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!ctx.hasModule('inventory')) {
      return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    }
    if (!ctx.canWrite) {
      return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    }
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para editar en este espacio' }, { status: 403 })
    }

    const body = await request.json()
    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) updates.name = String(body.name).trim()
    if (body.sku !== undefined) updates.sku = body.sku ? String(body.sku).trim() : null
    if (body.unit !== undefined) updates.unit = String(body.unit).trim() || 'unidad'
    if (body.cost !== undefined) updates.cost = Number(body.cost)
    if (body.price !== undefined) updates.price = Number(body.price)
    if (body.lowStockThreshold !== undefined) updates.low_stock_threshold = Number(body.lowStockThreshold)
    if (body.active !== undefined) updates.active = !!body.active
    // El stock NO se edita aquí: se cambia con movimientos (entrada/salida/ajuste).

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .select()
      .maybeSingle()
    if (error) {
      if ((error as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'Ya existe un producto con ese SKU en este espacio' }, { status: 409 })
      }
      throw error
    }
    if (!data) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    return NextResponse.json(mapProductRow(data))
  } catch (error) {
    console.error(`PUT /api/products/${params.id}`, error)
    return NextResponse.json({ error: 'Error al actualizar el producto' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!ctx.hasModule('inventory')) {
      return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    }
    if (!ctx.canWrite) {
      return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    }
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para eliminar en este espacio' }, { status: 403 })
    }

    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
    if (error) throw error

    return NextResponse.json({ message: 'Producto eliminado correctamente' })
  } catch (error) {
    console.error(`DELETE /api/products/${params.id}`, error)
    return NextResponse.json({ error: 'Error al eliminar el producto' }, { status: 500 })
  }
}
