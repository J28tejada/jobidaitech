import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext } from '@/lib/workspaces'

// Estado de fidelidad de un cliente.
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const supabase = getSupabaseClient()
    const [{ data: ws }, { data: client }, { count }] = await Promise.all([
      supabase.from('workspaces').select('loyalty_enabled, loyalty_threshold, loyalty_reward_pct').eq('id', ctx.workspaceId).maybeSingle(),
      supabase.from('clients').select('loyalty_redeemed_count').eq('id', params.id).eq('workspace_id', ctx.workspaceId).maybeSingle(),
      supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('workspace_id', ctx.workspaceId).eq('client_id', params.id).eq('status', 'done'),
    ])

    const enabled = ws?.loyalty_enabled ?? false
    const threshold = ws?.loyalty_threshold ?? 10
    const rewardPct = Number(ws?.loyalty_reward_pct ?? 100)
    const visits = count ?? 0
    const redeemedCount = client?.loyalty_redeemed_count ?? 0
    const sinceRedemption = Math.max(0, visits - redeemedCount)
    const rewardAvailable = enabled && threshold > 0 && sinceRedemption >= threshold

    return NextResponse.json({ enabled, threshold, rewardPct, visits, redeemedCount, sinceRedemption, rewardAvailable })
  } catch (error) {
    console.error('GET /api/clients/[id]/loyalty', error)
    return NextResponse.json({ error: 'Error al obtener fidelidad' }, { status: 500 })
  }
}
