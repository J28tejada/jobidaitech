// Agente de captura por WhatsApp.
//
// Recibe un mensaje entrante (un "chat" directo o de grupo + texto), identifica
// el negocio dueño de ese chat, y usa Claude con herramientas (tool-use) para
// interpretar la nota y registrarla en la app (ingreso/gasto, cita, cliente). Si
// algo no está claro pregunta; si es una acción con monto o una cita, confirma
// antes de guardar. En grupos, ignora los mensajes que no le competen.
//
// Todo pasa por service_role (getSupabaseClient), igual que las demás rutas de
// servidor. Env-gated: si no hay IA configurada, degrada con un mensaje claro.

import type Anthropic from '@anthropic-ai/sdk'

import { getSupabaseClient } from './supabase'
import { aiConfigured, aiModel, getAnthropic } from './ai'
import { normalizePhone } from './whatsapp'
import { hasModule, type PlanTier, type ModuleKey } from './modules'
import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from './format'

const TZ = process.env.WHATSAPP_TZ || 'America/Santo_Domingo'
const MAX_TOOL_ITERATIONS = 4
const HISTORY_LIMIT = 12
// Tope por mensaje del historial: si alguien pega un texto larguísimo, no debe
// encarecer todas las llamadas siguientes de ese chat.
const HISTORY_BODY_MAX = 500
const IGNORE_SENTINEL = '[IGNORAR]'

// Un "chat" es de dónde viene el mensaje: un teléfono directo o un grupo.
export interface WaChat {
  jid: string // remoteJid completo (destino para responder)
  key: string // clave de conversación: id de grupo o teléfono normalizado
  isGroup: boolean
  sender: string // teléfono de quien escribió (participant en grupos)
}

// ---------------------------------------------------------------------------
// Contexto del negocio dueño de un chat
// ---------------------------------------------------------------------------

export interface WaBusiness {
  workspaceId: string
  userId: string
  name: string
  businessType: string
  currency: string
  locale: string
  planTier: PlanTier
}

/** Resuelve el negocio vinculado a un chat (o null si no está vinculado). */
export async function resolveBusinessForChat(chatKey: string): Promise<WaBusiness | null> {
  if (!chatKey) return null
  const supabase = getSupabaseClient()

  const { data: link } = await supabase
    .from('whatsapp_numbers')
    .select('workspace_id, user_id')
    .eq('phone', chatKey)
    .eq('active', true)
    .maybeSingle()
  if (!link) return null

  // select('*') para tolerar columnas de migraciones aún no corridas.
  const { data: ws } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', link.workspace_id)
    .maybeSingle()
  if (!ws) return null

  let planTier: PlanTier = 'pro'
  if (ws.owner_id) {
    const { data: owner } = await supabase
      .from('users')
      .select('plan_tier')
      .eq('id', ws.owner_id)
      .maybeSingle()
    planTier = (owner?.plan_tier as PlanTier) ?? 'pro'
  }

  return {
    workspaceId: ws.id,
    userId: (link.user_id as string) || (ws.owner_id as string),
    name: ws.name ?? 'tu negocio',
    businessType: (ws.business_type as string) || 'other',
    currency: (ws.currency as string) || DEFAULT_CURRENCY,
    locale: (ws.locale as string) || DEFAULT_LOCALE,
    planTier,
  }
}

// ---------------------------------------------------------------------------
// Vinculación por código
// ---------------------------------------------------------------------------

/**
 * Si el texto contiene un código de vinculación válido, vincula el chat (número
 * o grupo) al negocio y devuelve el nombre del negocio. Si no, devuelve null.
 */
export async function tryLinkByCode(chatKey: string, text: string, isGroup: boolean): Promise<string | null> {
  if (!chatKey || !text) return null
  const upper = text.toUpperCase()
  const tokens: string[] = upper.match(/[A-Z0-9]{4,}/g) || []
  if (tokens.length === 0) return null

  const supabase = getSupabaseClient()
  const { data: codes } = await supabase
    .from('whatsapp_link_codes')
    .select('id, code, workspace_id, user_id, expires_at, used_at')
    .in('code', tokens)
    .is('used_at', null)
  if (!codes || codes.length === 0) return null

  const now = Date.now()
  const valid = codes.find(c => !c.expires_at || new Date(c.expires_at).getTime() > now)
  if (!valid) return null

  // Vincular (o re-vincular) el chat a ese negocio.
  const { data: existing } = await supabase
    .from('whatsapp_numbers')
    .select('id')
    .eq('phone', chatKey)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('whatsapp_numbers')
      .update({ workspace_id: valid.workspace_id, user_id: valid.user_id, active: true, is_group: isGroup })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('whatsapp_numbers')
      .insert({ workspace_id: valid.workspace_id, user_id: valid.user_id, phone: chatKey, active: true, is_group: isGroup })
  }

  await supabase
    .from('whatsapp_link_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', valid.id)

  const { data: ws } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', valid.workspace_id)
    .maybeSingle()
  return ws?.name ?? 'tu negocio'
}

// ---------------------------------------------------------------------------
// Bitácora
// ---------------------------------------------------------------------------

async function logMessage(params: {
  workspaceId: string | null
  chatKey: string
  direction: 'in' | 'out'
  body: string
  sender?: string
}): Promise<void> {
  try {
    const supabase = getSupabaseClient()
    const meta = params.sender ? { sender: params.sender } : null
    await supabase.from('whatsapp_messages').insert({
      workspace_id: params.workspaceId,
      phone: params.chatKey,
      direction: params.direction,
      body: params.body,
      meta,
    })
  } catch (error) {
    console.error('logMessage', error)
  }
}

/** Últimos mensajes del chat (para dar contexto al modelo). */
async function recentHistory(chatKey: string): Promise<Anthropic.MessageParam[]> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('whatsapp_messages')
    .select('direction, body, created_at')
    .eq('phone', chatKey)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)
  const rows = (data ?? []).slice().reverse()
  const msgs: Anthropic.MessageParam[] = []
  rows.forEach(r => {
    const body = (r.body as string) || ''
    if (!body) return
    const trimmed = body.length > HISTORY_BODY_MAX ? body.slice(0, HISTORY_BODY_MAX) + '…' : body
    msgs.push({ role: r.direction === 'in' ? 'user' : 'assistant', content: trimmed })
  })
  return msgs
}

// ---------------------------------------------------------------------------
// Ejecución de acciones
// ---------------------------------------------------------------------------

/** Proyecto "General" del negocio (se crea perezosamente) para movimientos sueltos. */
async function ensureDefaultProject(biz: WaBusiness): Promise<string | null> {
  const supabase = getSupabaseClient()
  const { data: found } = await supabase
    .from('projects')
    .select('id')
    .eq('workspace_id', biz.workspaceId)
    .eq('name', 'General')
    .limit(1)
  if (found && found.length > 0) return found[0].id

  const today = new Date().toISOString().slice(0, 10)
  const { data: created, error } = await supabase
    .from('projects')
    .insert({
      workspace_id: biz.workspaceId,
      user_id: biz.userId,
      name: 'General',
      description: 'Movimientos registrados por WhatsApp',
      client: 'General',
      start_date: today,
      status: 'active',
      budget: 0,
    })
    .select('id')
    .single()
  if (error) {
    console.error('ensureDefaultProject', error)
    return null
  }
  return created?.id ?? null
}

function toDateOnly(value: unknown): string {
  if (typeof value === 'string' && value.length >= 10) {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  return new Date().toISOString().slice(0, 10)
}

async function execRegistrarMovimiento(biz: WaBusiness, input: any): Promise<string> {
  const tipo = input?.tipo === 'gasto' ? 'expense' : 'income'
  const amount = Number(input?.monto)
  if (!Number.isFinite(amount) || amount <= 0) return 'ERROR: monto inválido'
  const description = typeof input?.descripcion === 'string' && input.descripcion.trim()
    ? input.descripcion.trim()
    : tipo === 'income' ? 'Ingreso' : 'Gasto'
  const category = typeof input?.categoria === 'string' && input.categoria.trim()
    ? input.categoria.trim()
    : tipo === 'income' ? 'Ventas' : 'Gastos'

  const projectId = await ensureDefaultProject(biz)
  if (!projectId) return 'ERROR: no se pudo preparar el registro'

  const supabase = getSupabaseClient()
  const { data: cat } = await supabase
    .from('categories')
    .select('id')
    .eq('workspace_id', biz.workspaceId)
    .eq('name', category)
    .eq('type', tipo)
    .maybeSingle()

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      workspace_id: biz.workspaceId,
      user_id: biz.userId,
      project_id: projectId,
      type: tipo,
      category_id: cat?.id ?? null,
      category_name: category,
      description,
      amount,
      date: toDateOnly(input?.fecha),
      payment_method: typeof input?.metodo_pago === 'string' && input.metodo_pago.trim() ? input.metodo_pago.trim() : 'cash',
      attachments: [],
    })
    .select('id')
    .single()
  if (error) {
    console.error('execRegistrarMovimiento', error)
    return 'ERROR: no se pudo guardar el movimiento'
  }
  return `OK: ${tipo === 'income' ? 'ingreso' : 'gasto'} de ${amount} registrado (id ${data?.id}).`
}

async function execRegistrarCliente(biz: WaBusiness, input: any): Promise<string> {
  const name = typeof input?.nombre === 'string' ? input.nombre.trim() : ''
  if (!name) return 'ERROR: falta el nombre del cliente'
  const phone = typeof input?.telefono === 'string' ? normalizePhone(input.telefono) : ''
  const supabase = getSupabaseClient()

  // Evitar duplicados por teléfono.
  if (phone) {
    const { data: dup } = await supabase
      .from('clients')
      .select('id')
      .eq('workspace_id', biz.workspaceId)
      .eq('phone', phone)
      .limit(1)
    if (dup && dup.length > 0) return `OK: el cliente ya existía (id ${dup[0].id}).`
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({
      workspace_id: biz.workspaceId,
      name,
      phone: phone || null,
      notes: typeof input?.notas === 'string' && input.notas.trim() ? input.notas.trim() : null,
    })
    .select('id')
    .single()
  if (error) {
    console.error('execRegistrarCliente', error)
    return 'ERROR: no se pudo guardar el cliente'
  }
  return `OK: cliente "${name}" registrado (id ${data?.id}).`
}

async function execAgendarCita(biz: WaBusiness, input: any): Promise<string> {
  const clientName = typeof input?.cliente === 'string' ? input.cliente.trim() : ''
  if (!clientName) return 'ERROR: falta el nombre del cliente'
  const startsAtRaw = input?.inicio
  const starts = startsAtRaw ? new Date(startsAtRaw) : null
  if (!starts || Number.isNaN(starts.getTime())) return 'ERROR: fecha/hora inválida'

  let durationMin = Number(input?.duracion_min)
  if (!Number.isFinite(durationMin) || durationMin <= 0) durationMin = 30
  let price = Number(input?.precio)
  if (!Number.isFinite(price) || price < 0) price = 0

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      workspace_id: biz.workspaceId,
      user_id: biz.userId,
      client_name: clientName,
      client_phone: typeof input?.telefono === 'string' ? normalizePhone(input.telefono) || null : null,
      title: typeof input?.servicio === 'string' && input.servicio.trim() ? input.servicio.trim() : null,
      starts_at: starts.toISOString(),
      duration_min: Math.round(durationMin),
      price,
      status: 'scheduled',
      notes: typeof input?.notas === 'string' && input.notas.trim() ? input.notas.trim() : 'Registrado por WhatsApp',
    })
    .select('id')
    .single()
  if (error) {
    console.error('execAgendarCita', error)
    return 'ERROR: no se pudo agendar la cita'
  }
  return `OK: cita de "${clientName}" agendada (id ${data?.id}).`
}

// ---------------------------------------------------------------------------
// Herramientas expuestas al modelo (según los módulos del plan)
// ---------------------------------------------------------------------------

type ToolExec = (biz: WaBusiness, input: any) => Promise<string>

function buildTools(biz: WaBusiness): { tools: Anthropic.Tool[]; execs: Record<string, ToolExec> } {
  const tools: Anthropic.Tool[] = []
  const execs: Record<string, ToolExec> = {}
  const has = (m: ModuleKey) => hasModule(biz.planTier, m)

  // `strict: true` garantiza que los parámetros lleguen validados contra el
  // esquema (requiere additionalProperties:false). Elimina toda una clase de
  // errores: montos como texto, campos inventados, JSON mal formado. Los campos
  // que NO están en `required` siguen siendo opcionales.

  // Ingresos / gastos (módulo core: siempre disponible).
  tools.push({
    name: 'registrar_movimiento',
    description: 'Registra dinero que entró (ingreso) o salió (gasto) del negocio.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: ['ingreso', 'gasto'] },
        monto: { type: 'number', description: 'Solo el número' },
        descripcion: { type: 'string', description: 'Qué fue (ej. corte de pelo)' },
        categoria: { type: 'string', description: 'Ej. Ventas, Insumos' },
        metodo_pago: { type: 'string', description: 'efectivo, transferencia o tarjeta' },
        fecha: { type: 'string', description: 'YYYY-MM-DD. Por defecto hoy.' },
      },
      required: ['tipo', 'monto'],
      additionalProperties: false,
    },
  })
  execs['registrar_movimiento'] = execRegistrarMovimiento

  // Clientes (módulo sales).
  if (has('sales')) {
    tools.push({
      name: 'registrar_cliente',
      description: 'Guarda un cliente nuevo en la libreta del negocio.',
      strict: true,
      input_schema: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          telefono: { type: 'string' },
          notas: { type: 'string' },
        },
        required: ['nombre'],
        additionalProperties: false,
      },
    })
    execs['registrar_cliente'] = execRegistrarCliente
  }

  // Citas (módulo agenda).
  if (has('agenda')) {
    tools.push({
      name: 'agendar_cita',
      description: 'Agenda una cita o turno para un cliente.',
      strict: true,
      input_schema: {
        type: 'object',
        properties: {
          cliente: { type: 'string' },
          telefono: { type: 'string' },
          servicio: { type: 'string', description: 'Ej. corte, barba' },
          inicio: { type: 'string', description: 'ISO 8601 con zona horaria, ej. 2026-07-25T15:00:00-04:00' },
          duracion_min: { type: 'number', description: 'Por defecto 30' },
          precio: { type: 'number' },
          notas: { type: 'string' },
        },
        required: ['cliente', 'inicio'],
        additionalProperties: false,
      },
    })
    execs['agendar_cita'] = execAgendarCita
  }

  return { tools, execs }
}

// ---------------------------------------------------------------------------
// Prompt del sistema
// ---------------------------------------------------------------------------

function localNow(locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale || 'es-DO', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: TZ,
    }).format(new Date())
  } catch {
    return new Date().toISOString()
  }
}

// El prompt se mantiene corto a propósito: va en CADA llamada, y con el modelo
// por defecto (Haiku) el prefijo no alcanza el mínimo cacheable, así que cada
// token de más se paga siempre. Condensar aquí es la palanca de costo directa.
function systemPrompt(biz: WaBusiness, isGroup: boolean): string {
  const lines = [
    `Asistente de "${biz.name}" (${biz.businessType}). El dueño te manda notas cortas por WhatsApp, en español coloquial y con errores: entiéndelas y regístralas con tus herramientas.`,
    `Moneda: ${biz.currency}. Ahora: ${localNow(biz.locale)} (${TZ}).`,
    ``,
    `REGLAS`,
    `1. Dinero o cita: resume y pide confirmación ("¿Lo anoto?"). Registra solo cuando confirme (sí, dale, ok...). Un cliente sin monto ni cita regístralo directo.`,
    `2. Varias cosas en un mensaje: resúmelas todas y confirma una sola vez.`,
    `3. Falta un dato: pregúntalo, corto y concreto. Nunca inventes.`,
    `4. Fechas relativas ("mañana 3pm", "el viernes"): resuélvelas con la fecha actual, en ISO 8601 con zona horaria.`,
    `5. Responde en español, cálido, 1-2 frases máximo. Sin tecnicismos ni IDs.`,
  ]
  if (isGroup) {
    lines.push(
      `6. GRUPO: hay más gente conversando. Si el mensaje no es una anotación ni una confirmación de algo que preguntaste, responde solo "${IGNORE_SENTINEL}", nada más.`
    )
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Loop del agente
// ---------------------------------------------------------------------------

function textFromContent(content: Anthropic.ContentBlock[]): string {
  const parts: string[] = []
  content.forEach(block => {
    if (block.type === 'text') parts.push(block.text)
  })
  return parts.join('\n').trim()
}

/** Corre el agente. Devuelve el texto de respuesta, o null si hay que callar (grupos). */
async function runAgent(biz: WaBusiness, chat: WaChat, userText: string): Promise<string | null> {
  const client = getAnthropic()
  const { tools, execs } = buildTools(biz)

  const history = await recentHistory(chat.key)
  const messages: Anthropic.MessageParam[] = history.slice()
  messages.push({ role: 'user', content: userText })

  const system = systemPrompt(biz, chat.isGroup)
  let reply = ''

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: aiModel(),
      max_tokens: 1024,
      system,
      tools,
      messages,
    })

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    )

    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      reply = textFromContent(response.content)
      break
    }

    // Ejecutar herramientas y devolver resultados.
    messages.push({ role: 'assistant', content: response.content })
    const results: Anthropic.ToolResultBlockParam[] = []
    for (let j = 0; j < toolUses.length; j++) {
      const tu = toolUses[j]
      const exec = execs[tu.name]
      let out = 'ERROR: herramienta desconocida'
      if (exec) {
        try {
          out = await exec(biz, tu.input)
        } catch (error) {
          console.error('tool exec', tu.name, error)
          out = 'ERROR: fallo al ejecutar'
        }
      }
      results.push({ type: 'tool_result', tool_use_id: tu.id, content: out })
    }
    messages.push({ role: 'user', content: results })
  }

  const trimmed = (reply || '').trim()
  // En grupos, si el modelo decide no intervenir, callamos.
  if (chat.isGroup && (trimmed === '' || trimmed.toUpperCase() === IGNORE_SENTINEL)) {
    return null
  }
  return trimmed || 'Anotado. ✅'
}

// ---------------------------------------------------------------------------
// Entrada principal
// ---------------------------------------------------------------------------

export interface InboundResult {
  reply: string | null
  workspaceId: string | null
  handled: boolean
}

/**
 * Procesa un mensaje entrante de WhatsApp (chat directo o de grupo): registra en
 * bitácora, intenta vincular por código, y si el chat está vinculado corre el
 * agente. Devuelve el texto de respuesta a enviar (o null si no hay que responder).
 */
export async function handleInboundMessage(chat: WaChat, text: string): Promise<InboundResult> {
  const body = (text || '').trim()
  if (!chat.key || !body) return { reply: null, workspaceId: null, handled: false }

  // 1) ¿Es un código de vinculación?
  const linked = await tryLinkByCode(chat.key, body, chat.isGroup)
  if (linked) {
    const reply = chat.isGroup
      ? `¡Listo! Este grupo quedó conectado a "${linked}". 🎉\nEscriban aquí sus ventas, gastos, clientes o citas y yo los anoto.`
      : `¡Listo! Tu WhatsApp quedó conectado a "${linked}". 🎉\nEscríbeme tus ventas, gastos, clientes o citas y yo los anoto.`
    await logMessage({ workspaceId: null, chatKey: chat.key, direction: 'in', body, sender: chat.sender })
    const biz = await resolveBusinessForChat(chat.key)
    await logMessage({ workspaceId: biz?.workspaceId ?? null, chatKey: chat.key, direction: 'out', body: reply })
    return { reply, workspaceId: biz?.workspaceId ?? null, handled: true }
  }

  // 2) ¿Está vinculado a un negocio?
  const biz = await resolveBusinessForChat(chat.key)
  if (!biz) {
    await logMessage({ workspaceId: null, chatKey: chat.key, direction: 'in', body, sender: chat.sender })
    // En un grupo no vinculado, callamos para no hacer ruido.
    if (chat.isGroup) return { reply: null, workspaceId: null, handled: true }
    const reply =
      'Hola 👋 Este es el asistente de Jobidai. Para empezar a usar tu WhatsApp para anotar ventas y gastos, abre la app, ve a "Conectar WhatsApp" y envíame el código que te muestra.'
    await logMessage({ workspaceId: null, chatKey: chat.key, direction: 'out', body: reply })
    return { reply, workspaceId: null, handled: true }
  }

  await logMessage({ workspaceId: biz.workspaceId, chatKey: chat.key, direction: 'in', body, sender: chat.sender })

  // 3) ¿Está la IA configurada?
  if (!aiConfigured()) {
    if (chat.isGroup) return { reply: null, workspaceId: biz.workspaceId, handled: true }
    const reply = 'Recibí tu mensaje, pero el asistente aún no está activo. Inténtalo más tarde.'
    await logMessage({ workspaceId: biz.workspaceId, chatKey: chat.key, direction: 'out', body: reply })
    return { reply, workspaceId: biz.workspaceId, handled: true }
  }

  // 4) Correr el agente.
  let reply: string | null
  try {
    reply = await runAgent(biz, chat, body)
  } catch (error) {
    console.error('runAgent', error)
    reply = chat.isGroup ? null : 'Uy, tuve un problema para procesar eso. ¿Puedes repetirlo?'
  }
  if (reply) {
    await logMessage({ workspaceId: biz.workspaceId, chatKey: chat.key, direction: 'out', body: reply })
  }
  return { reply, workspaceId: biz.workspaceId, handled: true }
}
