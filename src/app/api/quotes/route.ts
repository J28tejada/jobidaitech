import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { mapQuoteRow, computeTotals, normalizeItems } from '@/lib/quotes'
import { toDateOnly } from '@/lib/projects'
import { track } from '@/lib/analytics'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('sales')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const supabase = getSupabaseClient()
    const query = supabase
      .from('quotes')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })
    if (status) query.eq('status', status)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json((data ?? []).map(row => mapQuoteRow(row)))
  } catch (error) {
    console.error('GET /api/quotes', error)
    return NextResponse.json({ error: 'Error al obtener cotizaciones' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('sales')) {
      await track('paywall_hit', { userId: ctx.user.id, workspaceId: ctx.workspaceId, props: { module: 'sales' } })
      return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    }
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para crear cotizaciones' }, { status: 403 })
    }

    const body = await request.json()
    const supabase = getSupabaseClient()

    // Resolver cliente (por id ligado, o snapshot por texto)
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

    const items = normalizeItems(body.items)
    if (items.length === 0) return NextResponse.json({ error: 'Agrega al menos una partida' }, { status: 400 })

    const taxEnabled = body.taxEnabled === true
    const taxRate = Number.isFinite(Number(body.taxRate)) ? Number(body.taxRate) : 18
    const totals = computeTotals(items, taxEnabled, taxRate)

    // Número correlativo por espacio (best-effort).
    const { count } = await supabase
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId)
    const number = `COT-${String((count ?? 0) + 1).padStart(4, '0')}`

    const { data: quote, error } = await supabase
      .from('quotes')
      .insert({
        workspace_id: ctx.workspaceId,
        user_id: ctx.user.id,
        client_id: clientId,
        client_name: clientName,
        client_phone: clientPhone || null,
        number,
        title: typeof body.title === 'string' ? body.title.trim() || null : null,
        notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
        status: 'draft',
        tax_enabled: taxEnabled,
        tax_rate: taxRate,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        total: totals.total,
        valid_until: toDateOnly(body.validUntil),
      })
      .select()
      .single()
    if (error) throw error

    const itemRows = items.map((it, i) => ({
      quote_id: quote.id,
      workspace_id: ctx.workspaceId,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unitPrice,
      position: i,
    }))
    const { data: savedItems, error: itemsErr } = await supabase.from('quote_items').insert(itemRows).select()
    if (itemsErr) throw itemsErr

    await track('quote_created', { userId: ctx.user.id, workspaceId: ctx.workspaceId, props: { total: totals.total } })
    return NextResponse.json(mapQuoteRow(quote, savedItems ?? []), { status: 201 })
  } catch (error) {
    console.error('POST /api/quotes', error)
    return NextResponse.json({ error: 'Error al crear la cotización' }, { status: 500 })
  }
}
