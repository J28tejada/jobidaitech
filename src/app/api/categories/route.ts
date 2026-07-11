import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext, getWriteAccess } from '@/lib/workspaces'
import { mapCategoryRow } from '@/lib/categories'

export async function GET() {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .order('type', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Error al obtener categorías' }, { status: 500 })
  }

  return NextResponse.json((data ?? []).map(mapCategoryRow))
}

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const access = getWriteAccess(ctx.role)
  if (!access.allowed || access.ownOnly) {
    return NextResponse.json({ error: 'No tienes permiso para gestionar categorías en este espacio' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { name, type, subcategories, color } = body

    if (!name || !type || !['income', 'expense'].includes(type)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('categories')
      .insert({
        workspace_id: ctx.workspaceId,
        user_id: ctx.user.id,
        name,
        type,
        color: color ?? null,
        subcategories: Array.isArray(subcategories)
          ? subcategories
          : typeof subcategories === 'string'
          ? subcategories.split(',').map((item: string) => item.trim()).filter(Boolean)
          : [],
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json(mapCategoryRow(data), { status: 201 })
  } catch (error) {
    console.error('POST /api/categories', error)
    return NextResponse.json({ error: 'Error al crear la categoría' }, { status: 500 })
  }
}
