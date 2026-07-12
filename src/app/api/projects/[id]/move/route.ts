import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { canManageWorkspace, getMembershipRole, getWorkspaceContext, READ_ONLY_ERROR } from '@/lib/workspaces'

// Mover un proyecto (con sus transacciones) del espacio activo a otro espacio del usuario.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  if (!ctx.canWrite) {
    return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
  }

  // Debe poder administrar el espacio de ORIGEN (admin o dueño)
  if (!canManageWorkspace(ctx.role)) {
    return NextResponse.json({ error: 'No tienes permiso para mover proyectos de este espacio' }, { status: 403 })
  }

  // Respetar alcance por proyecto
  if (ctx.allowedProjectIds && !ctx.allowedProjectIds.includes(params.id)) {
    return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
  }

  try {
    const body = await request.json()
    const targetWorkspaceId = typeof body.targetWorkspaceId === 'string' ? body.targetWorkspaceId : ''

    if (!targetWorkspaceId) {
      return NextResponse.json({ error: 'Falta el espacio destino' }, { status: 400 })
    }
    if (targetWorkspaceId === ctx.workspaceId) {
      return NextResponse.json({ error: 'El proyecto ya está en ese espacio' }, { status: 400 })
    }

    // Debe poder administrar el espacio DESTINO
    const targetRole = await getMembershipRole(ctx.user.id, targetWorkspaceId)
    if (!targetRole || !canManageWorkspace(targetRole)) {
      return NextResponse.json({ error: 'No tienes permiso para agregar proyectos a ese espacio' }, { status: 403 })
    }

    const supabase = getSupabaseClient()

    // El proyecto debe pertenecer al espacio activo (origen)
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    const { error } = await supabase.rpc('move_project', {
      p_project_id: params.id,
      p_target_workspace: targetWorkspaceId,
    })

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/projects/[id]/move', error)
    return NextResponse.json({ error: 'Error al mover el proyecto' }, { status: 500 })
  }
}
