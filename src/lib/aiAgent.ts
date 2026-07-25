// Loop de conversación con herramientas, independiente del proveedor.
//
// El agente de WhatsApp define QUÉ herramientas hay y qué hacen; este módulo se
// encarga de hablar con el modelo, ejecutar las herramientas que pida y devolver
// el texto final. Así cambiar de Gemini a Claude (o al revés) es una variable de
// entorno, no una reescritura.
//
// Cada proveedor implementa su propio loop en vez de compartir uno abstracto: el
// formato de resultados de herramienta difiere bastante entre ambos, y forzar una
// abstracción común los haría más frágiles que separados.

import { GoogleGenAI, ThinkingLevel, type Content, type Part } from '@google/genai'
import type Anthropic from '@anthropic-ai/sdk'

import { aiApiKey, aiModel, aiProvider, getAnthropic, type AiProviderName } from './ai'

/** Una herramienta que el modelo puede invocar. `run` devuelve texto para el modelo. */
export interface AgentTool {
  name: string
  description: string
  /** JSON Schema del objeto de parámetros (con additionalProperties:false). */
  schema: Record<string, unknown>
  run: (input: any) => Promise<string>
}

export interface AgentMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ToolConversationParams {
  system: string
  /** Historial previo del chat, en orden cronológico. */
  history: AgentMessage[]
  userText: string
  tools: AgentTool[]
  maxIterations?: number
  maxOutputTokens?: number
}

const DEFAULT_MAX_ITERATIONS = 4
const DEFAULT_MAX_OUTPUT_TOKENS = 1024

/** Ejecuta una herramienta por nombre, sin lanzar nunca. */
async function execTool(tools: AgentTool[], name: string | undefined, input: unknown): Promise<string> {
  const tool = tools.find(t => t.name === name)
  if (!tool) return 'ERROR: herramienta desconocida'
  try {
    return await tool.run(input ?? {})
  } catch (error) {
    console.error('execTool', name, error)
    return 'ERROR: fallo al ejecutar'
  }
}

/**
 * Conversa con el modelo hasta que deje de pedir herramientas, y devuelve su
 * texto final. Usa el proveedor configurado (ver ai.ts).
 */
export async function runToolConversation(params: ToolConversationParams): Promise<string> {
  return aiProvider() === 'anthropic' ? runAnthropic(params) : runGoogle(params)
}

// ---------------------------------------------------------------------------
// Ping de diagnóstico
// ---------------------------------------------------------------------------

export interface AiPingResult {
  ok: boolean
  proveedor: AiProviderName
  modelo: string
  respuesta?: string
  error?: string
  /** Solo al fallar con Google: modelos Flash que la llave sí puede usar. */
  modelosFlashDisponibles?: string[]
}

/** Lista los modelos que la llave puede usar (REST, para no depender del Pager). */
async function listGoogleFlashModels(): Promise<string[] | undefined> {
  try {
    const base = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '')
    const res = await fetch(`${base}/v1beta/models?key=${encodeURIComponent(aiApiKey())}&pageSize=200`)
    if (!res.ok) return undefined
    const body = (await res.json()) as { models?: Array<{ name?: string }> }
    const names: string[] = []
    ;(body.models ?? []).forEach(m => {
      const name = (m.name || '').replace(/^models\//, '')
      if (name && name.indexOf('flash') !== -1) names.push(name)
    })
    return names.length > 0 ? names : undefined
  } catch {
    return undefined
  }
}

/**
 * Hace una llamada mínima real al proveedor para comprobar llave + modelo.
 * Devuelve el mensaje de error tal como lo da el proveedor (sin secretos), que es
 * lo único que permite distinguir "modelo inexistente" de "llave inválida" o
 * "cuota agotada".
 */
export async function aiPing(): Promise<AiPingResult> {
  const proveedor = aiProvider()
  const modelo = aiModel()
  try {
    if (proveedor === 'google') {
      const baseUrl = process.env.GEMINI_BASE_URL
      const ai = new GoogleGenAI({
        apiKey: aiApiKey(),
        ...(baseUrl ? { httpOptions: { baseUrl } } : {}),
      })
      const res = await ai.models.generateContent({
        model: modelo,
        contents: 'Responde solo con: ok',
        config: { maxOutputTokens: 200 },
      })
      return { ok: true, proveedor, modelo, respuesta: (res.text ?? '').trim() }
    }

    const client = getAnthropic()
    const res = await client.messages.create({
      model: modelo,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Responde solo con: ok' }],
    })
    return { ok: true, proveedor, modelo, respuesta: textFromContent(res.content) }
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error)
    const result: AiPingResult = { ok: false, proveedor, modelo, error: mensaje }
    if (proveedor === 'google') {
      result.modelosFlashDisponibles = await listGoogleFlashModels()
    }
    return result
  }
}

// ---------------------------------------------------------------------------
// Google (Gemini)
// ---------------------------------------------------------------------------

function thinkingLevel(): ThinkingLevel {
  const raw = (process.env.GEMINI_THINKING_LEVEL || '').trim().toUpperCase()
  if (raw === 'MINIMAL') return ThinkingLevel.MINIMAL
  if (raw === 'MEDIUM') return ThinkingLevel.MEDIUM
  if (raw === 'HIGH') return ThinkingLevel.HIGH
  // LOW por defecto: la extracción es simple, pero algo de razonamiento evita
  // que corte la llamada a la herramienta antes de tiempo.
  return ThinkingLevel.LOW
}

async function runGoogle(params: ToolConversationParams): Promise<string> {
  // GEMINI_BASE_URL permite apuntar a otro endpoint (proxy o servidor de prueba).
  const baseUrl = process.env.GEMINI_BASE_URL
  const ai = new GoogleGenAI({
    apiKey: aiApiKey(),
    ...(baseUrl ? { httpOptions: { baseUrl } } : {}),
  })
  const maxIterations = params.maxIterations ?? DEFAULT_MAX_ITERATIONS

  // Reusamos el mismo JSON Schema que Claude vía parametersJsonSchema.
  const functionDeclarations = params.tools.map(t => ({
    name: t.name,
    description: t.description,
    parametersJsonSchema: t.schema,
  }))

  const contents: Content[] = params.history.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  contents.push({ role: 'user', parts: [{ text: params.userText }] })

  for (let i = 0; i < maxIterations; i++) {
    const response = await ai.models.generateContent({
      model: aiModel(),
      contents,
      config: {
        systemInstruction: params.system,
        tools: [{ functionDeclarations }],
        maxOutputTokens: params.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
        thinkingConfig: { thinkingLevel: thinkingLevel() },
      },
    })

    const calls = response.functionCalls ?? []
    if (calls.length === 0) return (response.text ?? '').trim()

    // Devolvemos el turno del modelo tal como vino (conserva texto y llamadas).
    const modelTurn = response.candidates?.[0]?.content
    contents.push(
      modelTurn ?? { role: 'model', parts: calls.map(c => ({ functionCall: c })) }
    )

    const parts: Part[] = []
    for (let j = 0; j < calls.length; j++) {
      const call = calls[j]
      const out = await execTool(params.tools, call.name, call.args)
      parts.push({
        functionResponse: { id: call.id, name: call.name, response: { result: out } },
      })
    }
    contents.push({ role: 'user', parts })
  }

  return ''
}

// ---------------------------------------------------------------------------
// Anthropic (Claude)
// ---------------------------------------------------------------------------

function textFromContent(content: Anthropic.ContentBlock[]): string {
  const parts: string[] = []
  content.forEach(block => {
    if (block.type === 'text') parts.push(block.text)
  })
  return parts.join('\n').trim()
}

async function runAnthropic(params: ToolConversationParams): Promise<string> {
  const client = getAnthropic()
  const maxIterations = params.maxIterations ?? DEFAULT_MAX_ITERATIONS

  // strict:true hace que la API valide los parámetros contra el esquema.
  const tools: Anthropic.Tool[] = params.tools.map(t => ({
    name: t.name,
    description: t.description,
    strict: true,
    input_schema: t.schema as Anthropic.Tool.InputSchema,
  }))

  const messages: Anthropic.MessageParam[] = params.history.map(m => ({
    role: m.role,
    content: m.content,
  }))
  messages.push({ role: 'user', content: params.userText })

  for (let i = 0; i < maxIterations; i++) {
    const response = await client.messages.create({
      model: aiModel(),
      max_tokens: params.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      system: params.system,
      tools,
      messages,
    })

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    )
    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      return textFromContent(response.content)
    }

    messages.push({ role: 'assistant', content: response.content })
    const results: Anthropic.ToolResultBlockParam[] = []
    for (let j = 0; j < toolUses.length; j++) {
      const tu = toolUses[j]
      const out = await execTool(params.tools, tu.name, tu.input)
      results.push({ type: 'tool_result', tool_use_id: tu.id, content: out })
    }
    messages.push({ role: 'user', content: results })
  }

  return ''
}
