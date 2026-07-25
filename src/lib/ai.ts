// Configuración de IA. Soporta dos proveedores; el agente de WhatsApp funciona
// igual con cualquiera (ver aiAgent.ts).
//
// Solo de servidor: nunca exponemos las llaves al cliente.
//
// Variables de entorno:
//   GEMINI_API_KEY          Llave de Google AI Studio (proveedor por defecto)
//   GEMINI_MODEL            Default gemini-3.6-flash
//   GEMINI_THINKING_LEVEL   MINIMAL | LOW | MEDIUM | HIGH (default LOW)
//   ANTHROPIC_API_KEY       Llave de Claude (alternativa)
//   ANTHROPIC_MODEL         Default claude-haiku-4-5
//   AI_PROVIDER             google | anthropic. Si no se define, se detecta por
//                           cuál llave esté presente (Google tiene prioridad).

import Anthropic from '@anthropic-ai/sdk'

export type AiProviderName = 'google' | 'anthropic'

export const DEFAULT_GOOGLE_MODEL = 'gemini-3.6-flash'
export const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5'

function googleKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
}

/** Proveedor efectivo: explícito por AI_PROVIDER, o el que tenga llave. */
export function aiProvider(): AiProviderName {
  const raw = (process.env.AI_PROVIDER || '').trim().toLowerCase()
  if (raw === 'anthropic' || raw === 'claude') return 'anthropic'
  if (raw === 'google' || raw === 'gemini') return 'google'
  if (googleKey()) return 'google'
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic'
  return 'google'
}

/** Modelo del proveedor activo. */
export function aiModel(): string {
  if (aiProvider() === 'anthropic') {
    return process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL
  }
  return process.env.GEMINI_MODEL || DEFAULT_GOOGLE_MODEL
}

/** ¿Hay llave para el proveedor activo? */
export function aiConfigured(): boolean {
  return aiProvider() === 'anthropic' ? Boolean(process.env.ANTHROPIC_API_KEY) : Boolean(googleKey())
}

/** Nombre de la variable que falta, para mensajes de error accionables. */
export function aiMissingKeyName(): string {
  return aiProvider() === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GEMINI_API_KEY'
}

/** Llave del proveedor activo (lanza si falta; chequea `aiConfigured()` antes). */
export function aiApiKey(): string {
  const key = aiProvider() === 'anthropic' ? process.env.ANTHROPIC_API_KEY : googleKey()
  if (!key) throw new Error(`${aiMissingKeyName()} no está definido`)
  return key
}

let cachedAnthropic: Anthropic | null = null

/** Cliente de Anthropic (memoizado). */
export function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no está definido')
  if (!cachedAnthropic) cachedAnthropic = new Anthropic({ apiKey })
  return cachedAnthropic
}
