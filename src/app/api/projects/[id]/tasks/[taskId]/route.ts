import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext, getWriteAccess, READ_ONLY_ERROR } from '@/lib/workspaces'
import { mapProjectTaskRow, isMissingRelation, toDateOnly } from '@/lib/projects'

// Marcar hecha / renombrar / reprogramar una etapa del proyecto.
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!ctx.canWrite) {
      return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    }

    const access = getWriteAccess(ctx.role)
    if (!access.allowed) {
      return NextResponse.json({ error: 'No tienes permiso para editar en este espacio' }, { status: 403 })
    }
    if (ctx.allowedProjectIds && ctx.allowedProjectIds.indexOf(params.id) === -1) {
      return NextResponse.json({ error: 'Proyecto no encontrado o sin permiso' }, { status: 404 })
    }

    const body = await request.json()
    const updates: Record<string, unknown> = {}

    if (body.title !== undefined) {
      const title = typeof body.title === 'string' ? body.title.trim() : ''
      if (!title) {
        return NextResponse.json({ error: 'La etapa necesita un nombre' }, { status: 400 })
      }
      updates.title = title
    }
    if (body.done !== undefined) {
      updates.done = Boolean(body.done)
      // Guardamos cuándo se completó para poder contar avance por fecha luego.
      updates.done_at = body.done ? new Date().toISOString() : null
    }
    if (body.dueDate !== undefined) updates.due_date = toDateOnly(body.dueDate)
    if (body.position !== undefined) updates.position = Number(body.position)

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    const supabase = getSupabaseClient()
    const query = supabase
      .from('project_tasks')
      .update(updates)
      .eq('id', params.taskId)
      .eq('project_id', params.id)
      .eq('workspace_id', ctx.workspaceId)

    // 'member' (Colaborador) solo edita lo que él creó, igual que en transacciones.
    if (access.ownOnly) {
      query.eq('user_id', ctx.user.id)
    }

    const { data, error } = await query.select().maybeSingle()

    if (error) {
      if (isMissingRelation(error)) {
        return NextResponse.json(
          { error: 'Falta correr la migración 0044_project_tasks.sql en Supabase' },
          { status: 503 }
        )
      }
      throw error
    }
    if (!data) {
      return NextResponse.json({ error: 'Etapa no encontrada o sin permiso' }, { status: 404 })
    }

    return NextResponse.json(mapProjectTaskRow(data))
  } catch (error) {
    console.error(`PUT /api/projects/${params.id}/tasks/${params.taskId}`, error)
    return NextResponse.json({ error: 'Error al actualizar la etapa' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!ctx.canWrite) {
      return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    }

    const access = getWriteAccess(ctx.role)
    if (!access.allowed) {
      return NextResponse.json({ error: 'No tienes permiso para eliminar en este espacio' }, { status: 403 })
    }
    if (ctx.allowedProjectIds && ctx.allowedProjectIds.indexOf(params.id) === -1) {
      return NextResponse.json({ error: 'Proyecto no encontrado o sin permiso' }, { status: 404 })
    }

    const supabase = getSupabaseClient()
    const query = supabase
      .from('project_tasks')
      .delete()
      .eq('id', params.taskId)
      .eq('project_id', params.id)
      .eq('workspace_id', ctx.workspaceId)

    if (access.ownOnly) {
      query.eq('user_id', ctx.user.id)
    }

    const { error } = await query

    if (error) {
      if (isMissingRelation(error)) {
        return NextResponse.json(
          { error: 'Falta correr la migración 0044_project_tasks.sql en Supabase' },
          { status: 503 }
        )
      }
      throw error
    }

    return NextResponse.json({ message: 'Etapa eliminada' })
  } catch (error) {
    console.error(`DELETE /api/projects/${params.id}/tasks/${params.taskId}`, error)
    return NextResponse.json({ error: 'Error al eliminar la etapa' }, { status: 500 })
  }
}
