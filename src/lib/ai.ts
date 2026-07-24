// Cliente de Claude (Anthropic) para las funciones de IA del repo.
//
// Env-gated: si no hay ANTHROPIC_API_KEY, `aiConfigured()` devuelve false y los
// consumidores deben degradar con elegancia (no romper). Nunca exponemos la
// llave al cliente: este módulo es solo de servidor.
//
// Variables de entorno:
//   ANTHROPIC_API_KEY   Llave de la API de Claude (obligatoria para activar IA)
//   ANTHROPIC_MODEL     Modelo a usar. Default: claude-haiku-4-5 (rápido/barato,
//                       ideal para extracción de datos de alto volumen). Se puede
//                       subir a claude-sonnet-5 o claude-opus-4-8 para lo complejo.

import Anthropic from '@anthropic-ai/sdk'

/** Modelo por defecto: rápido y económico para clasificación/extracción. */
export const DEFAULT_AI_MODEL = 'claude-haiku-4-5'

export function aiModel(): string {
  return process.env.ANTHROPIC_MODEL || DEFAULT_AI_MODEL
}

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

let cached: Anthropic | null = null

/**
 * Devuelve el cliente de Anthropic (memoizado). Lanza si no está configurado;
 * los llamadores deben chequear `aiConfigured()` antes.
 */
export function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no está definido')
  if (!cached) cached = new Anthropic({ apiKey })
  return cached
}
