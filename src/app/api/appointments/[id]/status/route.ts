import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { track } from '@/lib/analytics'

const STATUSES = ['scheduled', 'confirmed', 'done', 'cancelled', 'no_show']

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('agenda')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para cambiar citas' }, { status: 403 })
    }

    const body = await request.json()
    const status = body.status
    if (!STATUSES.includes(status)) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .select('id')
      .maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })

    if (status === 'done') {
      await track('appointment_done', { userId: ctx.user.id, workspaceId: ctx.workspaceId })
    }
    return NextResponse.json({ success: true, status })
  } catch (error) {
    console.error(`POST /api/appointments/${params.id}/status`, error)
    return NextResponse.json({ error: 'Error al cambiar el estado' }, { status: 500 })
  }
}
