import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'

// Intervalos ocupados de un día (para calcular huecos en el cliente).
export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const supabase = getSupabaseClient()
    const { data: ws } = await supabase
      .from('workspaces')
      .select('id, booking_enabled')
      .eq('booking_token', params.token)
      .maybeSingle()
    if (!ws || !ws.booking_enabled) return NextResponse.json({ taken: [] })

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const staffId = searchParams.get('staffId')
    if (!from || !to) return NextResponse.json({ taken: [] })

    const q = supabase
      .from('appointments')
      .select('starts_at, duration_min, staff_id')
      .eq('workspace_id', ws.id)
      .not('status', 'in', '("cancelled","no_show")')
      .gte('starts_at', from)
      .lte('starts_at', to)
    if (staffId) q.eq('staff_id', staffId)

    const { data, error } = await q
    if (error) throw error
    return NextResponse.json({
      taken: (data ?? []).map(a => ({ startsAt: a.starts_at, durationMin: Number(a.duration_min ?? 30) })),
    })
  } catch (error) {
    console.error(`GET /api/public/booking/${params.token}/day`, error)
    return NextResponse.json({ taken: [] })
  }
}
