import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { ensureUserAndCategories } from '@/lib/users'
import { mapCategoryRow } from '@/lib/categories'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

export async function GET() {
  const supabaseAuth = createSupabaseRouteClient()
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser()

  if (!user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  await ensureUserAndCategories({
    id: user.id,
    email: user.email,
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email,
    image: user.user_metadata?.avatar_url,
  })

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', user.id)
    .order('type', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Error al obtener categorías' }, { status: 500 })
  }

  return NextResponse.json((data ?? []).map(mapCategoryRow))
}

export async function POST(request: Request) {
  const supabaseAuth = createSupabaseRouteClient()
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser()

  if (!user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    await ensureUserAndCategories({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email,
      image: user.user_metadata?.avatar_url,
    })

    const body = await request.json()
    const { name, type, subcategories, color } = body

    if (!name || !type || !['income', 'expense'].includes(type)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('categories')
      .insert({
        user_id: user.id,
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
