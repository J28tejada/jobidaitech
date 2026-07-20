import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { canManageWorkspace, getWorkspaceContext, READ_ONLY_ERROR } from '@/lib/workspaces'
import { effectiveHours, normalizeHours, legacyFromHours } from '@/lib/booking'

export async function GET() {
  const ctx = await getWorkspaceContext()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = getSupabaseClient()
  // select('*') a propósito: así, si una migración de columnas nuevas
  // (booking_hours, booking_notify_*, booking_cover_url) aún no se corrió,
  // la consulta NO falla — los campos faltantes quedan undefined y se usan
  // sus valores por defecto. Evita que "se borre" toda la configuración.
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', ctx.workspaceId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'Error al obtener la configuración' }, { status: 500 })

  return NextResponse.json({
    token: data?.booking_token ?? null,
    enabled: data?.booking_enabled ?? false,
    slotMin: data?.booking_slot_min ?? 30,
    deposit: Number(data?.booking_deposit ?? 0),
    notifyUrl: data?.booking_notify_url ?? '',
    notifyPhone: data?.booking_notify_phone ?? '',
    coverUrl: data?.booking_cover_url ?? '',
    // Horario por día (efectivo): usa booking_hours o cae al legado.
    hours: effectiveHours(data ?? {}),
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
    if (body.slotMin !== undefined) {
      const s = Number(body.slotMin)
      patch.booking_slot_min = [15, 20, 30, 45, 60].includes(s) ? s : 30
    }
    if (body.deposit !== undefined) {
      const d = Number(body.deposit)
      patch.booking_deposit = Number.isFinite(d) && d >= 0 ? d : 0
    }
    if (body.notifyUrl !== undefined) {
      const u = typeof body.notifyUrl === 'string' ? body.notifyUrl.trim() : ''
      patch.booking_notify_url = u || null
    }
    if (body.notifyPhone !== undefined) {
      const p = typeof body.notifyPhone === 'string' ? body.notifyPhone.trim() : ''
      patch.booking_notify_phone = p || null
    }
    if (body.coverUrl !== undefined) {
      const c = typeof body.coverUrl === 'string' ? body.coverUrl.trim() : ''
      patch.booking_cover_url = c || null
    }
    // Horario por día: fuente de verdad. También sincronizamos los campos
    // legados (días + rango) para cualquier consumidor antiguo.
    if (body.hours !== undefined) {
      const hours = normalizeHours(body.hours)
      patch.booking_hours = hours
      const legacy = legacyFromHours(hours)
      patch.booking_days = legacy.days.join(',')
      patch.booking_open_time = legacy.open
      patch.booking_close_time = legacy.close
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
