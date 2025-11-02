import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { ensureUserAndCategories } from '@/lib/users'
import { mapTransactionRow } from '@/lib/transactions'
import { toDateOnly } from '@/lib/projects'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseAuth = createSupabaseRouteClient()
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser()

    if (!user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: 'Transacción no encontrada' }, { status: 404 })
    }

    return NextResponse.json(mapTransactionRow(data))
  } catch (error) {
    console.error(`GET /api/transactions/${params.id}`, error)
    return NextResponse.json({ error: 'Error al obtener transacción' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const supabase = getSupabaseClient()

    const updates: Record<string, unknown> = {}

    if (body.projectId !== undefined) {
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

      updates.project_id = body.projectId
    }

    if (body.type !== undefined) {
      updates.type = body.type
    }

    if (body.category !== undefined) {
      const { data: categoryRow } = await supabase
        .from('categories')
        .select('id, name, type')
        .eq('user_id', user.id)
        .eq('name', body.category)
        .eq('type', body.type ?? updates.type)
        .maybeSingle()

      updates.category_id = categoryRow?.id ?? null
      updates.category_name = body.category
    }

    if (body.subcategory !== undefined) updates.subcategory = body.subcategory ?? null
    if (body.description !== undefined) updates.description = body.description
    if (body.amount !== undefined) updates.amount = Number(body.amount)
    if (body.date !== undefined) updates.date = toDateOnly(body.date)
    if (body.paymentMethod !== undefined) updates.payment_method = body.paymentMethod
    if (body.reference !== undefined) updates.reference = body.reference ?? null
    if (body.attachments !== undefined) {
      updates.attachments = Array.isArray(body.attachments) ? body.attachments : []
    }
    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json(mapTransactionRow(data))
  } catch (error) {
    console.error(`PUT /api/transactions/${params.id}`, error)
    return NextResponse.json({ error: 'Error al actualizar transacción' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseAuth = createSupabaseRouteClient()
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser()

    if (!user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (error) {
      throw error
    }

    return NextResponse.json({ message: 'Transacción eliminada correctamente' })
  } catch (error) {
    console.error(`DELETE /api/transactions/${params.id}`, error)
    return NextResponse.json({ error: 'Error al eliminar transacción' }, { status: 500 })
  }
}

