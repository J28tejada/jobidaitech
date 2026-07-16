import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { mapAppointmentRow } from '@/lib/appointments'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('agenda')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })
    return NextResponse.json(mapAppointmentRow(data))
  } catch (error) {
    console.error(`GET /api/appointments/${params.id}`, error)
    return NextResponse.json({ error: 'Error al obtener la cita' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('agenda')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para editar citas' }, { status: 403 })
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
    if (body.serviceId !== undefined) updates.service_id = body.serviceId || null
    if (body.title !== undefined) updates.title = body.title ? String(body.title).trim() : null
    if (body.startsAt !== undefined) {
      const d = new Date(body.startsAt)
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'Fecha/hora inválida' }, { status: 400 })
      updates.starts_at = d.toISOString()
    }
    if (body.durationMin !== undefined) updates.duration_min = Math.max(1, Math.round(Number(body.durationMin) || 30))
    if (body.price !== undefined) updates.price = Number(body.price) || 0
    if (body.notes !== undefined) updates.notes = body.notes ? String(body.notes).trim() : null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .select()
      .maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })
    return NextResponse.json(mapAppointmentRow(data))
  } catch (error) {
    console.error(`PUT /api/appointments/${params.id}`, error)
    return NextResponse.json({ error: 'Error al actualizar la cita' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('agenda')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para eliminar citas' }, { status: 403 })
    }

    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
    if (error) throw error
    return NextResponse.json({ message: 'Cita eliminada' })
  } catch (error) {
    console.error(`DELETE /api/appointments/${params.id}`, error)
    return NextResponse.json({ error: 'Error al eliminar la cita' }, { status: 500 })
  }
}
