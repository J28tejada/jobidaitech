import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { mapProductRow } from '@/lib/inventory'
import { track } from '@/lib/analytics'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!ctx.hasModule('inventory')) {
      return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = (searchParams.get('search') || '').trim()
    const lowStock = searchParams.get('lowStock') === 'true'

    const supabase = getSupabaseClient()
    const query = supabase
      .from('products')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .order('name', { ascending: true })

    if (search) {
      query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`)
    }

    const { data, error } = await query
    if (error) throw error

    let products = (data ?? []).map(mapProductRow)
    if (lowStock) {
      products = products.filter(p => p.lowStock)
    }

    return NextResponse.json(products)
  } catch (error) {
    console.error('GET /api/products', error)
    return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!ctx.hasModule('inventory')) {
      await track('paywall_hit', {
        userId: ctx.user.id,
        workspaceId: ctx.workspaceId,
        props: { module: 'inventory' },
      })
      return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    }

    if (!ctx.canWrite) {
      return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    }

    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para registrar productos en este espacio' }, { status: 403 })
    }

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return NextResponse.json({ error: 'El nombre del producto es obligatorio' }, { status: 400 })
    }

    const stock = Number.isFinite(Number(body.stock)) ? Number(body.stock) : 0
    if (stock < 0) {
      return NextResponse.json({ error: 'El stock no puede ser negativo' }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    const payload = {
      workspace_id: ctx.workspaceId,
      user_id: ctx.user.id,
      name,
      sku: typeof body.sku === 'string' ? body.sku.trim() || null : null,
      unit: typeof body.unit === 'string' && body.unit.trim() ? body.unit.trim() : 'unidad',
      cost: Number.isFinite(Number(body.cost)) ? Number(body.cost) : 0,
      price: Number.isFinite(Number(body.price)) ? Number(body.price) : 0,
      stock,
      low_stock_threshold: Number.isFinite(Number(body.lowStockThreshold)) ? Number(body.lowStockThreshold) : 0,
      active: true,
    }

    const { data, error } = await supabase.from('products').insert(payload).select().single()
    if (error) {
      // Violación de SKU único por espacio
      if ((error as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'Ya existe un producto con ese SKU en este espacio' }, { status: 409 })
      }
      throw error
    }

    // Registrar el stock inicial como movimiento de entrada (historial)
    if (stock > 0) {
      await supabase.from('inventory_movements').insert({
        product_id: data.id,
        workspace_id: ctx.workspaceId,
        user_id: ctx.user.id,
        type: 'in',
        quantity: stock,
        note: 'Stock inicial',
      })
    }

    await track('product_created', {
      userId: ctx.user.id,
      workspaceId: ctx.workspaceId,
    })

    return NextResponse.json(mapProductRow(data), { status: 201 })
  } catch (error) {
    console.error('POST /api/products', error)
    return NextResponse.json({ error: 'Error al crear el producto' }, { status: 500 })
  }
}
