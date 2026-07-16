import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { mapAppointmentRow } from '@/lib/appointments'
import { track } from '@/lib/analytics'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('agenda')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from') // ISO
    const to = searchParams.get('to') // ISO
    const status = searchParams.get('status')

    const supabase = getSupabaseClient()
    const query = supabase
      .from('appointments')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .order('starts_at', { ascending: true })

    // Por defecto: desde el inicio de hoy.
    const fromDate = from || new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
    query.gte('starts_at', fromDate)
    if (to) query.lte('starts_at', to)
    if (status) query.eq('status', status)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json((data ?? []).map(mapAppointmentRow))
  } catch (error) {
    console.error('GET /api/appointments', error)
    return NextResponse.json({ error: 'Error al obtener citas' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('agenda')) {
      await track('paywall_hit', { userId: ctx.user.id, workspaceId: ctx.workspaceId, props: { module: 'agenda' } })
      return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    }
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para agendar citas' }, { status: 403 })
    }

    const body = await request.json()
    const supabase = getSupabaseClient()

    if (!body.startsAt) return NextResponse.json({ error: 'Indica la fecha y hora' }, { status: 400 })
    const starts = new Date(body.startsAt)
    if (Number.isNaN(starts.getTime())) return NextResponse.json({ error: 'Fecha/hora inválida' }, { status: 400 })

    // Cliente (ficha o texto libre)
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

    // Servicio (autocompleta título/duración/precio si no vienen)
    let serviceId: string | null = null
    let title = typeof body.title === 'string' ? body.title.trim() : ''
    let durationMin = Number(body.durationMin)
    let price = Number(body.price)
    if (body.serviceId) {
      const { data: service } = await supabase
        .from('services')
        .select('id, name, duration_min, price')
        .eq('id', body.serviceId)
        .eq('workspace_id', ctx.workspaceId)
        .maybeSingle()
      if (service) {
        serviceId = service.id
        if (!title) title = service.name
        if (!Number.isFinite(durationMin)) durationMin = Number(service.duration_min)
        if (!Number.isFinite(price)) price = Number(service.price)
      }
    }
    if (!Number.isFinite(durationMin) || durationMin <= 0) durationMin = 30
    if (!Number.isFinite(price)) price = 0

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        workspace_id: ctx.workspaceId,
        user_id: ctx.user.id,
        client_id: clientId,
        client_name: clientName,
        client_phone: clientPhone || null,
        service_id: serviceId,
        title: title || null,
        starts_at: starts.toISOString(),
        duration_min: Math.round(durationMin),
        price,
        status: 'scheduled',
        notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
      })
      .select()
      .single()
    if (error) throw error

    await track('appointment_created', { userId: ctx.user.id, workspaceId: ctx.workspaceId })
    return NextResponse.json(mapAppointmentRow(data), { status: 201 })
  } catch (error) {
    console.error('POST /api/appointments', error)
    return NextResponse.json({ error: 'Error al agendar la cita' }, { status: 500 })
  }
}
