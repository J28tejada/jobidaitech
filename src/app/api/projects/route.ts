import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext, getWriteAccess, READ_ONLY_ERROR } from '@/lib/workspaces'
import { mapProjectRow, toDateOnly, computeProjectTotals, isMissingRelation } from '@/lib/projects'
import { track } from '@/lib/analytics'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // `?totals=1` agrega la rentabilidad y el avance de cada proyecto. Es
    // opt-in porque los selectores de proyecto (formularios, mover, etc.) no
    // necesitan ese cálculo extra.
    const withTotals = new URL(request.url).searchParams.get('totals') === '1'

    const supabase = getSupabaseClient()
    const query = supabase
      .from('projects')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })

    // Alcance por proyecto: el colaborador restringido solo ve los asignados
    if (ctx.allowedProjectIds) {
      query.in('id', ctx.allowedProjectIds)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    const projects = (data ?? []).map(mapProjectRow)

    if (!withTotals || projects.length === 0) {
      return NextResponse.json(projects)
    }

    const ids = projects.map((p) => p.id)

    const [txRes, taskRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('project_id, type, amount')
        .eq('workspace_id', ctx.workspaceId)
        .in('project_id', ids),
      supabase
        .from('project_tasks')
        .select('project_id, done')
        .eq('workspace_id', ctx.workspaceId)
        .in('project_id', ids),
    ])

    if (txRes.error) throw txRes.error
    // La migración 0044 la corre el dueño a mano: si aún no está, seguimos
    // sin avance en lugar de romper la lista de proyectos.
    if (taskRes.error && !isMissingRelation(taskRes.error)) throw taskRes.error

    const income: Record<string, number> = {}
    const expenses: Record<string, number> = {}
    ;(txRes.data ?? []).forEach((row: any) => {
      const key = row.project_id
      if (!key) return
      const amount = Number(row.amount ?? 0)
      if (row.type === 'income') income[key] = (income[key] ?? 0) + amount
      else expenses[key] = (expenses[key] ?? 0) + amount
    })

    const tasksTotal: Record<string, number> = {}
    const tasksDone: Record<string, number> = {}
    ;(taskRes.data ?? []).forEach((row: any) => {
      const key = row.project_id
      if (!key) return
      tasksTotal[key] = (tasksTotal[key] ?? 0) + 1
      if (row.done) tasksDone[key] = (tasksDone[key] ?? 0) + 1
    })

    const withStats = projects.map((p) => ({
      ...p,
      totals: computeProjectTotals(
        p.budget,
        income[p.id] ?? 0,
        expenses[p.id] ?? 0,
        tasksTotal[p.id] ?? 0,
        tasksDone[p.id] ?? 0
      ),
    }))

    return NextResponse.json(withStats)
  } catch (error) {
    console.error('GET /api/projects', error)
    return NextResponse.json({ error: 'Error al obtener proyectos' }, { status: 500 })
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
      return NextResponse.json({ error: 'No tienes permiso para crear proyectos en este espacio' }, { status: 403 })
    }

    const body = await request.json()

    if (!body.name || !body.client || !body.startDate || !body.budget) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('projects')
      .insert({
        workspace_id: ctx.workspaceId,
        user_id: ctx.user.id,
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

    await track('project_created', { userId: ctx.user.id, workspaceId: ctx.workspaceId })

    // Si el colaborador tiene alcance restringido, auto-asignarle el proyecto que acaba de crear
    if (ctx.scope === 'specific' && ctx.membershipId) {
      await supabase.from('member_projects').insert({ member_id: ctx.membershipId, project_id: project.id })
    }

    // Si hay un abono inicial, crear automáticamente una transacción de ingreso
    if (body.initialPayment && Number(body.initialPayment) > 0) {
      // Obtener la categoría "Anticipo" del espacio activo
      const { data: categories } = await supabase
        .from('categories')
        .select('id, name')
        .eq('workspace_id', ctx.workspaceId)
        .eq('type', 'income')
        .ilike('name', '%anticipo%')
        .limit(1)

      const advanceCategory = categories && categories.length > 0 ? categories[0] : null

      if (advanceCategory) {
        // Crear la transacción de ingreso automáticamente
        await supabase.from('transactions').insert({
          workspace_id: ctx.workspaceId,
          user_id: ctx.user.id,
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
