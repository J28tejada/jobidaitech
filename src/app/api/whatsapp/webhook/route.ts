import { NextRequest, NextResponse } from 'next/server'

import { handleInboundMessage } from '@/lib/whatsappAgent'
import { sendWhatsAppText, whatsappConfigured } from '@/lib/whatsapp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Webhook entrante de WhatsApp. Recibe eventos de Evolution API (directo) o un
// payload simplificado reenviado por n8n, extrae el mensaje del cliente, lo pasa
// al agente y responde por el mismo chat.
//
// Seguridad: si EVOLUTION_WEBHOOK_TOKEN está configurado, se exige que coincida
// (header x-webhook-token o query ?token=). Sin token configurado, procesa igual
// (útil en el arranque), pero se recomienda ponerlo en producción.
//
// Variables: EVOLUTION_WEBHOOK_TOKEN (opcional, recomendado).

interface Parsed {
  phone: string
  text: string
  fromMe: boolean
  isGroup: boolean
}

/** Extrae { phone, text } de los formatos conocidos. Devuelve null si no aplica. */
function parseInbound(body: any): Parsed | null {
  if (!body || typeof body !== 'object') return null

  // Formato simplificado (n8n u otros): { phone/from, text/message }
  const simplePhone = body.phone ?? body.from ?? body.number
  const simpleText = body.text ?? body.message ?? body.body
  if (typeof simplePhone === 'string' && typeof simpleText === 'string' && simpleText) {
    return { phone: simplePhone, text: simpleText, fromMe: Boolean(body.fromMe), isGroup: false }
  }

  // Formato nativo Evolution API (messages.upsert). `data` puede ser objeto o arreglo.
  const rawData = body.data ?? body
  const entry = Array.isArray(rawData) ? rawData[0] : rawData
  if (!entry || typeof entry !== 'object') return null

  const key = entry.key ?? {}
  const remoteJid: string = key.remoteJid ?? entry.remoteJid ?? ''
  if (!remoteJid) return null
  const isGroup = remoteJid.indexOf('@g.us') !== -1
  const phone = remoteJid.split('@')[0]

  const message = entry.message ?? {}
  const text: string =
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.videoMessage?.caption ??
    entry.text ??
    ''

  return { phone, text, fromMe: Boolean(key.fromMe), isGroup }
}

function authorized(request: NextRequest): boolean {
  const expected = process.env.EVOLUTION_WEBHOOK_TOKEN
  if (!expected) return true // sin token configurado: permisivo (arranque)
  const fromHeader = request.headers.get('x-webhook-token')
  const fromQuery = new URL(request.url).searchParams.get('token')
  return fromHeader === expected || fromQuery === expected
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: true }) // ignorar payloads no-JSON sin reintentos
  }

  const parsed = parseInbound(body)
  // Ignorar: eventos que no son mensajes de texto entrantes, nuestros propios
  // envíos, y (por ahora) mensajes de grupo.
  if (!parsed || !parsed.text || parsed.fromMe || parsed.isGroup) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  try {
    const result = await handleInboundMessage(parsed.phone, parsed.text)
    // Enviar la respuesta por Evolution si está configurado. Además la devolvemos
    // en el JSON para que n8n (u otro puente) pueda enviarla si así lo prefiere.
    if (result.reply && whatsappConfigured()) {
      await sendWhatsAppText(parsed.phone, result.reply)
    }
    return NextResponse.json({ ok: true, reply: result.reply })
  } catch (error) {
    console.error('POST /api/whatsapp/webhook', error)
    // Respondemos 200 igualmente para evitar reintentos en bucle del proveedor.
    return NextResponse.json({ ok: true, error: 'internal' })
  }
}

// Algunos proveedores validan el endpoint con un GET.
export async function GET() {
  return NextResponse.json({ ok: true, service: 'whatsapp-webhook' })
}
