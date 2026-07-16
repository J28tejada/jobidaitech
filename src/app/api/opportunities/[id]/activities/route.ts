import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { mapActivityRow } from '@/lib/opportunities'
import { toDateOnly } from '@/lib/projects'
import { track } from '@/lib/analytics'

const TYPES = ['note', 'call', 'message', 'meeting', 'whatsapp']

// Registrar una actividad/seguimiento y, opcionalmente, actualizar la próxima acción.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('crm')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para registrar seguimientos' }, { status: 403 })
    }

    const supabase = getSupabaseClient()
    const { data: opp } = await supabase
      .from('opportunities')
      .select('id')
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()
    if (!opp) return NextResponse.json({ error: 'Oportunidad no encontrada' }, { status: 404 })

    const body = await request.json()
    const type = TYPES.includes(body.type) ? body.type : 'note'
    const bodyText = typeof body.body === 'string' ? body.body.trim() : ''

    const { data: activity, error } = await supabase
      .from('opportunity_activities')
      .insert({
        opportunity_id: params.id,
        workspace_id: ctx.workspaceId,
        user_id: ctx.user.id,
        type,
        body: bodyText || null,
      })
      .select()
      .single()
    if (error) throw error

    // Actualizar la próxima acción si viene en el cuerpo.
    const oppUpdates: Record<string, unknown> = {}
    if (body.nextAction !== undefined) oppUpdates.next_action = body.nextAction ? String(body.nextAction).trim() : null
    if (body.nextActionDate !== undefined) oppUpdates.next_action_date = toDateOnly(body.nextActionDate)
    if (Object.keys(oppUpdates).length > 0) {
      await supabase.from('opportunities').update(oppUpdates).eq('id', params.id).eq('workspace_id', ctx.workspaceId)
    }

    await track('activity_logged', { userId: ctx.user.id, workspaceId: ctx.workspaceId, props: { type } })
    return NextResponse.json(mapActivityRow(activity), { status: 201 })
  } catch (error) {
    console.error(`POST /api/opportunities/${params.id}/activities`, error)
    return NextResponse.json({ error: 'Error al registrar el seguimiento' }, { status: 500 })
  }
}
