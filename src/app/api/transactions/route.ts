import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { ensureUserAndCategories } from '@/lib/users'
import { mapTransactionRow } from '@/lib/transactions'
import { toDateOnly } from '@/lib/projects'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    const supabase = getSupabaseClient()
    const query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (projectId) {
      query.eq('project_id', projectId)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    const transactions = (data ?? []).map(mapTransactionRow)
    return NextResponse.json(transactions)
  } catch (error) {
    console.error('GET /api/transactions', error)
    return NextResponse.json({ error: 'Error al obtener transacciones' }, { status: 500 })
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

    if (!body.projectId || !body.type || !body.category || !body.description || !body.amount || !body.date) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', body.projectId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (projectError) {
      throw projectError
    }

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    const { data: categoryRow } = await supabase
      .from('categories')
      .select('id, name, type')
      .eq('user_id', user.id)
      .eq('name', body.category)
      .eq('type', body.type)
      .maybeSingle()

    const payload = {
      user_id: user.id,
      project_id: body.projectId,
      type: body.type,
      category_id: categoryRow?.id ?? null,
      category_name: body.category,
      subcategory: body.subcategory ?? null,
      description: body.description,
      amount: Number(body.amount),
      date: toDateOnly(body.date),
      payment_method: body.paymentMethod || 'cash',
      reference: body.reference ?? null,
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert(payload)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json(mapTransactionRow(data), { status: 201 })
  } catch (error) {
    console.error('POST /api/transactions', error)
    return NextResponse.json({ error: 'Error al crear transacción' }, { status: 500 })
  }
}

