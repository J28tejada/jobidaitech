import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { createSupabaseRouteClient } from '@/lib/supabase-route'
import { track } from '@/lib/analytics'

const PLANS = ['basico', 'negocio', 'pro']
const CYCLES = ['monthly', 'annual']

// Captura pública de una solicitud de plan (desde /planes). No requiere sesión.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const whatsapp = typeof body.whatsapp === 'string' ? body.whatsapp.trim() : ''
    const plan = PLANS.includes(body.plan) ? body.plan : null
    const cycle = CYCLES.includes(body.cycle) ? body.cycle : 'monthly'

    if (!name || !whatsapp) {
      return NextResponse.json({ error: 'Indica tu nombre y WhatsApp' }, { status: 400 })
    }

    // Vincular al usuario si hay sesión (opcional).
    let userId: string | null = null
    try {
      const auth = createSupabaseRouteClient()
      const { data } = await auth.auth.getUser()
      userId = data.user?.id ?? null
    } catch {
      /* visitante sin sesión */
    }

    const supabase = getSupabaseClient()
    const { error } = await supabase.from('plan_requests').insert({
      user_id: userId,
      name,
      whatsapp,
      business: typeof body.business === 'string' ? body.business.trim() || null : null,
      plan,
      cycle,
      message: typeof body.message === 'string' ? body.message.trim() || null : null,
    })
    if (error) throw error

    await track('plan_request', { userId, props: { plan, cycle } })
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/plan-requests', error)
    return NextResponse.json({ error: 'No se pudo enviar la solicitud' }, { status: 500 })
  }
}
