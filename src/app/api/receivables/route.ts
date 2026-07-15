import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { mapReceivableRow } from '@/lib/receivables'
import { toDateOnly } from '@/lib/projects'
import { track } from '@/lib/analytics'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!ctx.hasModule('receivables')) {
      return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'open' | 'paid' | 'cancelled'

    const supabase = getSupabaseClient()
    const query = supabase
      .from('receivables')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (status) query.eq('status', status)

    const { data, error } = await query
    if (error) throw error

    let rows = data ?? []

    // Alcance por proyecto: un miembro con acceso específico solo ve las
    // cuentas ligadas a sus proyectos (o sin proyecto asignado).
    if (ctx.allowedProjectIds) {
      const allowed = new Set(ctx.allowedProjectIds)
      rows = rows.filter(r => !r.project_id || allowed.has(r.project_id))
    }

    // Sumar abonos por cuenta
    const ids = rows.map(r => r.id)
    const paidByReceivable: Record<string, number> = {}
    if (ids.length > 0) {
      const { data: payments, error: payErr } = await supabase
        .from('receivable_payments')
        .select('receivable_id, amount')
        .in('receivable_id', ids)
      if (payErr) throw payErr
      for (const p of payments ?? []) {
        paidByReceivable[p.receivable_id] = (paidByReceivable[p.receivable_id] ?? 0) + Number(p.amount ?? 0)
      }
    }

    const receivables = rows.map(r => mapReceivableRow(r, paidByReceivable[r.id] ?? 0))
    return NextResponse.json(receivables)
  } catch (error) {
    console.error('GET /api/receivables', error)
    return NextResponse.json({ error: 'Error al obtener cuentas por cobrar' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!ctx.hasModule('receivables')) {
      await track('paywall_hit', {
        userId: ctx.user.id,
        workspaceId: ctx.workspaceId,
        props: { module: 'receivables' },
      })
      return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    }

    if (!ctx.canWrite) {
      return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    }

    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para registrar cobros en este espacio' }, { status: 403 })
    }

    const body = await request.json()
    const client = typeof body.client === 'string' ? body.client.trim() : ''
    const amount = Number(body.amount)

    if (!client || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Cliente y monto son obligatorios' }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    let projectId: string | null = null
    if (body.projectId) {
      // Validar que el proyecto pertenece al espacio (y al alcance del miembro)
      if (ctx.allowedProjectIds && !ctx.allowedProjectIds.includes(body.projectId)) {
        return NextResponse.json({ error: 'No tienes acceso a ese proyecto' }, { status: 403 })
      }
      const { data: project } = await supabase
        .from('projects')
        .select('id')
        .eq('id', body.projectId)
        .eq('workspace_id', ctx.workspaceId)
        .maybeSingle()
      if (!project) {
        return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
      }
      projectId = body.projectId
    }

    const payload = {
      workspace_id: ctx.workspaceId,
      user_id: ctx.user.id,
      project_id: projectId,
      client,
      client_phone: typeof body.clientPhone === 'string' ? body.clientPhone.trim() || null : null,
      description: typeof body.description === 'string' ? body.description.trim() || null : null,
      amount,
      due_date: toDateOnly(body.dueDate),
      status: 'open',
    }

    const { data, error } = await supabase.from('receivables').insert(payload).select().single()
    if (error) throw error

    await track('receivable_created', {
      userId: ctx.user.id,
      workspaceId: ctx.workspaceId,
      props: { amount },
    })

    return NextResponse.json(mapReceivableRow(data, 0), { status: 201 })
  } catch (error) {
    console.error('POST /api/receivables', error)
    return NextResponse.json({ error: 'Error al crear la cuenta por cobrar' }, { status: 500 })
  }
}
