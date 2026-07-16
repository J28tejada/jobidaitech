import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { track } from '@/lib/analytics'

// Convierte una cotización en un proyecto (y, opcionalmente, en una cuenta por
// cobrar por el total). Marca la cotización como aceptada y la liga al proyecto.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('sales')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para convertir cotizaciones' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const supabase = getSupabaseClient()

    const { data: quote } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()
    if (!quote) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
    if (quote.project_id) {
      return NextResponse.json({ error: 'Esta cotización ya fue convertida', projectId: quote.project_id }, { status: 409 })
    }

    const today = new Date().toISOString().slice(0, 10)
    const projectName = quote.title?.trim() || `Cotización ${quote.number ?? ''}`.trim() || 'Proyecto'

    const { data: project, error: projErr } = await supabase
      .from('projects')
      .insert({
        workspace_id: ctx.workspaceId,
        user_id: ctx.user.id,
        name: projectName,
        description: quote.notes ?? null,
        client: quote.client_name || 'Cliente',
        client_id: quote.client_id ?? null,
        status: 'active',
        budget: Number(quote.total ?? 0),
        start_date: today,
      })
      .select('id')
      .single()
    if (projErr) throw projErr

    await supabase
      .from('quotes')
      .update({ status: 'accepted', accepted_at: quote.accepted_at ?? new Date().toISOString(), project_id: project.id })
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)

    // Opcional: crear también la cuenta por cobrar (si el módulo está y se pidió).
    let receivableCreated = false
    if (body.createReceivable && ctx.hasModule('receivables') && Number(quote.total ?? 0) > 0) {
      const { error: rcvErr } = await supabase.from('receivables').insert({
        workspace_id: ctx.workspaceId,
        user_id: ctx.user.id,
        project_id: project.id,
        client: quote.client_name || 'Cliente',
        client_phone: quote.client_phone ?? null,
        description: projectName,
        amount: Number(quote.total ?? 0),
        due_date: quote.valid_until ?? null,
        status: 'open',
      })
      if (!rcvErr) receivableCreated = true
    }

    await track('quote_converted', { userId: ctx.user.id, workspaceId: ctx.workspaceId })
    return NextResponse.json({ success: true, projectId: project.id, receivableCreated }, { status: 201 })
  } catch (error) {
    console.error(`POST /api/quotes/${params.id}/convert`, error)
    return NextResponse.json({ error: 'Error al convertir la cotización' }, { status: 500 })
  }
}
