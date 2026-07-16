import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { mapOpportunityRow } from '@/lib/opportunities'
import { toDateOnly } from '@/lib/projects'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('crm')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('opportunities')
      .select('*')
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Oportunidad no encontrada' }, { status: 404 })

    const { data: activities } = await supabase
      .from('opportunity_activities')
      .select('*')
      .eq('opportunity_id', params.id)
      .order('created_at', { ascending: false })

    return NextResponse.json(mapOpportunityRow(data, activities ?? []))
  } catch (error) {
    console.error(`GET /api/opportunities/${params.id}`, error)
    return NextResponse.json({ error: 'Error al obtener la oportunidad' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('crm')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para editar oportunidades' }, { status: 403 })
    }

    const body = await request.json()
    const supabase = getSupabaseClient()
    const updates: Record<string, unknown> = {}

    if (body.clientId !== undefined || body.clientName !== undefined) {
      let clientId: string | null = null
      let clientName = typeof body.clientName === 'string' ? body.clientName.trim() : ''
      let clientPhone = typeof body.clientPhone === 'string' ? body.clientPhone.trim() : ''
      if (body.clientId) {
        const { data: client } = await supabase
          .from('clients')
          .select('id, name, phone')
          .eq('id', body.clientId)
          .eq('workspace_id', ctx.workspaceId)
          .maybeSingle()
        if (client) {
          clientId = client.id
          clientName = client.name
          clientPhone = client.phone ?? clientPhone
        }
      }
      if (!clientName) return NextResponse.json({ error: 'Indica el cliente' }, { status: 400 })
      updates.client_id = clientId
      updates.client_name = clientName
      updates.client_phone = clientPhone || null
    }
    if (body.title !== undefined) updates.title = body.title ? String(body.title).trim() : null
    if (body.value !== undefined) updates.value = Number(body.value) || 0
    if (body.source !== undefined) updates.source = body.source ? String(body.source).trim() : null
    if (body.expectedClose !== undefined) updates.expected_close = toDateOnly(body.expectedClose)
    if (body.nextAction !== undefined) updates.next_action = body.nextAction ? String(body.nextAction).trim() : null
    if (body.nextActionDate !== undefined) updates.next_action_date = toDateOnly(body.nextActionDate)
    if (body.notes !== undefined) updates.notes = body.notes ? String(body.notes).trim() : null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('opportunities')
      .update(updates)
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .select()
      .maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Oportunidad no encontrada' }, { status: 404 })
    return NextResponse.json(mapOpportunityRow(data))
  } catch (error) {
    console.error(`PUT /api/opportunities/${params.id}`, error)
    return NextResponse.json({ error: 'Error al actualizar la oportunidad' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('crm')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para eliminar oportunidades' }, { status: 403 })
    }

    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('opportunities')
      .delete()
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
    if (error) throw error
    return NextResponse.json({ message: 'Oportunidad eliminada' })
  } catch (error) {
    console.error(`DELETE /api/opportunities/${params.id}`, error)
    return NextResponse.json({ error: 'Error al eliminar la oportunidad' }, { status: 500 })
  }
}
