import { NextRequest, NextResponse } from 'next/server'

import { handleInboundMessage, resolveBusinessForChat, type WaChat } from '@/lib/whatsappAgent'
import { esNotaDeVoz, textoDeNotaDeVoz } from '@/lib/audioWa'
import { esImagen, procesarImagen, type Adjunto } from '@/lib/imagenWa'
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
  /** Mensaje crudo de Evolution. Necesario para pedirle el audio descifrado. */
  data?: any
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

  return { chat: { jid: remoteJid, key, isGroup, sender }, text, fromMe: Boolean(key0.fromMe), data: entry }
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

  // Los números propios de los negocios también apuntan su webhook acá, pero lo
  // que les entra son SUS clientes, no el dueño hablando con el asistente. Si el
  // agente contestara ahí, un cliente que responde "ok gracias" a su recordatorio
  // recibiría "Hola, soy el asistente de Jobidai" desde el número de su barbería.
  const instanciaPlataforma = process.env.EVOLUTION_INSTANCE
  const instanciaEntrante = typeof body?.instance === 'string' ? body.instance : ''
  if (instanciaPlataforma && instanciaEntrante && instanciaEntrante !== instanciaPlataforma) {
    return NextResponse.json({ ok: true, skipped: 'instancia de negocio' })
  }

  const parsed = parseInbound(body)
  if (!parsed || parsed.fromMe) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  // Fotos de comprobantes: se guardan y se leen. Se resuelve el negocio primero
  // porque el archivo se guarda bajo su carpeta; sin negocio vinculado no hay
  // dónde ponerlo y no tiene sentido gastar una lectura del modelo.
  let texto = parsed.text
  let adjunto: Adjunto | null = null
  let lectura: string | null = null
  if (esImagen(parsed.data)) {
    const biz = await resolveBusinessForChat(parsed.chat.key)
    if (biz) {
      const r = await procesarImagen(parsed.data, biz.workspaceId)
      if ('error' in r) {
        if (!parsed.chat.isGroup && whatsappConfigured()) {
          await sendWhatsAppText(parsed.chat.key, r.error)
        }
        return NextResponse.json({ ok: true, error: r.error })
      }
      texto = r.texto
      adjunto = r.adjunto
      lectura = r.texto
    }
  }

  // Notas de voz: se transcriben y siguen el mismo camino que un mensaje escrito.
  let transcripcion: string | null = null
  if (!texto && esNotaDeVoz(parsed.data)) {
    const r = await textoDeNotaDeVoz(parsed.data)
    if ('error' in r) {
      // Se responde en vez de callar: si manda un audio y no pasa nada, el dueño
      // no sabe si lo ignoramos o si falló.
      if (!parsed.chat.isGroup && whatsappConfigured()) {
        await sendWhatsAppText(parsed.chat.key, r.error)
      }
      return NextResponse.json({ ok: true, error: r.error })
    }
    texto = r.texto
    transcripcion = r.texto
  }

  if (!texto) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  try {
    const result = await handleInboundMessage(parsed.chat, texto, adjunto)
    // Responder por Evolution si está configurado. Para grupos, el destino es el
    // JID del grupo; para directos, el teléfono. Además devolvemos la respuesta en
    // el JSON para que n8n (u otro puente) pueda enviarla si así lo prefiere.
    // Con audio se antepone lo que se entendió. Es la única forma de que el
    // dueño detecte una transcripción errónea ANTES de confirmar: "quinientos"
    // oído como "cinco mil" pasa desapercibido si solo ve el resumen.
    // Con audio o foto se antepone lo que se entendió: es la única forma de que
    // el dueño detecte una lectura errada ANTES de confirmar. Un "500" leído
    // como "5000" pasa desapercibido si solo ve el resumen.
    let reply = result.reply
    if (reply && transcripcion) reply = `🎤 Escuché: “${transcripcion}”\n\n${reply}`
    else if (reply && lectura) reply = `🧾 Leí: “${lectura}”\n\n${reply}`

    if (reply && whatsappConfigured()) {
      const destination = parsed.chat.isGroup ? parsed.chat.jid : parsed.chat.key
      await sendWhatsAppText(destination, reply)
    }
    return NextResponse.json({ ok: true, reply })
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
