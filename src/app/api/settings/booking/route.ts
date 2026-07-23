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
    slug: data?.booking_slug ?? '',
    enabled: data?.booking_enabled ?? false,
    slotMin: data?.booking_slot_min ?? 30,
    deposit: Number(data?.booking_deposit ?? 0),
    notifyUrl: data?.booking_notify_url ?? '',
    notifyPhone: data?.booking_notify_phone ?? '',
    coverUrl: data?.booking_cover_url ?? '',
    intro: data?.booking_intro ?? '',
    accent: data?.booking_accent ?? '',
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
    if (body.intro !== undefined) {
      const i = typeof body.intro === 'string' ? body.intro.trim().slice(0, 160) : ''
      patch.booking_intro = i || null
    }
    if (body.accent !== undefined) {
      const a = typeof body.accent === 'string' ? body.accent.trim() : ''
      patch.booking_accent = /^#[0-9a-fA-F]{6}$/.test(a) ? a : null
    }
    // Slug corto para el enlace de marca (/r/<slug>). Normalizamos a
    // minúsculas, guiones en vez de espacios, y validamos formato + unicidad.
    if (body.slug !== undefined) {
      const raw = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''
      if (raw === '') {
        patch.booking_slug = null
      } else {
        const slug = raw.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        if (slug.length < 3 || slug.length > 30) {
          return NextResponse.json({ error: 'El enlace debe tener entre 3 y 30 letras o números (sin espacios).' }, { status: 400 })
        }
        const supabase = getSupabaseClient()
        const { data: taken } = await supabase
          .from('workspaces')
          .select('id')
          .ilike('booking_slug', slug)
          .neq('id', ctx.workspaceId)
          .maybeSingle()
        if (taken) {
          return NextResponse.json({ error: 'Ese enlace ya está en uso. Prueba con otro.' }, { status: 409 })
        }
        patch.booking_slug = slug
      }
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
