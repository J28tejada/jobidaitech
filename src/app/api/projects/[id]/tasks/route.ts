import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext, getWriteAccess, READ_ONLY_ERROR } from '@/lib/workspaces'
import { mapProjectTaskRow, isMissingRelation, toDateOnly } from '@/lib/projects'

// Etapas / partidas de un proyecto: el "¿cómo va la obra?" del rubro.

// El proyecto debe existir en el espacio activo y estar dentro del alcance
// del colaborador. Devuelve la fila o null.
async function findProject(ctx: NonNullable<Awaited<ReturnType<typeof getWorkspaceContext>>>, projectId: string) {
  if (ctx.allowedProjectIds && ctx.allowedProjectIds.indexOf(projectId) === -1) return null

  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  return data ?? null
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const project = await findProject(ctx, params.id)
    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('project_tasks')
      .select('*')
      .eq('project_id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })

    // Si la migración 0044 todavía no se corrió, el detalle del proyecto no
    // debe romperse: simplemente no hay etapas.
    if (error) {
      if (isMissingRelation(error)) return NextResponse.json([])
      throw error
    }

    return NextResponse.json((data ?? []).map(mapProjectTaskRow))
  } catch (error) {
    console.error(`GET /api/projects/${params.id}/tasks`, error)
    return NextResponse.json({ error: 'Error al obtener las etapas del proyecto' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!ctx.canWrite) {
      return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    }
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para editar en este espacio' }, { status: 403 })
    }

    const project = await findProject(ctx, params.id)
    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    const body = await request.json()
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) {
      return NextResponse.json({ error: 'La etapa necesita un nombre' }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    // Siguiente posición: al final de la lista.
    const { data: last } = await supabase
      .from('project_tasks')
      .select('position')
      .eq('project_id', params.id)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data, error } = await supabase
      .from('project_tasks')
      .insert({
        workspace_id: ctx.workspaceId,
        project_id: params.id,
        user_id: ctx.user.id,
        title,
        done: Boolean(body.done),
        due_date: toDateOnly(body.dueDate),
        position: Number(last?.position ?? 0) + 10,
        done_at: body.done ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (error) {
      if (isMissingRelation(error)) {
        return NextResponse.json(
          { error: 'Falta correr la migración 0044_project_tasks.sql en Supabase' },
          { status: 503 }
        )
      }
      throw error
    }

    return NextResponse.json(mapProjectTaskRow(data), { status: 201 })
  } catch (error) {
    console.error(`POST /api/projects/${params.id}/tasks`, error)
    return NextResponse.json({ error: 'Error al crear la etapa' }, { status: 500 })
  }
}
