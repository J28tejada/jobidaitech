import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { ensureUserAndCategories } from '@/lib/users'
import { mapProjectRow, toDateOnly } from '@/lib/projects'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

export async function GET() {
  try {
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
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    const projects = (data ?? []).map(mapProjectRow)
    return NextResponse.json(projects)
  } catch (error) {
    console.error('GET /api/projects', error)
    return NextResponse.json({ error: 'Error al obtener proyectos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json()

    if (!body.name || !body.client || !body.startDate || !body.budget) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: body.name,
        description: body.description ?? '',
        client: body.client,
        start_date: toDateOnly(body.startDate),
        end_date: toDateOnly(body.endDate),
        status: body.status || 'active',
        budget: Number(body.budget),
        initial_payment: body.initialPayment ? Number(body.initialPayment) : null,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    const project = mapProjectRow(data)

    // Si hay un abono inicial, crear automáticamente una transacción de ingreso
    if (body.initialPayment && Number(body.initialPayment) > 0) {
      // Obtener la categoría "Anticipo" del usuario
      const { data: categories } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('type', 'income')
        .ilike('name', '%anticipo%')
        .limit(1)

      const advanceCategory = categories && categories.length > 0 ? categories[0] : null

      if (advanceCategory) {
        // Crear la transacción de ingreso automáticamente
        await supabase.from('transactions').insert({
          user_id: user.id,
          project_id: project.id,
          type: 'income',
          category_id: advanceCategory.id,
          category_name: advanceCategory.name,
          subcategory: null,
          description: `Anticipo inicial del proyecto ${body.name}`,
          amount: Number(body.initialPayment),
          date: toDateOnly(body.startDate) || new Date().toISOString().split('T')[0],
          payment_method: 'bank_transfer',
          reference: null,
          attachments: [],
        })
      }
    }

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('POST /api/projects', error)
    return NextResponse.json({ error: 'Error al crear proyecto' }, { status: 500 })
  }
}

