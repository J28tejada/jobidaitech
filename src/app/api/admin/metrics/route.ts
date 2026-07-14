import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext } from '@/lib/workspaces'

// KPIs simples para el panel de administración (solo administrador).
export async function GET() {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!ctx.isAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const supabase = getSupabaseClient()
    const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString()

    const [{ count: totalUsers }, { count: newUsers7d }, { count: newLeads }, { data: events }] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', since7),
      supabase.from('service_leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      supabase.from('app_events').select('event, user_id').gte('created_at', since30),
    ])

    const eventCounts: Record<string, number> = {}
    const activatedUsers = new Set<string>()
    for (const e of events ?? []) {
      eventCounts[e.event] = (eventCounts[e.event] ?? 0) + 1
      if (e.event === 'project_created' && e.user_id) activatedUsers.add(e.user_id)
    }

    return NextResponse.json({
      totalUsers: totalUsers ?? 0,
      newUsers7d: newUsers7d ?? 0,
      newLeads: newLeads ?? 0,
      activatedUsers30d: activatedUsers.size,
      events30d: eventCounts,
    })
  } catch (error) {
    console.error('GET /api/admin/metrics', error)
    return NextResponse.json({ error: 'Error al obtener métricas' }, { status: 500 })
  }
}
