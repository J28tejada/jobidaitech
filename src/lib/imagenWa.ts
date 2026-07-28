// Imágenes por WhatsApp: facturas, comprobantes de pago, depósitos, transferencias.
//
// Dos cosas pasan con una foto, y las dos importan:
//
//   1. Se LEE, para que el agente pueda registrar el movimiento sin tipear.
//   2. Se GUARDA en el bucket `receipts` y queda adjunta a la transacción.
//
// La segunda es la que hace que esto sea contabilidad y no una anotación: un
// comprobante que se lee y se descarta pierde justo la evidencia que lo
// respalda. Queda igual que si lo hubiera subido desde la app.

import { GoogleGenAI } from '@google/genai'

import { aiApiKey, aiModel, aiProvider } from './ai'
import { getSupabaseClient } from './supabase'

const BUCKET = 'receipts'
const MAX_BYTES = 4 * 1024 * 1024

export interface Adjunto {
  path: string
  name: string
  type: string
}

export function esImagen(data: any): boolean {
  return Boolean(data?.message?.imageMessage)
}

/** Texto que el dueño escribió junto a la foto, si escribió algo. */
export function pieDeFoto(data: any): string {
  const c = data?.message?.imageMessage?.caption
  return typeof c === 'string' ? c.trim() : ''
}

/** Igual que con el audio: la imagen viaja cifrada y solo Evolution la descifra. */
export async function bajarImagen(data: any): Promise<{ base64: string; mimetype: string } | null> {
  const base = process.env.EVOLUTION_API_URL
  const apiKey = process.env.EVOLUTION_API_KEY
  const instance = process.env.EVOLUTION_INSTANCE
  if (!base || !apiKey || !instance) return null

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30000)
    const res = await fetch(
      `${base.replace(/\/+$/, '')}/chat/getBase64FromMediaMessage/${encodeURIComponent(instance)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({ message: data }),
        signal: controller.signal,
      }
    )
    clearTimeout(timer)
    if (!res.ok) {
      console.error('bajarImagen', res.status, await res.text().catch(() => ''))
      return null
    }
    const json = await res.json()
    if (!json?.base64) return null
    return { base64: json.base64 as string, mimetype: (json.mimetype as string) || 'image/jpeg' }
  } catch (error) {
    console.error('bajarImagen', error)
    return null
  }
}

/** Guarda la foto en el bucket privado, con la misma convención que /api/uploads. */
export async function guardarComprobante(
  workspaceId: string,
  base64: string,
  mimetype: string
): Promise<Adjunto | null> {
  try {
    const buffer = Buffer.from(base64, 'base64')
    if (buffer.byteLength > MAX_BYTES) {
      console.error('guardarComprobante: supera el limite', buffer.byteLength)
      return null
    }
    const type = mimetype.split(';')[0].trim() || 'image/jpeg'
    const ext = type.split('/')[1] || 'jpg'
    const path = `${workspaceId}/${crypto.randomUUID()}.${ext}`
    const { error } = await getSupabaseClient()
      .storage.from(BUCKET)
      .upload(path, buffer, { contentType: type, upsert: false })
    if (error) {
      console.error('guardarComprobante', error)
      return null
    }
    return { path, name: `whatsapp.${ext}`, type }
  } catch (error) {
    console.error('guardarComprobante', error)
    return null
  }
}

/**
 * Lee el comprobante y devuelve una descripción en texto.
 *
 * Devuelve texto y no JSON estructurado a propósito: ese texto entra al agente
 * como si el dueño lo hubiera escrito, así hereda la confirmación, el agrupado y
 * todo lo demás sin un camino paralelo. Y si la foto no es un comprobante, lo
 * dice en vez de inventar montos.
 */
export async function leerComprobante(base64: string, mimetype: string): Promise<string | null> {
  if (aiProvider() !== 'google') return null
  try {
    const baseUrl = process.env.GEMINI_BASE_URL
    const ai = new GoogleGenAI({
      apiKey: aiApiKey(),
      ...(baseUrl ? { httpOptions: { baseUrl } } : {}),
    })
    const mime = mimetype.split(';')[0].trim()
    const res = await ai.models.generateContent({
      model: aiModel(),
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: [
                'Esta es una foto que un dueño de negocio mandó por WhatsApp.',
                'Si es una factura, recibo, comprobante de pago, depósito o transferencia, describe en UNA o DOS frases:',
                'qué tipo de documento es, el MONTO TOTAL, la fecha si aparece, y el comercio o beneficiario.',
                'No inventes datos: si un dato no se lee, di que no se lee.',
                'Si NO es un documento de dinero, responde exactamente: NO_ES_COMPROBANTE',
              ].join(' '),
            },
            { inlineData: { mimeType: mime, data: base64 } },
          ],
        },
      ],
      config: { maxOutputTokens: 500 },
    })
    const texto = (res.text ?? '').trim()
    if (!texto || texto.toUpperCase().includes('NO_ES_COMPROBANTE')) return null
    return texto
  } catch (error) {
    console.error('leerComprobante', error)
    return null
  }
}

/**
 * Foto -> texto para el agente + adjunto guardado.
 *
 * Se guarda ANTES de leer y aunque la lectura falle: la imagen ya llegó, y
 * perderla porque el modelo no la entendió sería tirar la evidencia. Si no se
 * pudo leer, el dueño puede escribir el monto y la foto igual queda adjunta.
 */
export async function procesarImagen(
  data: any,
  workspaceId: string
): Promise<{ texto: string; adjunto: Adjunto | null } | { error: string }> {
  const img = await bajarImagen(data)
  if (!img) return { error: 'No pude ver esa imagen. ¿Me la mandas de nuevo?' }

  const adjunto = await guardarComprobante(workspaceId, img.base64, img.mimetype)
  const lectura = await leerComprobante(img.base64, img.mimetype)
  const pie = pieDeFoto(data)

  if (!lectura) {
    if (pie) return { texto: pie, adjunto }
    return { error: 'Vi la imagen pero no reconocí un comprobante. ¿Me dices qué anoto y de cuánto?' }
  }

  // El pie de foto manda sobre la lectura: si el dueño escribió "esto es el
  // pago de Pedro", eso es contexto que la imagen no tiene.
  return { texto: pie ? `${lectura}\n\nEl dueño agregó: ${pie}` : lectura, adjunto }
}
