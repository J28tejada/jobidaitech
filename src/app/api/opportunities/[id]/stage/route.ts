import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { track } from '@/lib/analytics'

const STAGES = ['new', 'contacted', 'quoted', 'won', 'lost']

// Cambiar la etapa de una oportunidad. Al ganar, opcionalmente crea un proyecto.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('crm')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para cambiar oportunidades' }, { status: 403 })
    }

    const body = await request.json()
    const stage = body.stage
    if (!STAGES.includes(stage)) return NextResponse.json({ error: 'Etapa inválida' }, { status: 400 })

    const supabase = getSupabaseClient()
    const { data: opp } = await supabase
      .from('opportunities')
      .select('*')
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()
    if (!opp) return NextResponse.json({ error: 'Oportunidad no encontrada' }, { status: 404 })

    const updates: Record<string, unknown> = { stage }
    if (stage === 'lost') {
      updates.lost_reason = typeof body.lostReason === 'string' ? body.lostReason.trim() || null : null
    }

    let projectId: string | null = opp.project_id ?? null
    if (stage === 'won' && body.createProject && !opp.project_id) {
      const today = new Date().toISOString().slice(0, 10)
      const name = opp.title?.trim() || `Venta a ${opp.client_name || 'cliente'}`
      const { data: project, error: projErr } = await supabase
        .from('projects')
        .insert({
          workspace_id: ctx.workspaceId,
          user_id: ctx.user.id,
          name,
          description: opp.notes ?? null,
          client: opp.client_name || 'Cliente',
          client_id: opp.client_id ?? null,
          status: 'active',
          budget: Number(opp.value ?? 0),
          start_date: today,
        })
        .select('id')
        .single()
      if (projErr) throw projErr
      projectId = project.id
      updates.project_id = projectId
    }

    const { error } = await supabase
      .from('opportunities')
      .update(updates)
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
    if (error) throw error

    if (stage === 'won') {
      await track('opportunity_won', { userId: ctx.user.id, workspaceId: ctx.workspaceId, props: { value: Number(opp.value ?? 0) } })
    }
    return NextResponse.json({ success: true, stage, projectId })
  } catch (error) {
    console.error(`POST /api/opportunities/${params.id}/stage`, error)
    return NextResponse.json({ error: 'Error al cambiar la etapa' }, { status: 500 })
  }
}
