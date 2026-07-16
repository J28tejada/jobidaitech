import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { mapQuoteRow } from '@/lib/quotes'

// Vista pública de una cotización por token (sin sesión). Solo lectura.
export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const supabase = getSupabaseClient()
    const { data: quote, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('token', params.token)
      .maybeSingle()
    if (error) throw error
    if (!quote) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })

    const { data: items } = await supabase.from('quote_items').select('*').eq('quote_id', quote.id)
    const { data: ws } = await supabase
      .from('workspaces')
      .select('name, currency, locale')
      .eq('id', quote.workspace_id)
      .maybeSingle()

    const mapped = mapQuoteRow(quote, items ?? [])
    return NextResponse.json({
      quote: {
        number: mapped.number,
        title: mapped.title,
        clientName: mapped.clientName,
        notes: mapped.notes,
        status: mapped.status,
        taxEnabled: mapped.taxEnabled,
        taxRate: mapped.taxRate,
        subtotal: mapped.subtotal,
        taxAmount: mapped.taxAmount,
        total: mapped.total,
        validUntil: mapped.validUntil,
        acceptedAt: mapped.acceptedAt,
        items: mapped.items,
      },
      business: { name: ws?.name ?? 'Negocio' },
      currency: ws?.currency ?? 'DOP',
      locale: ws?.locale ?? 'es-DO',
    })
  } catch (error) {
    console.error(`GET /api/public/quotes/${params.token}`, error)
    return NextResponse.json({ error: 'Error al cargar la cotización' }, { status: 500 })
  }
}
