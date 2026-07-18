import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext } from '@/lib/workspaces'
import { mapAppointmentRow } from '@/lib/appointments'

// Historial de visitas (citas) de un cliente + resumen para su ficha.
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('client_id', params.id)
      .order('starts_at', { ascending: false })
      .limit(100)
    if (error) throw error

    const appts = (data ?? []).map(mapAppointmentRow)
    const done = appts.filter(a => a.status === 'done')
    const totalSpent = done.reduce((s, a) => s + a.price + a.tip, 0)
    const lastVisit = done.length > 0 ? done[0].startsAt : null

    // Barbero más frecuente (entre las atendidas con barbero).
    const counts = new Map<string, number>()
    for (const a of done) {
      if (a.staffName) counts.set(a.staffName, (counts.get(a.staffName) ?? 0) + 1)
    }
    let favoriteBarber: string | null = null
    let max = 0
    counts.forEach((n, name) => {
      if (n > max) { max = n; favoriteBarber = name }
    })

    return NextResponse.json({
      appointments: appts,
      summary: {
        visitCount: done.length,
        totalSpent,
        lastVisit,
        favoriteBarber,
      },
    })
  } catch (error) {
    console.error('GET /api/clients/[id]/history', error)
    return NextResponse.json({ error: 'Error al obtener el historial' }, { status: 500 })
  }
}
