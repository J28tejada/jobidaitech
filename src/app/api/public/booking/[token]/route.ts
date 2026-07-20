import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { track } from '@/lib/analytics'
import { effectiveHours } from '@/lib/booking'
import { postWebhook } from '@/lib/notify'
import { notifyBookingReceived } from '@/lib/email'
import { sendPushToUser } from '@/lib/push'

async function findWorkspace(token: string) {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('workspaces')
    .select('id, name, owner_id, currency, locale, booking_enabled, booking_open_time, booking_close_time, booking_slot_min, booking_days, booking_deposit, booking_hours, booking_notify_url, booking_notify_phone')
    .eq('booking_token', token)
    .maybeSingle()
  return data
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
      supabase.from('staff').select('id, name, active').eq('workspace_id', ws.id).eq('active', true).order('created_at', { ascending: true }),
    ])

    return NextResponse.json({
      enabled: true,
      business: { name: ws.name },
      currency: ws.currency ?? 'DOP',
      locale: ws.locale ?? 'es-DO',
      config: {
        slotMin: ws.booking_slot_min ?? 30,
        deposit: Number(ws.booking_deposit ?? 0),
        // Horario por día (efectivo): booking_hours o legado.
        hours: effectiveHours(ws),
      },
      services: (services ?? []).map(s => ({ id: s.id, name: s.name, durationMin: Number(s.duration_min ?? 30), price: Number(s.price ?? 0), imageUrl: (s as { image_url?: string | null }).image_url ?? null })),
      staff: (staff ?? []).map(s => ({ id: s.id, name: s.name })),
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

    // Chequeo básico de solape (mismo barbero, o la barbería si no hay barbero).
    const windowStart = new Date(starts.getTime() - 4 * 3600_000).toISOString()
    const windowEnd = new Date(starts.getTime() + 4 * 3600_000).toISOString()
    const q = supabase
      .from('appointments')
      .select('starts_at, duration_min, staff_id')
      .eq('workspace_id', ws.id)
      .in('status', ['scheduled', 'confirmed', 'done'])
      .gte('starts_at', windowStart)
      .lte('starts_at', windowEnd)
    if (staffId) q.eq('staff_id', staffId)
    const { data: near } = await q
    const newStart = starts.getTime()
    const newEnd = newStart + durationMin * 60_000
    const overlap = (near ?? []).some(a => {
      const s = new Date(a.starts_at).getTime()
      const e = s + Number(a.duration_min ?? 30) * 60_000
      return newStart < e && s < newEnd
    })
    if (overlap) return NextResponse.json({ error: 'Ese horario ya no está disponible. Elige otro.' }, { status: 409 })

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
