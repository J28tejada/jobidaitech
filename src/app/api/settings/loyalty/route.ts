import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { canManageWorkspace, getWorkspaceContext, READ_ONLY_ERROR } from '@/lib/workspaces'

export async function GET() {
  const ctx = await getWorkspaceContext()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('workspaces')
    .select('loyalty_enabled, loyalty_threshold, loyalty_reward_pct')
    .eq('id', ctx.workspaceId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'Error al obtener la configuración' }, { status: 500 })

  return NextResponse.json({
    enabled: data?.loyalty_enabled ?? false,
    threshold: data?.loyalty_threshold ?? 10,
    rewardPct: Number(data?.loyalty_reward_pct ?? 100),
  })
}

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
  if (!canManageWorkspace(ctx.role)) {
    return NextResponse.json({ error: 'Solo un administrador puede configurar la fidelidad' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const patch: Record<string, unknown> = {}
    if (typeof body.enabled === 'boolean') patch.loyalty_enabled = body.enabled
    if (body.threshold !== undefined) {
      const t = Math.round(Number(body.threshold))
      patch.loyalty_threshold = Number.isFinite(t) && t >= 1 ? t : 10
    }
    if (body.rewardPct !== undefined) {
      let p = Number(body.rewardPct)
      if (!Number.isFinite(p) || p < 1) p = 100
      if (p > 100) p = 100
      patch.loyalty_reward_pct = p
    }

    const supabase = getSupabaseClient()
    const { error } = await supabase.from('workspaces').update(patch).eq('id', ctx.workspaceId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/settings/loyalty', error)
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  }
}
