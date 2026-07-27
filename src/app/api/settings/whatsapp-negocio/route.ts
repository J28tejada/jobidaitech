// Conectar el WhatsApp PROPIO del negocio.
//
// Es distinto de /api/settings/whatsapp, que vincula el chat del dueño con el
// asistente. Acá se conecta el número desde el que salen los mensajes a los
// CLIENTES del negocio. Confundirlas es fácil y el síntoma es invisible —los
// recordatorios salen desde el número equivocado— así que la UI tiene que
// nombrarlas distinto.
//
//   GET    estado actual (número, conectado, instancia)
//   POST   crea/reconecta la instancia y devuelve QR o código de emparejamiento
//   DELETE desconecta y borra la instancia
//
// El QR sirve si el dueño tiene otro dispositivo a mano. Si solo tiene el
// teléfono del negocio no puede escanear su propia pantalla, y para eso está el
// código de emparejamiento: se pide mandando `number`.

import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext, getWriteAccess, READ_ONLY_ERROR } from '@/lib/workspaces'
import { normalizePhone } from '@/lib/whatsapp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://jobidaitech.vercel.app'

function evolution() {
  const base = process.env.EVOLUTION_API_URL
  const apiKey = process.env.EVOLUTION_API_KEY
  if (!base || !apiKey) return null
  return { base: base.replace(/\/+$/, ''), apiKey }
}

async function evoFetch(path: string, init?: RequestInit) {
  const evo = evolution()
  if (!evo) throw new Error('Evolution no configurado')
  const res = await fetch(`${evo.base}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', apikey: evo.apiKey, ...(init?.headers ?? {}) },
  })
  const texto = await res.text()
  let json: any = null
  try { json = texto ? JSON.parse(texto) : null } catch { /* respuesta no-JSON */ }
  return { ok: res.ok, status: res.status, json, texto }
}

/**
 * Nombre de instancia derivado del workspace. Determinista a propósito: si el
 * dueño reconecta, cae en la misma instancia en vez de dejar sesiones huérfanas
 * consumiendo memoria en el servidor.
 */
function nombreInstancia(workspaceId: string): string {
  return `ws-${workspaceId.replace(/-/g, '').slice(0, 16)}`
}

export async function GET() {
  const ctx = await getWorkspaceContext()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = getSupabaseClient()
  const { data: ws } = await supabase
    .from('workspaces')
    .select('evolution_instance, evolution_phone, evolution_connected_at')
    .eq('id', ctx.workspaceId)
    .maybeSingle()

  const instancia = (ws as any)?.evolution_instance ?? null
  let estado: string | null = null
  if (instancia) {
    // El estado se pregunta a Evolution y no se cachea: una sesión se cae sola
    // y guardarlo mostraría "conectado" mientras los mensajes no salen.
    try {
      const r = await evoFetch(`/instance/connectionState/${encodeURIComponent(instancia)}`)
      estado = r.json?.instance?.state ?? null
    } catch { estado = null }
  }

  return NextResponse.json({
    configurado: Boolean(evolution()),
    instancia,
    telefono: (ws as any)?.evolution_phone ?? null,
    conectadoDesde: (ws as any)?.evolution_connected_at ?? null,
    estado,
    conectado: estado === 'open',
  })
}

export async function POST(request: NextRequest) {
  const ctx = await getWorkspaceContext()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const acceso = getWriteAccess(ctx.role)
  if (!acceso.allowed || !ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
  if (!evolution()) return NextResponse.json({ error: 'Evolution no está configurado' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  // Con número se pide código de emparejamiento; sin número, QR.
  const telefono = typeof body?.telefono === 'string' ? normalizePhone(body.telefono) : ''
  if (body?.metodo === 'codigo' && !telefono) {
    return NextResponse.json({ error: 'Indica el número de WhatsApp del negocio' }, { status: 400 })
  }

  const instancia = nombreInstancia(ctx.workspaceId)
  const supabase = getSupabaseClient()

  try {
    // Reconectar sobre la instancia existente en vez de crear otra: cada
    // instancia es una sesión viva en el servidor y las huérfanas no se liberan.
    const estadoPrevio = await evoFetch(`/instance/connectionState/${encodeURIComponent(instancia)}`)
    const existe = estadoPrevio.ok

    let r
    if (existe) {
      const q = telefono ? `?number=${encodeURIComponent(telefono)}` : ''
      r = await evoFetch(`/instance/connect/${encodeURIComponent(instancia)}${q}`)
    } else {
      r = await evoFetch('/instance/create', {
        method: 'POST',
        body: JSON.stringify({
          instanceName: instancia,
          integration: 'WHATSAPP-BAILEYS',
          qrcode: true,
          ...(telefono ? { number: telefono } : {}),
        }),
      })
    }

    if (!r.ok) {
      console.error('POST whatsapp-negocio', r.status, r.texto)
      return NextResponse.json({ error: 'No se pudo iniciar la conexión' }, { status: 502 })
    }

    // El webhook apunta a la app para que los mensajes de ESTE número también
    // lleguen. webhookByEvents en false: con true, Evolution le agrega el nombre
    // del evento a la URL y no llega nada.
    await evoFetch(`/webhook/set/${encodeURIComponent(instancia)}`, {
      method: 'POST',
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: `${APP_URL}/api/whatsapp/webhook`,
          webhookByEvents: false,
          webhookBase64: false,
          events: ['MESSAGES_UPSERT'],
        },
      }),
    }).catch(() => null)

    await supabase
      .from('workspaces')
      .update({ evolution_instance: instancia, evolution_phone: telefono || null })
      .eq('id', ctx.workspaceId)

    const qr = r.json?.qrcode ?? r.json
    return NextResponse.json({
      instancia,
      // base64 del QR (para escanear desde otro dispositivo) y/o código de
      // emparejamiento (para tipear en el mismo teléfono).
      qr: qr?.base64 ?? null,
      codigo: qr?.pairingCode ?? null,
    })
  } catch (error) {
    console.error('POST whatsapp-negocio', error)
    return NextResponse.json({ error: 'No se pudo iniciar la conexión' }, { status: 500 })
  }
}

export async function DELETE() {
  const ctx = await getWorkspaceContext()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const acceso = getWriteAccess(ctx.role)
  if (!acceso.allowed || !ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })

  const supabase = getSupabaseClient()
  const { data: ws } = await supabase
    .from('workspaces')
    .select('evolution_instance')
    .eq('id', ctx.workspaceId)
    .maybeSingle()
  const instancia = (ws as any)?.evolution_instance
  if (instancia && evolution()) {
    await evoFetch(`/instance/logout/${encodeURIComponent(instancia)}`, { method: 'DELETE' }).catch(() => null)
    await evoFetch(`/instance/delete/${encodeURIComponent(instancia)}`, { method: 'DELETE' }).catch(() => null)
  }
  await supabase
    .from('workspaces')
    .update({ evolution_instance: null, evolution_phone: null, evolution_connected_at: null })
    .eq('id', ctx.workspaceId)

  return NextResponse.json({ ok: true })
}
