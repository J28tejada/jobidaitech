import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { track } from '@/lib/analytics'

// Aceptación pública de una cotización por token (sin sesión).
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const supabase = getSupabaseClient()
    const { data: quote } = await supabase
      .from('quotes')
      .select('id, workspace_id, status')
      .eq('token', params.token)
      .maybeSingle()
    if (!quote) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })

    if (quote.status === 'accepted') {
      return NextResponse.json({ success: true, status: 'accepted' })
    }
    if (quote.status === 'rejected' || quote.status === 'expired') {
      return NextResponse.json({ error: 'Esta cotización ya no está disponible' }, { status: 409 })
    }

    const { error } = await supabase
      .from('quotes')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', quote.id)
    if (error) throw error

    await track('quote_accepted', { workspaceId: quote.workspace_id, props: { source: 'public' } })
    return NextResponse.json({ success: true, status: 'accepted' })
  } catch (error) {
    console.error(`POST /api/public/quotes/${params.token}/accept`, error)
    return NextResponse.json({ error: 'No se pudo aceptar la cotización' }, { status: 500 })
  }
}
