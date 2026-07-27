// Notas de voz: bajar el audio de WhatsApp y transcribirlo.
//
// El audio de WhatsApp viaja cifrado extremo a extremo. El webhook trae la URL
// pero apunta a un `.enc` que solo Evolution puede descifrar, así que no se
// descarga directo: hay que pedírselo a Evolution con el mensaje completo.
//
// Por eso NO se activa `webhookBase64`: engordaría TODOS los webhooks —también
// los de texto, que son la mayoría— para resolver un caso que se puede pedir
// bajo demanda.

import { GoogleGenAI } from '@google/genai'

import { aiApiKey, aiModel, aiProvider } from './ai'

// Audios largos son casi siempre un envío por error o una conversación ajena
// reenviada. Transcribirlos cuesta y no aporta: el dueño manda notas cortas.
const MAX_SEGUNDOS = 180

export function esNotaDeVoz(data: any): boolean {
  return Boolean(data?.message?.audioMessage)
}

export function duracionAudio(data: any): number {
  return Number(data?.message?.audioMessage?.seconds ?? 0)
}

/**
 * Pide a Evolution el audio ya descifrado. Devuelve base64 y mimetype, o null
 * si falla: una nota de voz que no se puede bajar no debe romper el webhook.
 */
export async function bajarAudio(data: any): Promise<{ base64: string; mimetype: string } | null> {
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
        // Evolution espera el mensaje completo (proto.WebMessageInfo): con la
        // clave sola no puede resolver las llaves de descifrado.
        body: JSON.stringify({ message: data }),
        signal: controller.signal,
      }
    )
    clearTimeout(timer)
    if (!res.ok) {
      console.error('bajarAudio', res.status, await res.text().catch(() => ''))
      return null
    }
    const json = await res.json()
    if (!json?.base64) return null
    return { base64: json.base64 as string, mimetype: (json.mimetype as string) || 'audio/ogg' }
  } catch (error) {
    console.error('bajarAudio', error)
    return null
  }
}

/**
 * Transcribe con el mismo modelo que ya usa el agente. Devuelve el texto o null.
 *
 * Solo Google: Claude no acepta audio como entrada, así que con AI_PROVIDER=
 * anthropic las notas de voz quedan sin transcribir y el webhook lo avisa en
 * lugar de fallar en silencio.
 */
export async function transcribir(base64: string, mimetype: string): Promise<string | null> {
  if (aiProvider() !== 'google') return null
  try {
    const baseUrl = process.env.GEMINI_BASE_URL
    const ai = new GoogleGenAI({
      apiKey: aiApiKey(),
      ...(baseUrl ? { httpOptions: { baseUrl } } : {}),
    })
    // El mimetype de WhatsApp viene como "audio/ogg; codecs=opus" y la API
    // rechaza los parámetros extra.
    const mime = mimetype.split(';')[0].trim()
    const res = await ai.models.generateContent({
      model: aiModel(),
      contents: [
        {
          role: 'user',
          parts: [
            {
              // Se pide transcripción literal: el modelo que interpreta y
              // registra es el de después. Si acá "mejora" lo dicho, el error se
              // arrastra sin que nadie lo vea.
              text: 'Transcribe este audio en español, literal, sin agregar ni interpretar nada. Devuelve SOLO la transcripción, sin comillas ni comentarios.',
            },
            { inlineData: { mimeType: mime, data: base64 } },
          ],
        },
      ],
      config: { maxOutputTokens: 1000 },
    })
    const texto = (res.text ?? '').trim()
    return texto || null
  } catch (error) {
    console.error('transcribir', error)
    return null
  }
}

/**
 * Nota de voz -> texto. Devuelve el texto transcrito, o un mensaje para el dueño
 * cuando no se pudo (que es distinto de quedarse callado: si manda un audio y no
 * pasa nada, no sabe si el sistema lo ignoró o falló).
 */
export async function textoDeNotaDeVoz(data: any): Promise<{ texto: string } | { error: string }> {
  const segundos = duracionAudio(data)
  if (segundos > MAX_SEGUNDOS) {
    return { error: 'Esa nota de voz es muy larga. Mándame una más corta o escríbelo.' }
  }
  const audio = await bajarAudio(data)
  if (!audio) return { error: 'No pude escuchar esa nota de voz. ¿Me lo escribes?' }

  const texto = await transcribir(audio.base64, audio.mimetype)
  if (!texto) return { error: 'No pude entender esa nota de voz. ¿Me lo escribes?' }
  return { texto }
}
