import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext, getWriteAccess, READ_ONLY_ERROR } from '@/lib/workspaces'
import { mapTransactionRow } from '@/lib/transactions'
import { toDateOnly } from '@/lib/projects'
import { track } from '@/lib/analytics'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const type = searchParams.get('type') // 'income' | 'expense'
    const category = searchParams.get('category')
    const from = searchParams.get('from') // YYYY-MM-DD
    const to = searchParams.get('to') // YYYY-MM-DD
    const search = (searchParams.get('search') || '').trim()

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const pageSize = Math.min(1000, Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10) || 25))
    const offset = (page - 1) * pageSize

    const supabase = getSupabaseClient()
    const query = supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('workspace_id', ctx.workspaceId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (projectId) query.eq('project_id', projectId)
    if (type === 'income' || type === 'expense') query.eq('type', type)
    if (category) query.eq('category_name', category)
    if (from) query.gte('date', from)
    if (to) query.lte('date', to)
    if (search) query.or(`description.ilike.%${search}%,category_name.ilike.%${search}%`)

    // Alcance por proyecto
    if (ctx.allowedProjectIds) {
      query.in('project_id', ctx.allowedProjectIds)
    }

    query.range(offset, offset + pageSize - 1)

    const { data, error, count } = await query
    if (error) throw error

    const items = (data ?? []).map(mapTransactionRow)
    return NextResponse.json({ items, total: count ?? items.length, page, pageSize })
  } catch (error) {
    console.error('GET /api/transactions', error)
    return NextResponse.json({ error: 'Error al obtener transacciones' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!ctx.canWrite) {
      return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    }

    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para registrar transacciones en este espacio' }, { status: 403 })
    }

    const body = await request.json()

    if (!body.projectId || !body.type || !body.category || !body.description || !body.amount || !body.date) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    if (ctx.allowedProjectIds && !ctx.allowedProjectIds.includes(body.projectId)) {
      return NextResponse.json({ error: 'No tienes acceso a ese proyecto' }, { status: 403 })
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', body.projectId)
      .eq('workspace_id', ctx.workspaceId)
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
      .eq('workspace_id', ctx.workspaceId)
      .eq('name', body.category)
      .eq('type', body.type)
      .maybeSingle()

    const payload = {
      workspace_id: ctx.workspaceId,
      user_id: ctx.user.id,
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

    await track('transaction_created', {
      userId: ctx.user.id,
      workspaceId: ctx.workspaceId,
      props: { type: body.type },
    })

    return NextResponse.json(mapTransactionRow(data), { status: 201 })
  } catch (error) {
    console.error('POST /api/transactions', error)
    return NextResponse.json({ error: 'Error al crear transacción' }, { status: 500 })
  }
}
