import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'

// Intervalos ocupados de un día + capacidad del negocio (para calcular huecos
// en el cliente). La capacidad = cantidad de barberos activos (mínimo 1). Un
// horario se considera lleno si ya hay tantas citas solapadas como capacidad.
export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const supabase = getSupabaseClient()
    // El identificador puede ser el token largo o el slug corto de la barbería.
    let { data: ws } = await supabase
      .from('workspaces')
      .select('id, booking_enabled')
      .eq('booking_token', params.token)
      .maybeSingle()
    if (!ws) {
      const bySlug = await supabase
        .from('workspaces')
        .select('id, booking_enabled')
        .ilike('booking_slug', params.token)
        .maybeSingle()
      ws = bySlug.data ?? null
    }
    if (!ws || !ws.booking_enabled) return NextResponse.json({ taken: [], capacity: 1 })

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    if (!from || !to) return NextResponse.json({ taken: [], capacity: 1 })

    // Capacidad = nº de barberos activos (mínimo 1 si no hay barberos: la
    // barbería es "una silla"). Determina cuántas citas simultáneas caben.
    const { count: staffCount } = await supabase
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ws.id)
      .eq('active', true)
    const capacity = Math.max(1, staffCount ?? 0)

    // Devolvemos TODAS las citas del día (de cualquier barbero, incluidas las
    // "Sin preferencia" sin barbero asignado). El cliente decide con capacity.
    const { data, error } = await supabase
      .from('appointments')
      .select('starts_at, duration_min, staff_id')
      .eq('workspace_id', ws.id)
      .in('status', ['scheduled', 'confirmed', 'done'])
      .gte('starts_at', from)
      .lte('starts_at', to)
    if (error) throw error

    return NextResponse.json({
      capacity,
      taken: (data ?? []).map(a => ({ startsAt: a.starts_at, durationMin: Number(a.duration_min ?? 30), staffId: a.staff_id ?? null })),
    })
  } catch (error) {
    console.error(`GET /api/public/booking/${params.token}/day`, error)
    return NextResponse.json({ taken: [], capacity: 1 })
  }
}
