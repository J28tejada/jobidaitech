import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { track } from '@/lib/analytics'

const VALID = ['draft', 'sent', 'accepted', 'rejected', 'expired']

// Cambiar el estado de una cotización (enviar / aceptar / rechazar…).
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('sales')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para cambiar cotizaciones' }, { status: 403 })
    }

    const body = await request.json()
    const status = body.status
    if (!VALID.includes(status)) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })

    const updates: Record<string, unknown> = { status }
    updates.accepted_at = status === 'accepted' ? new Date().toISOString() : null

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('quotes')
      .update(updates)
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .select('id, status')
      .maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })

    if (status === 'accepted') {
      await track('quote_accepted', { userId: ctx.user.id, workspaceId: ctx.workspaceId, props: { source: 'manual' } })
    }
    return NextResponse.json({ success: true, status })
  } catch (error) {
    console.error(`POST /api/quotes/${params.id}/status`, error)
    return NextResponse.json({ error: 'Error al cambiar el estado' }, { status: 500 })
  }
}
