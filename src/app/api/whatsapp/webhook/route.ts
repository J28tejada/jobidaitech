import { NextRequest, NextResponse } from 'next/server'

import { handleInboundMessage, type WaChat } from '@/lib/whatsappAgent'
import { sendWhatsAppText, whatsappConfigured, parseChatJid, normalizePhone } from '@/lib/whatsapp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Webhook entrante de WhatsApp. Recibe eventos de Evolution API (directo) o un
// payload simplificado reenviado por n8n, extrae el mensaje (de un chat directo
// o de un grupo), lo pasa al agente y responde por el mismo chat.
//
// Seguridad: si EVOLUTION_WEBHOOK_TOKEN está configurado, se exige que coincida
// (header x-webhook-token o query ?token=). Sin token configurado, procesa igual
// (útil en el arranque), pero se recomienda ponerlo en producción.
//
// Variables: EVOLUTION_WEBHOOK_TOKEN (opcional, recomendado).

interface Parsed {
  chat: WaChat
  text: string
  fromMe: boolean
}

/** Extrae el chat y el texto de los formatos conocidos. Devuelve null si no aplica. */
function parseInbound(body: any): Parsed | null {
  if (!body || typeof body !== 'object') return null

  const simpleText: unknown = body.text ?? body.message ?? body.body

  // Formato simplificado con JID explícito: { jid|remoteJid, text, participant? }
  const explicitJid: unknown = body.jid ?? body.remoteJid
  if (typeof explicitJid === 'string' && typeof simpleText === 'string' && simpleText) {
    const { key, isGroup } = parseChatJid(explicitJid)
    const sender = typeof body.participant === 'string' ? parseChatJid(body.participant).key : key
    return { chat: { jid: explicitJid, key, isGroup, sender }, text: simpleText, fromMe: Boolean(body.fromMe) }
  }

  // Formato simplificado por teléfono: { phone|from|number, text }
  const simplePhone: unknown = body.phone ?? body.from ?? body.number
  if (typeof simplePhone === 'string' && typeof simpleText === 'string' && simpleText) {
    const key = normalizePhone(simplePhone)
    return { chat: { jid: simplePhone, key, isGroup: false, sender: key }, text: simpleText, fromMe: Boolean(body.fromMe) }
  }

  // Formato nativo Evolution API (messages.upsert). `data` puede ser objeto o arreglo.
  const rawData = body.data ?? body
  const entry = Array.isArray(rawData) ? rawData[0] : rawData
  if (!entry || typeof entry !== 'object') return null

  const key0 = entry.key ?? {}
  const remoteJid: string = key0.remoteJid ?? entry.remoteJid ?? ''
  if (!remoteJid) return null
  const { key, isGroup } = parseChatJid(remoteJid)

  // En grupos, quién escribió viene en key.participant.
  const participant: string = key0.participant ?? entry.participant ?? ''
  const sender = isGroup && participant ? parseChatJid(participant).key : key

  const message = entry.message ?? {}
  const text: string =
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.videoMessage?.caption ??
    entry.text ??
    ''

  return { chat: { jid: remoteJid, key, isGroup, sender }, text, fromMe: Boolean(key0.fromMe) }
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
  // Ignorar: eventos que no son mensajes de texto entrantes y nuestros propios envíos.
  if (!parsed || !parsed.text || parsed.fromMe) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  try {
    const result = await handleInboundMessage(parsed.chat, parsed.text)
    // Responder por Evolution si está configurado. Para grupos, el destino es el
    // JID del grupo; para directos, el teléfono. Además devolvemos la respuesta en
    // el JSON para que n8n (u otro puente) pueda enviarla si así lo prefiere.
    if (result.reply && whatsappConfigured()) {
      const destination = parsed.chat.isGroup ? parsed.chat.jid : parsed.chat.key
      await sendWhatsAppText(destination, result.reply)
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
