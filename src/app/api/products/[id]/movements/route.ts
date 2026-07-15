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

// Registrar un movimiento de inventario (entrada/salida/ajuste).
// - in:     stock += quantity
// - out:    stock -= quantity (rechaza si dejaría el stock < 0)
// - adjust: el cuerpo envía el nuevo stock absoluto (newStock); delta = nuevo - actual
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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
      return NextResponse.json({ error: 'No tienes permiso para mover inventario en este espacio' }, { status: 403 })
    }

    const body = await request.json()
    const type = body.type as 'in' | 'out' | 'adjust'
    if (!['in', 'out', 'adjust'].includes(type)) {
      return NextResponse.json({ error: 'Tipo de movimiento inválido' }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    const { data: product, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()
    if (prodErr) throw prodErr
    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    const current = Number(product.stock ?? 0)
    let delta: number

    if (type === 'adjust') {
      const newStock = Number(body.newStock)
      if (!Number.isFinite(newStock) || newStock < 0) {
        return NextResponse.json({ error: 'El nuevo stock debe ser 0 o mayor' }, { status: 400 })
      }
      delta = Number((newStock - current).toFixed(2))
    } else {
      const quantity = Number(body.quantity)
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return NextResponse.json({ error: 'La cantidad debe ser mayor a 0' }, { status: 400 })
      }
      delta = type === 'in' ? quantity : -quantity
    }

    const newStock = Number((current + delta).toFixed(2))
    if (newStock < 0) {
      return NextResponse.json({ error: 'No hay suficiente stock para esa salida' }, { status: 400 })
    }

    if (delta !== 0) {
      const { error: moveErr } = await supabase.from('inventory_movements').insert({
        product_id: params.id,
        workspace_id: ctx.workspaceId,
        user_id: ctx.user.id,
        type,
        quantity: delta,
        note: typeof body.note === 'string' ? body.note.trim() || null : null,
      })
      if (moveErr) throw moveErr

      const { error: updErr } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', params.id)
        .eq('workspace_id', ctx.workspaceId)
      if (updErr) throw updErr
    }

    await track('movement_created', {
      userId: ctx.user.id,
      workspaceId: ctx.workspaceId,
      props: { type },
    })

    return NextResponse.json(mapProductRow({ ...product, stock: newStock }), { status: 201 })
  } catch (error) {
    console.error(`POST /api/products/${params.id}/movements`, error)
    return NextResponse.json({ error: 'Error al registrar el movimiento' }, { status: 500 })
  }
}
