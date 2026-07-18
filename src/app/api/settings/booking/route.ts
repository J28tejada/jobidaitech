import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { canManageWorkspace, getWorkspaceContext, READ_ONLY_ERROR } from '@/lib/workspaces'

const parseDays = (raw: unknown): number[] => {
  if (Array.isArray(raw)) return raw.map(Number).filter(n => n >= 0 && n <= 6)
  if (typeof raw === 'string') return raw.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n >= 0 && n <= 6)
  return [1, 2, 3, 4, 5, 6]
}

const clampTime = (v: unknown, fallback: string): string => {
  if (typeof v === 'string' && /^\d{2}:\d{2}$/.test(v)) return v
  return fallback
}

export async function GET() {
  const ctx = await getWorkspaceContext()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('workspaces')
    .select('booking_token, booking_enabled, booking_open_time, booking_close_time, booking_slot_min, booking_days, booking_deposit')
    .eq('id', ctx.workspaceId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'Error al obtener la configuración' }, { status: 500 })

  return NextResponse.json({
    token: data?.booking_token ?? null,
    enabled: data?.booking_enabled ?? false,
    openTime: data?.booking_open_time ?? '09:00',
    closeTime: data?.booking_close_time ?? '19:00',
    slotMin: data?.booking_slot_min ?? 30,
    days: parseDays(data?.booking_days),
    deposit: Number(data?.booking_deposit ?? 0),
  })
}

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
  if (!canManageWorkspace(ctx.role)) {
    return NextResponse.json({ error: 'Solo un administrador puede configurar las reservas' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const patch: Record<string, unknown> = {}
    if (typeof body.enabled === 'boolean') patch.booking_enabled = body.enabled
    if (body.openTime !== undefined) patch.booking_open_time = clampTime(body.openTime, '09:00')
    if (body.closeTime !== undefined) patch.booking_close_time = clampTime(body.closeTime, '19:00')
    if (body.slotMin !== undefined) {
      const s = Number(body.slotMin)
      patch.booking_slot_min = [15, 20, 30, 45, 60].includes(s) ? s : 30
    }
    if (body.days !== undefined) {
      const days = parseDays(body.days)
      patch.booking_days = (days.length ? days : [1, 2, 3, 4, 5, 6]).join(',')
    }
    if (body.deposit !== undefined) {
      const d = Number(body.deposit)
      patch.booking_deposit = Number.isFinite(d) && d >= 0 ? d : 0
    }

    const supabase = getSupabaseClient()
    const { error } = await supabase.from('workspaces').update(patch).eq('id', ctx.workspaceId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/settings/booking', error)
    return NextResponse.json({ error: 'Error al guardar la configuración' }, { status: 500 })
  }
}
