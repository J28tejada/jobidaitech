import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { ensureUserAndCategories } from '@/lib/users'
import { mapProjectRow, toDateOnly } from '@/lib/projects'
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
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    return NextResponse.json(mapProjectRow(data))
  } catch (error) {
    console.error(`GET /api/projects/${params.id}`, error)
    return NextResponse.json({ error: 'Error al obtener proyecto' }, { status: 500 })
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

    const body = await request.json()

    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description
    if (body.client !== undefined) updates.client = body.client
    if (body.status !== undefined) updates.status = body.status
    if (body.budget !== undefined) updates.budget = Number(body.budget)
    if (body.initialPayment !== undefined) updates.initial_payment = body.initialPayment ? Number(body.initialPayment) : null
    if (body.startDate !== undefined) updates.start_date = toDateOnly(body.startDate)
    if (body.endDate !== undefined) updates.end_date = toDateOnly(body.endDate)
    updates.updated_at = new Date().toISOString()

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json(mapProjectRow(data))
  } catch (error) {
    console.error(`PUT /api/projects/${params.id}`, error)
    return NextResponse.json({ error: 'Error al actualizar proyecto' }, { status: 500 })
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
      .from('projects')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (error) {
      throw error
    }

    return NextResponse.json({ message: 'Proyecto eliminado correctamente' })
  } catch (error) {
    console.error(`DELETE /api/projects/${params.id}`, error)
    return NextResponse.json({ error: 'Error al eliminar proyecto' }, { status: 500 })
  }
}

