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
import { track } from '@/lib/analytics'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('crm')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })

    const { searchParams } = new URL(request.url)
    const stage = searchParams.get('stage')
    const search = (searchParams.get('search') || '').trim()

    const supabase = getSupabaseClient()
    const query = supabase
      .from('opportunities')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .order('next_action_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (stage) query.eq('stage', stage)
    if (search) query.or(`title.ilike.%${search}%,client_name.ilike.%${search}%`)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json((data ?? []).map(row => mapOpportunityRow(row)))
  } catch (error) {
    console.error('GET /api/opportunities', error)
    return NextResponse.json({ error: 'Error al obtener oportunidades' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('crm')) {
      await track('paywall_hit', { userId: ctx.user.id, workspaceId: ctx.workspaceId, props: { module: 'crm' } })
      return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    }
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para crear oportunidades' }, { status: 403 })
    }

    const body = await request.json()
    const supabase = getSupabaseClient()

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
    if (!clientName) return NextResponse.json({ error: 'Indica el cliente o prospecto' }, { status: 400 })

    const stage = ['new', 'contacted', 'quoted', 'won', 'lost'].includes(body.stage) ? body.stage : 'new'

    const { data, error } = await supabase
      .from('opportunities')
      .insert({
        workspace_id: ctx.workspaceId,
        user_id: ctx.user.id,
        client_id: clientId,
        client_name: clientName,
        client_phone: clientPhone || null,
        title: typeof body.title === 'string' ? body.title.trim() || null : null,
        stage,
        value: Number.isFinite(Number(body.value)) ? Number(body.value) : 0,
        source: typeof body.source === 'string' ? body.source.trim() || null : null,
        expected_close: toDateOnly(body.expectedClose),
        next_action: typeof body.nextAction === 'string' ? body.nextAction.trim() || null : null,
        next_action_date: toDateOnly(body.nextActionDate),
        notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
      })
      .select()
      .single()
    if (error) throw error

    await track('opportunity_created', { userId: ctx.user.id, workspaceId: ctx.workspaceId, props: { value: Number(body.value ?? 0) } })
    return NextResponse.json(mapOpportunityRow(data), { status: 201 })
  } catch (error) {
    console.error('POST /api/opportunities', error)
    return NextResponse.json({ error: 'Error al crear la oportunidad' }, { status: 500 })
  }
}
