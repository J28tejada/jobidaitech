import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { canManageWorkspace, getWorkspaceContext, READ_ONLY_ERROR } from '@/lib/workspaces'

// Crear una transferencia de proyectos hacia otra cuenta (por correo).
export async function POST(request: Request) {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  if (!ctx.canWrite) {
    return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
  }

  if (!canManageWorkspace(ctx.role)) {
    return NextResponse.json({ error: 'No tienes permiso para transferir proyectos de este espacio' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const targetEmail = typeof body.targetEmail === 'string' ? body.targetEmail.trim().toLowerCase() : ''
    const allProjects = Boolean(body.allProjects)
    const projectId = typeof body.projectId === 'string' ? body.projectId : ''

    if (!targetEmail || !targetEmail.includes('@')) {
      return NextResponse.json({ error: 'Correo destino inválido' }, { status: 400 })
    }
    if (targetEmail === (ctx.user.email ?? '').toLowerCase()) {
      return NextResponse.json({ error: 'Ese es tu propio correo. Usa un correo distinto.' }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    // Determinar los proyectos a transferir (del espacio activo)
    let projectIds: string[] = []
    if (allProjects) {
      const query = supabase.from('projects').select('id').eq('workspace_id', ctx.workspaceId)
      if (ctx.allowedProjectIds) query.in('id', ctx.allowedProjectIds)
      const { data } = await query
      projectIds = (data ?? []).map((p: { id: string }) => p.id)
    } else {
      if (!projectId) {
        return NextResponse.json({ error: 'Falta el proyecto' }, { status: 400 })
      }
      if (ctx.allowedProjectIds && !ctx.allowedProjectIds.includes(projectId)) {
        return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
      }
      const { data: project } = await supabase
        .from('projects')
        .select('id')
        .eq('id', projectId)
        .eq('workspace_id', ctx.workspaceId)
        .maybeSingle()
      if (!project) {
        return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
      }
      projectIds = [projectId]
    }

    if (projectIds.length === 0) {
      return NextResponse.json({ error: 'No hay proyectos para transferir' }, { status: 400 })
    }

    const { data: transfer, error } = await supabase
      .from('account_transfers')
      .insert({
        from_user_id: ctx.user.id,
        from_workspace_id: ctx.workspaceId,
        to_email: targetEmail,
        project_ids: projectIds,
      })
      .select('token')
      .single()

    if (error || !transfer) {
      throw error ?? new Error('No se pudo crear la transferencia')
    }

    const origin = new URL(request.url).origin
    const link = `${origin}/transferir?token=${transfer.token}`

    return NextResponse.json({ link, token: transfer.token, count: projectIds.length }, { status: 201 })
  } catch (error) {
    console.error('POST /api/transfers', error)
    return NextResponse.json({ error: 'Error al crear la transferencia' }, { status: 500 })
  }
}
