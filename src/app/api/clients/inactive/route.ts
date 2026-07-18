import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext } from '@/lib/workspaces'

// Clientes inactivos (para reactivación / win-back): su última visita atendida
// fue hace más de `days` días.
export async function GET(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    let days = Math.round(Number(searchParams.get('days')))
    if (!Number.isFinite(days) || days < 1) days = 30

    const supabase = getSupabaseClient()
    const [{ data: clients }, { data: appts }] = await Promise.all([
      supabase.from('clients').select('id, name, phone').eq('workspace_id', ctx.workspaceId),
      supabase
        .from('appointments')
        .select('client_id, starts_at')
        .eq('workspace_id', ctx.workspaceId)
        .eq('status', 'done')
        .not('client_id', 'is', null)
        .order('starts_at', { ascending: false })
        .limit(5000),
    ])

    // Última visita por cliente (los appts vienen desc, la primera es la última).
    const lastByClient: Record<string, string> = {}
    for (const a of appts ?? []) {
      const cid = a.client_id as string
      if (cid && !lastByClient[cid]) lastByClient[cid] = a.starts_at
    }

    const cutoff = Date.now() - days * 86400000
    const out = (clients ?? [])
      .map(c => {
        const last = lastByClient[c.id]
        if (!last) return null
        const lastMs = new Date(last).getTime()
        if (lastMs >= cutoff) return null
        return {
          id: c.id,
          name: c.name,
          phone: c.phone ?? null,
          lastVisit: last,
          daysSince: Math.floor((Date.now() - lastMs) / 86400000),
        }
      })
      .filter((x): x is { id: string; name: string; phone: string | null; lastVisit: string; daysSince: number } => x !== null)
      .sort((a, b) => b.daysSince - a.daysSince)

    return NextResponse.json({ days, clients: out })
  } catch (error) {
    console.error('GET /api/clients/inactive', error)
    return NextResponse.json({ error: 'Error al obtener clientes inactivos' }, { status: 500 })
  }
}
