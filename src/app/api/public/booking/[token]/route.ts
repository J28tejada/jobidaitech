import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { track } from '@/lib/analytics'
import { effectiveHours } from '@/lib/booking'
import { postWebhook } from '@/lib/notify'
import { notifyBookingReceived } from '@/lib/email'
import { sendPushToUser } from '@/lib/push'

async function findWorkspace(idOrSlug: string) {
  const supabase = getSupabaseClient()
  // select('*') para tolerar columnas de migraciones aún no ejecutadas (los
  // campos faltantes quedan undefined y caen a sus valores por defecto).
  // El identificador puede ser el token largo o el slug corto de la barbería.
  const byToken = await supabase
    .from('workspaces')
    .select('*')
    .eq('booking_token', idOrSlug)
    .maybeSingle()
  if (byToken.data) return byToken.data
  // Fallback por slug (case-insensitive). Si la columna aún no existe por una
  // migración sin correr, la consulta falla en silencio y devolvemos null.
  const bySlug = await supabase
    .from('workspaces')
    .select('*')
    .ilike('booking_slug', idOrSlug)
    .maybeSingle()
  return bySlug.data ?? null
}

// Info pública para la página de reservas.
export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const ws = await findWorkspace(params.token)
    if (!ws) return NextResponse.json({ error: 'Enlace no encontrado' }, { status: 404 })
    if (!ws.booking_enabled) return NextResponse.json({ enabled: false, business: { name: ws.name } })

    const supabase = getSupabaseClient()
    const [{ data: services }, { data: staff }] = await Promise.all([
      supabase.from('services').select('id, name, duration_min, price, variants, image_url, active').eq('workspace_id', ws.id).eq('active', true).order('created_at', { ascending: true }),
      supabase.from('staff').select('*').eq('workspace_id', ws.id).eq('active', true).order('created_at', { ascending: true }),
    ])

    return NextResponse.json({
      enabled: true,
      business: { name: ws.name, coverUrl: ws.booking_cover_url ?? null, intro: ws.booking_intro ?? null, accent: ws.booking_accent ?? null },
      currency: ws.currency ?? 'DOP',
      locale: ws.locale ?? 'es-DO',
      config: {
        slotMin: ws.booking_slot_min ?? 30,
        deposit: Number(ws.booking_deposit ?? 0),
        // Horario por día (efectivo): booking_hours o legado.
        hours: effectiveHours(ws),
      },
      services: (services ?? []).map(s => ({ id: s.id, name: s.name, durationMin: Number(s.duration_min ?? 30), price: Number(s.price ?? 0), imageUrl: (s as { image_url?: string | null }).image_url ?? null })),
      staff: (staff ?? []).map(s => {
        const raw = (s as { service_ids?: unknown }).service_ids
        return {
          id: s.id,
          name: s.name,
          imageUrl: (s as { image_url?: string | null }).image_url ?? null,
          serviceIds: Array.isArray(raw) ? raw.map(String) : [],
        }
      }),
    })
  } catch (error) {
    console.error(`GET /api/public/booking/${params.token}`, error)
    return NextResponse.json({ error: 'Error al cargar' }, { status: 500 })
  }
}

// Crear la reserva.
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const ws = await findWorkspace(params.token)
    if (!ws) return NextResponse.json({ error: 'Enlace no encontrado' }, { status: 404 })
    if (!ws.booking_enabled) return NextResponse.json({ error: 'Las reservas no están disponibles' }, { status: 403 })

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    if (!name) return NextResponse.json({ error: 'Indica tu nombre' }, { status: 400 })
    if (!phone) return NextResponse.json({ error: 'Indica tu WhatsApp/teléfono' }, { status: 400 })
    if (!body.startsAt) return NextResponse.json({ error: 'Elige un horario' }, { status: 400 })
    const starts = new Date(body.startsAt)
    if (Number.isNaN(starts.getTime()) || starts.getTime() < Date.now() - 60_000) {
      return NextResponse.json({ error: 'Horario inválido' }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    // Servicio (duración/precio/título)
    let serviceId: string | null = null
    let title = ''
    let durationMin = 30
    let price = 0
    if (body.serviceId) {
      const { data: svc } = await supabase.from('services').select('id, name, duration_min, price').eq('id', body.serviceId).eq('workspace_id', ws.id).maybeSingle()
      if (svc) {
        serviceId = svc.id
        title = svc.name
        durationMin = Number(svc.duration_min ?? 30)
        price = Number(svc.price ?? 0)
      }
    }

    // Barbero
    let staffId: string | null = null
    let staffName = ''
    let staffPhone: string | null = null
    let staffEmail: string | null = null
    if (body.staffId) {
      const { data: st } = await supabase.from('staff').select('id, name, phone, email').eq('id', body.staffId).eq('workspace_id', ws.id).maybeSingle()
      if (st) { staffId = st.id; staffName = st.name; staffPhone = st.phone ?? null; staffEmail = st.email ?? null }
    }

    // Vincular/crear cliente por teléfono, para que la reserva alimente
    // historial, fidelidad y reactivación.
    let clientId: string | null = null
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('workspace_id', ws.id)
      .eq('phone', phone)
      .limit(1)
    if (existing && existing.length > 0) {
      clientId = existing[0].id
    } else {
      const { data: created } = await supabase
        .from('clients')
        .insert({ workspace_id: ws.id, name, phone })
        .select('id')
        .single()
      clientId = created?.id ?? null
    }

    // Validación de disponibilidad por CAPACIDAD por SERVICIO (autoridad final,
    // evita el doble booking aunque el cliente muestre algo desactualizado o
    // dos clientes reserven a la vez). Capacidad = nº de barberos que hacen
    // ESTE servicio (mín. 1). Los que no tienen servicios marcados hacen todos.
    const { data: allStaff } = await supabase
      .from('staff')
      .select('id, service_ids')
      .eq('workspace_id', ws.id)
      .eq('active', true)
    const eligible = (allStaff ?? []).filter(s => {
      const ids = Array.isArray((s as { service_ids?: unknown }).service_ids) ? ((s as { service_ids: unknown[] }).service_ids).map(String) : []
      return ids.length === 0 || (serviceId ? ids.includes(serviceId) : true)
    })
    const eligibleIds = new Set(eligible.map(s => s.id))
    const capacity = Math.max(1, eligible.length)

    const windowStart = new Date(starts.getTime() - 4 * 3600_000).toISOString()
    const windowEnd = new Date(starts.getTime() + 4 * 3600_000).toISOString()
    const { data: near } = await supabase
      .from('appointments')
      .select('starts_at, duration_min, staff_id, service_id')
      .eq('workspace_id', ws.id)
      .in('status', ['scheduled', 'confirmed', 'done'])
      .gte('starts_at', windowStart)
      .lte('starts_at', windowEnd)
    const newStart = starts.getTime()
    const newEnd = newStart + durationMin * 60_000
    const overlapping = (near ?? []).filter(a => {
      const s = new Date(a.starts_at).getTime()
      const e = s + Number(a.duration_min ?? 30) * 60_000
      return newStart < e && s < newEnd
    })
    // Solo cuentan las citas que ocupan a un barbero que hace este servicio.
    const relevant = overlapping.filter(a =>
      (a.staff_id && eligibleIds.has(a.staff_id)) ||
      (!a.staff_id && (!serviceId || a.service_id === serviceId))
    )
    const full = relevant.length >= capacity || (staffId ? overlapping.some(a => a.staff_id === staffId) : false)
    if (full) return NextResponse.json({ error: 'Ese horario ya no está disponible. Elige otro.' }, { status: 409 })

    const { error } = await supabase.from('appointments').insert({
      workspace_id: ws.id,
      client_id: clientId,
      client_name: name,
      client_phone: phone,
      service_id: serviceId,
      staff_id: staffId,
      staff_name: staffName,
      title: title || null,
      starts_at: starts.toISOString(),
      duration_min: durationMin,
      price,
      status: 'scheduled',
      notes: 'Reserva online',
    })
    if (error) throw error

    await track('booking_created', { workspaceId: ws.id })

    const whenTextGlobal = typeof body.startsAtText === 'string' ? body.startsAtText : ''

    // Aviso al dueño por correo + push (ambos fire-and-forget; no afectan la
    // reserva si fallan). El correo va a la cuenta del dueño del negocio.
    if (ws.owner_id) {
      const { data: owner } = await supabase.from('users').select('email').eq('id', ws.owner_id).maybeSingle()
      await notifyBookingReceived({
        to: owner?.email ?? null,
        business: ws.name,
        clientName: name,
        clientPhone: phone,
        service: title || null,
        staff: staffName || null,
        whenText: whenTextGlobal,
      })
      await sendPushToUser(ws.owner_id as string, {
        title: `📅 Nueva reserva · ${ws.name}`,
        body: `${name}${title ? ` · ${title}` : ''}${whenTextGlobal ? ` · ${whenTextGlobal}` : ''}`,
        url: '/agenda',
      })
    }

    // Aviso al BARBERO asignado (a su propio correo), si tiene contacto.
    if (staffEmail) {
      await notifyBookingReceived({
        to: staffEmail,
        business: ws.name,
        clientName: name,
        clientPhone: phone,
        service: title || null,
        staff: staffName || null,
        whenText: whenTextGlobal,
      })
    }

    // Aviso al negocio (webhook → n8n → WhatsApp). Fire-and-forget: no bloquea
    // ni afecta la reserva si falla.
    // El webhook es GLOBAL de la plataforma (env BOOKING_NOTIFY_WEBHOOK_URL):
    // así el negocio solo pone su WhatsApp y la notificación ya funciona. Un
    // negocio puede sobreescribirlo con su propio webhook (booking_notify_url).
    const notifyUrl = (ws.booking_notify_url as string) || process.env.BOOKING_NOTIFY_WEBHOOK_URL || ''
    if (notifyUrl && ws.booking_notify_phone) {
      const whenText = typeof body.startsAtText === 'string' ? body.startsAtText : ''
      await postWebhook(notifyUrl, {
        event: 'booking_created',
        business: ws.name,
        notifyPhone: ws.booking_notify_phone ?? null,
        client: { name, phone },
        service: title || null,
        staff: staffName || null,
        staffPhone: staffPhone || null,
        startsAt: starts.toISOString(),
        whenText,
        durationMin,
        price,
        deposit: Number(ws.booking_deposit ?? 0),
        currency: ws.currency ?? 'DOP',
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(`POST /api/public/booking/${params.token}`, error)
    return NextResponse.json({ error: 'No se pudo crear la reserva' }, { status: 500 })
  }
}
