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

async function loadQuote(supabase: any, workspaceId: string, id: string) {
  const { data: quote } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (!quote) return null
  const { data: items } = await supabase.from('quote_items').select('*').eq('quote_id', id)
  return mapQuoteRow(quote, items ?? [])
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('sales')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })

    const supabase = getSupabaseClient()
    const quote = await loadQuote(supabase, ctx.workspaceId, params.id)
    if (!quote) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
    return NextResponse.json(quote)
  } catch (error) {
    console.error(`GET /api/quotes/${params.id}`, error)
    return NextResponse.json({ error: 'Error al obtener la cotización' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('sales')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para editar cotizaciones' }, { status: 403 })
    }

    const supabase = getSupabaseClient()
    const { data: existing } = await supabase
      .from('quotes')
      .select('id')
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })

    const body = await request.json()
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
    if (body.notes !== undefined) updates.notes = body.notes ? String(body.notes).trim() : null
    if (body.validUntil !== undefined) updates.valid_until = toDateOnly(body.validUntil)

    // Partidas + totales (si vienen items, se reemplazan)
    let itemsProvided = false
    if (body.items !== undefined) {
      itemsProvided = true
      const items = normalizeItems(body.items)
      if (items.length === 0) return NextResponse.json({ error: 'Agrega al menos una partida' }, { status: 400 })
      const taxEnabled = body.taxEnabled === true
      const taxRate = Number.isFinite(Number(body.taxRate)) ? Number(body.taxRate) : 18
      const totals = computeTotals(items, taxEnabled, taxRate)
      updates.tax_enabled = taxEnabled
      updates.tax_rate = taxRate
      updates.subtotal = totals.subtotal
      updates.tax_amount = totals.taxAmount
      updates.total = totals.total

      await supabase.from('quote_items').delete().eq('quote_id', params.id)
      const itemRows = items.map((it, i) => ({
        quote_id: params.id,
        workspace_id: ctx.workspaceId,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unitPrice,
        position: i,
      }))
      await supabase.from('quote_items').insert(itemRows)
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('quotes')
        .update(updates)
        .eq('id', params.id)
        .eq('workspace_id', ctx.workspaceId)
      if (error) throw error
    } else if (!itemsProvided) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    const quote = await loadQuote(supabase, ctx.workspaceId, params.id)
    return NextResponse.json(quote)
  } catch (error) {
    console.error(`PUT /api/quotes/${params.id}`, error)
    return NextResponse.json({ error: 'Error al actualizar la cotización' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('sales')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para eliminar cotizaciones' }, { status: 403 })
    }

    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('quotes')
      .delete()
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
    if (error) throw error
    return NextResponse.json({ message: 'Cotización eliminada' })
  } catch (error) {
    console.error(`DELETE /api/quotes/${params.id}`, error)
    return NextResponse.json({ error: 'Error al eliminar la cotización' }, { status: 500 })
  }
}
