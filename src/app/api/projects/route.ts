import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext, getWriteAccess } from '@/lib/workspaces'
import { mapProjectRow, toDateOnly } from '@/lib/projects'

export async function GET() {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

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
    return NextResponse.json(projects)
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
