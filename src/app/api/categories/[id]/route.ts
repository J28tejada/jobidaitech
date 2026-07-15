import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext, getWriteAccess, READ_ONLY_ERROR } from '@/lib/workspaces'
import { mapCategoryRow } from '@/lib/categories'

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!ctx.canWrite) {
    return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
  }
  const access = getWriteAccess(ctx.role)
  if (!access.allowed || access.ownOnly) {
    return NextResponse.json({ error: 'No tienes permiso para editar categorías en este espacio' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const supabase = getSupabaseClient()

    // Categoría actual (para saber si cambió el nombre y sincronizar transacciones)
    const { data: current } = await supabase
      .from('categories')
      .select('name')
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()
    if (!current) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) updates.name = String(body.name).trim()
    if (body.type !== undefined && ['income', 'expense'].includes(body.type)) updates.type = body.type
    if (body.color !== undefined) updates.color = body.color ?? null
    if (body.subcategories !== undefined) {
      updates.subcategories = Array.isArray(body.subcategories)
        ? body.subcategories
        : typeof body.subcategories === 'string'
        ? body.subcategories.split(',').map((s: string) => s.trim()).filter(Boolean)
        : []
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .select()
      .maybeSingle()
    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
    }

    // Si cambió el nombre, sincronizar el nombre denormalizado en transacciones.
    const newName = updates.name as string | undefined
    if (newName && newName !== current.name) {
      await supabase
        .from('transactions')
        .update({ category_name: newName })
        .eq('workspace_id', ctx.workspaceId)
        .eq('category_id', params.id)
    }

    return NextResponse.json(mapCategoryRow(data))
  } catch (error) {
    console.error(`PUT /api/categories/${params.id}`, error)
    return NextResponse.json({ error: 'No se pudo actualizar la categoría' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  if (!ctx.canWrite) {
    return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
  }

  const access = getWriteAccess(ctx.role)
  if (!access.allowed || access.ownOnly) {
    return NextResponse.json({ error: 'No tienes permiso para eliminar categorías en este espacio' }, { status: 403 })
  }

  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', params.id)
    .eq('workspace_id', ctx.workspaceId)

  if (error) {
    console.error(`DELETE /api/categories/${params.id}`, error)
    return NextResponse.json({ error: 'No se pudo eliminar la categoría' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
