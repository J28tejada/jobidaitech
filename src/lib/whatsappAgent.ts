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

import { getSupabaseClient } from './supabase'
import { aiConfigured, aiMissingKeyName } from './ai'
import { runToolConversation, type AgentMessage, type AgentTool } from './aiAgent'
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

/**
 * Carga el contexto de negocio de un espacio (nombre, rubro, moneda, plan).
 * `preferredUserId` es a quién se le atribuyen los registros; si no viene, se usa
 * el dueño del espacio.
 */
export async function loadBusiness(
  workspaceId: string,
  preferredUserId?: string | null
): Promise<WaBusiness | null> {
  if (!workspaceId) return null
  const supabase = getSupabaseClient()

  // select('*') para tolerar columnas de migraciones aún no corridas.
  const { data: ws } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
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
    userId: preferredUserId || (ws.owner_id as string),
    name: ws.name ?? 'tu negocio',
    businessType: (ws.business_type as string) || 'other',
    currency: (ws.currency as string) || DEFAULT_CURRENCY,
    locale: (ws.locale as string) || DEFAULT_LOCALE,
    planTier,
  }
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

  return loadBusiness(link.workspace_id as string, link.user_id as string | null)
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
async function recentHistory(chatKey: string): Promise<AgentMessage[]> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('whatsapp_messages')
    .select('direction, body, created_at')
    .eq('phone', chatKey)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)
  const rows = (data ?? []).slice().reverse()
  const msgs: AgentMessage[] = []
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

/**
 * Escribe el movimiento. No se llama desde la herramienta: se llama al confirmar
 * la acción pendiente (ver `aplicarPendiente`).
 */
async function aplicarMovimiento(biz: WaBusiness, input: any): Promise<string> {
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
    console.error('aplicarMovimiento', error)
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

/** Anota que alguien quedó debiendo. Solo se llama al confirmar. */
async function aplicarDeuda(biz: WaBusiness, input: any): Promise<string> {
  const client = typeof input?.cliente === 'string' ? input.cliente.trim() : ''
  if (!client) return 'ERROR: falta el cliente'
  const amount = Number(input?.monto)
  if (!Number.isFinite(amount) || amount <= 0) return 'ERROR: monto inválido'

  const { data, error } = await getSupabaseClient()
    .from('receivables')
    .insert({
      workspace_id: biz.workspaceId,
      user_id: biz.userId,
      client,
      client_phone: typeof input?.telefono === 'string' ? normalizePhone(input.telefono) || null : null,
      description: typeof input?.descripcion === 'string' && input.descripcion.trim() ? input.descripcion.trim() : null,
      amount,
      due_date: typeof input?.vence === 'string' && input.vence.length >= 10 ? toDateOnly(input.vence) : null,
      status: 'open',
    })
    .select('id')
    .single()
  if (error) {
    console.error('aplicarDeuda', error)
    return 'ERROR: no se pudo anotar la deuda'
  }
  return `OK: deuda de ${client} por ${amount} anotada (id ${data?.id}).`
}

/**
 * Registra un abono contra la deuda abierta más vieja del cliente y, si queda
 * saldada, la cierra. Si el abono supera lo que debe esa cuenta, se aplica solo
 * hasta cubrirla: no se reparte sobre otras deudas ni se guarda a favor, porque
 * eso ya es criterio contable y debe decidirlo el dueño en la app.
 */
async function aplicarAbono(biz: WaBusiness, input: any): Promise<string> {
  const cliente = typeof input?.cliente === 'string' ? input.cliente.trim() : ''
  if (!cliente) return 'ERROR: falta el cliente'
  const monto = Number(input?.monto)
  if (!Number.isFinite(monto) || monto <= 0) return 'ERROR: monto inválido'

  const supabase = getSupabaseClient()
  const { data: deudas, error } = await supabase
    .from('receivables')
    .select('id,client,amount')
    .eq('workspace_id', biz.workspaceId)
    .eq('status', 'open')
    .ilike('client', `%${cliente}%`)
    .order('created_at', { ascending: true })
  if (error) {
    console.error('aplicarAbono', error)
    return 'ERROR: no se pudo registrar el abono'
  }
  if (!deudas?.length) return `ERROR: no encontré una deuda abierta de "${cliente}"`

  const { data: pagos } = await supabase
    .from('receivable_payments')
    .select('receivable_id,amount')
    .eq('workspace_id', biz.workspaceId)
  const abonado = new Map<string, number>()
  for (const p of (pagos ?? []) as any[]) {
    abonado.set(p.receivable_id, (abonado.get(p.receivable_id) ?? 0) + (Number(p.amount) || 0))
  }
  const objetivo = (deudas as any[]).find(d => (Number(d.amount) || 0) - (abonado.get(d.id) ?? 0) > 0)
  if (!objetivo) return `ERROR: "${cliente}" no tiene saldo pendiente`

  const saldo = (Number(objetivo.amount) || 0) - (abonado.get(objetivo.id) ?? 0)
  const aplicar = Math.min(monto, saldo)

  const { error: errPago } = await supabase.from('receivable_payments').insert({
    receivable_id: objetivo.id,
    workspace_id: biz.workspaceId,
    user_id: biz.userId,
    amount: aplicar,
    date: toDateOnly(input?.fecha),
    method: typeof input?.metodo === 'string' && input.metodo.trim() ? input.metodo.trim() : null,
  })
  if (errPago) {
    console.error('aplicarAbono pago', errPago)
    return 'ERROR: no se pudo registrar el abono'
  }

  const resta = saldo - aplicar
  if (resta <= 0) {
    await supabase.from('receivables').update({ status: 'paid' }).eq('id', objetivo.id)
    return `OK: abono de ${aplicar} registrado. ${objetivo.client} quedó al día.`
  }
  return `OK: abono de ${aplicar} registrado. ${objetivo.client} debe ${resta}.`
}

/** Escribe la cita. Igual que el movimiento: solo se llama al confirmar. */
async function aplicarCita(biz: WaBusiness, input: any): Promise<string> {
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
    console.error('aplicarCita', error)
    return 'ERROR: no se pudo agendar la cita'
  }
  return `OK: cita de "${clientName}" agendada (id ${data?.id}).`
}

// ---------------------------------------------------------------------------
// Acciones pendientes de confirmación
// ---------------------------------------------------------------------------
//
// Las acciones con plata o con cita NO se escriben cuando el modelo llama a la
// herramienta: se guardan en `whatsapp_pending_actions` con su payload exacto y
// se ejecutan recién cuando el dueño confirma.
//
// El motivo es que la confirmación conversacional es frágil: dependía de que el
// modelo recordara en el historial qué había propuesto y de que interpretara el
// "dale". Si el historial se corta o llegan dos notas seguidas, podía registrar
// lo que no era, o perder una confirmación válida.
//
// Efecto lateral bienvenido: un "sí" se resuelve sin llamar al modelo, así que
// la confirmación —el mensaje más frecuente del flujo— pasa a costar cero.

type TipoPendiente = 'movimiento' | 'cita' | 'deuda' | 'abono'

const PENDIENTE_VIGENCIA_MIN = 30

/** Deja la acción en espera y devuelve al modelo el texto a transmitir. */
async function crearPendiente(
  biz: WaBusiness,
  chatKey: string,
  kind: TipoPendiente,
  payload: any,
  resumen: string
): Promise<string> {
  const supabase = getSupabaseClient()
  try {
    // Una sola pendiente viva por chat: si hay otra, queda sin efecto. Con dos
    // abiertas, un "sí" sería ambiguo.
    await supabase
      .from('whatsapp_pending_actions')
      .update({ status: 'expired' })
      .eq('workspace_id', biz.workspaceId)
      .eq('phone', chatKey)
      .eq('status', 'pending')

    const { error } = await supabase.from('whatsapp_pending_actions').insert({
      workspace_id: biz.workspaceId,
      phone: chatKey,
      kind,
      payload,
      summary: resumen,
      status: 'pending',
      expires_at: new Date(Date.now() + PENDIENTE_VIGENCIA_MIN * 60000).toISOString(),
    })
    if (error) {
      console.error('crearPendiente', error)
      return 'ERROR: no se pudo preparar la confirmación'
    }
  } catch (error) {
    console.error('crearPendiente', error)
    return 'ERROR: no se pudo preparar la confirmación'
  }
  return `PENDIENTE: ${resumen}. Pídele confirmación al dueño; no lo des por hecho.`
}

/** Pendiente viva del chat, o null. */
async function pendienteVigente(chatKey: string): Promise<any | null> {
  try {
    const supabase = getSupabaseClient()
    const { data } = await supabase
      .from('whatsapp_pending_actions')
      .select('id,kind,payload,summary,expires_at')
      .eq('phone', chatKey)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
    const row = data?.[0]
    if (!row) return null
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      await supabase.from('whatsapp_pending_actions').update({ status: 'expired' }).eq('id', row.id)
      return null
    }
    return row
  } catch (error) {
    console.error('pendienteVigente', error)
    return null
  }
}

async function cerrarPendiente(id: string, status: 'confirmed' | 'cancelled'): Promise<void> {
  try {
    await getSupabaseClient().from('whatsapp_pending_actions').update({ status }).eq('id', id)
  } catch (error) {
    console.error('cerrarPendiente', error)
  }
}

/** Ejecuta el payload guardado tal cual: sin criterio del modelo de por medio. */
async function aplicarPendiente(biz: WaBusiness, row: any): Promise<string> {
  let res: string
  switch (row.kind as TipoPendiente) {
    case 'cita':
      res = await aplicarCita(biz, row.payload)
      break
    case 'deuda':
      res = await aplicarDeuda(biz, row.payload)
      break
    case 'abono':
      res = await aplicarAbono(biz, row.payload)
      break
    default:
      res = await aplicarMovimiento(biz, row.payload)
  }
  await cerrarPendiente(row.id, 'confirmed')
  return res
}

/**
 * Texto para el dueño después de confirmar.
 *
 * En abonos se prefiere el detalle que devuelve la escritura porque incluye el
 * saldo que queda, que es justo lo que se quiere saber. En los demás alcanza el
 * resumen: lo que devuelve la escritura trae el id y el prompt prohíbe mostrarlo.
 * Los ERROR con motivo concreto ("no encontré una deuda abierta de Juan") se
 * transmiten tal cual: son accionables, a diferencia de un fallo genérico.
 */
function textoConfirmacion(pendiente: any, res: string): string {
  if (!res.startsWith('OK')) {
    return res.startsWith('ERROR: ')
      ? `Uy, ${res.slice(7)}.`
      : 'Uy, no pude guardarlo. ¿Lo intentamos de nuevo?'
  }
  if (pendiente.kind === 'abono') return `${res.replace(/^OK:\s*/, '').trim()} ✅`
  return `Listo, anoté ${pendiente.summary}. ✅`
}

/**
 * Normaliza para comparar: minúsculas, sin tildes ni signos.
 * NFD separa la tilde en un carácter aparte y el segundo `replace` borra ese
 * bloque combinante (U+0300–U+036F). Va como rango literal y no como
 * `\p{Diacritic}` porque el target es ES5 y las property escapes piden ES2018.
 */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

const AFIRMACIONES = new Set([
  'si', 'sii', 'siii', 'sip', 'dale', 'ok', 'oka', 'okey', 'okay', 'claro', 'correcto',
  'confirmo', 'confirmado', 'exacto', 'perfecto', 'va', 'vale', 'listo', 'adelante',
  'anotalo', 'guardalo', 'hazlo', 'yes', 'y', 'sisi', 'asi es', 'esta bien', 'si dale',
  'si porfavor', 'si por favor', 'de una', 'obvio',
])

const NEGACIONES = new Set([
  'no', 'nop', 'nel', 'cancela', 'cancelar', 'cancelalo', 'olvidalo', 'olvidalo ya',
  'mejor no', 'no gracias', 'negativo', 'nada', 'no aun', 'todavia no', 'espera',
])

// Solo se consideran mensajes cortos: "sí pero cambiá el monto a 300" no es una
// confirmación, es una corrección, y tiene que llegarle al modelo.
function claseRespuesta(texto: string): 'si' | 'no' | null {
  const t = normalizar(texto)
  if (!t || t.split(/\s+/).length > 3) return null
  if (AFIRMACIONES.has(t)) return 'si'
  if (NEGACIONES.has(t)) return 'no'
  return null
}

/** Fecha YYYY-MM-DD desde un valor suelto, con respaldo si no es usable. */
function fechaOpc(value: unknown, porDefecto: string): string {
  if (typeof value === 'string' && value.length >= 10) {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  return porDefecto
}

// Consulta de solo lectura, siempre acotada al workspace del chat.
//
// El resultado se devuelve en texto compacto a propósito: vuelve al modelo como
// salida de herramienta y se paga como contexto en esa llamada y en las
// siguientes del historial. Se prioriza el dato sobre el formato: sin JSON, sin
// etiquetas repetidas y sin IDs (que el prompt además prohíbe mostrar).
async function execConsultar(biz: WaBusiness, input: any): Promise<string> {
  const supabase = getSupabaseClient()
  const limite = Math.min(Math.max(Math.round(Number(input?.limite)) || 5, 1), 20)
  const buscar = typeof input?.buscar === 'string' ? input.buscar.trim() : ''
  const hoy = new Date().toISOString().slice(0, 10)
  const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const desde = fechaOpc(input?.desde, hace30)
  const hasta = fechaOpc(input?.hasta, hoy)

  switch (input?.recurso) {
    case 'movimientos': {
      // Se leen hasta 200 filas para que los totales cubran el período completo
      // y no solo las que se alcanzan a listar.
      const { data, error } = await supabase
        .from('transactions')
        .select('type,amount,description,category_name,date')
        .eq('workspace_id', biz.workspaceId)
        .gte('date', desde)
        .lte('date', hasta)
        .order('date', { ascending: false })
        .limit(200)
      if (error) {
        console.error('execConsultar movimientos', error)
        return 'ERROR: no se pudo consultar'
      }
      if (!data?.length) return `Sin movimientos entre ${desde} y ${hasta}.`
      let ing = 0
      let gas = 0
      for (const t of data as any[]) {
        if (t.type === 'income') ing += Number(t.amount) || 0
        else gas += Number(t.amount) || 0
      }
      const filas = (data as any[])
        .slice(0, limite)
        .map(t => `${String(t.date).slice(5)} ${t.type === 'income' ? '+' : '-'}${t.amount} ${t.description || t.category_name || ''}`.trim())
        .join('; ')
      return `${desde}..${hasta}: ingresos ${ing}, gastos ${gas}, ganancia ${ing - gas}, ${data.length} movs. Últimos: ${filas}`
    }

    case 'citas': {
      // Sin `desde` explícito se asume "de ahora en adelante": la pregunta
      // habitual es por lo que viene, no por lo que ya pasó.
      const desdeTs = input?.desde ? `${desde}T00:00:00` : new Date().toISOString()
      let q = supabase
        .from('appointments')
        .select('client_name,title,starts_at,status')
        .eq('workspace_id', biz.workspaceId)
        .gte('starts_at', desdeTs)
        .order('starts_at', { ascending: true })
        .limit(limite)
      if (input?.hasta) q = q.lte('starts_at', `${hasta}T23:59:59`)
      const { data, error } = await q
      if (error) {
        console.error('execConsultar citas', error)
        return 'ERROR: no se pudo consultar'
      }
      if (!data?.length) return 'Sin citas en ese rango.'
      return (data as any[])
        .map(c => {
          const cuando = String(c.starts_at).slice(5, 16).replace('T', ' ')
          const serv = c.title ? ` (${c.title})` : ''
          const est = c.status && c.status !== 'scheduled' ? ` [${c.status}]` : ''
          return `${cuando} ${c.client_name}${serv}${est}`
        })
        .join('; ')
    }

    case 'clientes': {
      let q = supabase
        .from('clients')
        .select('name,phone')
        .eq('workspace_id', biz.workspaceId)
        .order('name', { ascending: true })
        .limit(limite)
      if (buscar) q = q.ilike('name', `%${buscar}%`)
      const { data, error } = await q
      if (error) {
        console.error('execConsultar clientes', error)
        return 'ERROR: no se pudo consultar'
      }
      if (!data?.length) return buscar ? `Sin clientes que coincidan con "${buscar}".` : 'Sin clientes registrados.'
      return (data as any[]).map(c => `${c.name}${c.phone ? ` ${c.phone}` : ''}`).join('; ')
    }

    case 'cobros': {
      // El saldo real es el monto menos los abonos: `receivables.amount` es el
      // importe original, así que informarlo solo sería engañoso.
      // `receivable_payments` lleva workspace_id denormalizado, con lo que basta
      // una segunda consulta plana en vez de un join por fila.
      const { data: deudas, error } = await supabase
        .from('receivables')
        .select('id,client,amount,due_date')
        .eq('workspace_id', biz.workspaceId)
        .eq('status', 'open')
        .order('due_date', { ascending: true })
      if (error) {
        console.error('execConsultar cobros', error)
        return 'ERROR: no se pudo consultar'
      }
      if (!deudas?.length) return 'Nadie debe nada.'
      const { data: pagos } = await supabase
        .from('receivable_payments')
        .select('receivable_id,amount')
        .eq('workspace_id', biz.workspaceId)
      const abonado = new Map<string, number>()
      for (const p of (pagos ?? []) as any[]) {
        abonado.set(p.receivable_id, (abonado.get(p.receivable_id) ?? 0) + (Number(p.amount) || 0))
      }
      const saldos = (deudas as any[])
        .map(d => ({
          client: d.client as string,
          due: d.due_date as string | null,
          saldo: (Number(d.amount) || 0) - (abonado.get(d.id) ?? 0),
        }))
        .filter(d => d.saldo > 0)
      if (!saldos.length) return 'Nadie debe nada.'
      const total = saldos.reduce((s, d) => s + d.saldo, 0)
      const lista = saldos
        .filter(d => !buscar || d.client.toLowerCase().includes(buscar.toLowerCase()))
        .slice(0, limite)
        .map(d => `${d.client} ${d.saldo}${d.due ? ` vence ${String(d.due).slice(5)}` : ''}`)
        .join('; ')
      return `Deuda total ${total} en ${saldos.length} cuentas. ${lista}`
    }

    case 'inventario': {
      let q = supabase
        .from('products')
        .select('name,stock,unit,low_stock_threshold')
        .eq('workspace_id', biz.workspaceId)
        .eq('active', true)
        .order('name', { ascending: true })
        .limit(limite)
      if (buscar) q = q.ilike('name', `%${buscar}%`)
      const { data, error } = await q
      if (error) {
        console.error('execConsultar inventario', error)
        return 'ERROR: no se pudo consultar'
      }
      if (!data?.length) return buscar ? `Sin productos que coincidan con "${buscar}".` : 'Sin productos cargados.'
      return (data as any[])
        .map(p => {
          const bajo = Number(p.stock) <= Number(p.low_stock_threshold) ? ' BAJO' : ''
          return `${p.name} ${p.stock} ${p.unit || ''}${bajo}`.replace(/\s+/g, ' ').trim()
        })
        .join('; ')
    }

    default:
      return 'ERROR: recurso no válido'
  }
}

// ---------------------------------------------------------------------------
// Herramientas expuestas al modelo (según los módulos del plan)
// ---------------------------------------------------------------------------

function buildTools(biz: WaBusiness, chatKey: string): AgentTool[] {
  const tools: AgentTool[] = []
  const has = (m: ModuleKey) => hasModule(biz.planTier, m)

  // Los esquemas llevan `additionalProperties: false`: con Claude habilita
  // `strict` (la API valida los parámetros) y con Gemini se pasan tal cual vía
  // parametersJsonSchema. Los campos fuera de `required` son opcionales.

  // Ingresos / gastos (módulo core: siempre disponible).
  tools.push({
    name: 'registrar_movimiento',
    description: 'Registra dinero que entró (ingreso) o salió (gasto) del negocio.',
    schema: {
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
    run: input => {
      const monto = Number(input?.monto)
      if (!Number.isFinite(monto) || monto <= 0) return Promise.resolve('ERROR: monto inválido')
      const esGasto = input?.tipo === 'gasto'
      const desc = typeof input?.descripcion === 'string' && input.descripcion.trim() ? ` por ${input.descripcion.trim()}` : ''
      const fecha = toDateOnly(input?.fecha)
      const cuando = fecha === new Date().toISOString().slice(0, 10) ? '' : ` del ${fecha}`
      return crearPendiente(
        biz,
        chatKey,
        'movimiento',
        input,
        `${esGasto ? 'gasto' : 'ingreso'} de ${monto} ${biz.currency}${desc}${cuando}`
      )
    },
  })

  // Clientes (módulo sales).
  if (has('sales')) {
    tools.push({
      name: 'registrar_cliente',
      description: 'Guarda un cliente nuevo en la libreta del negocio.',
      schema: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          telefono: { type: 'string' },
          notas: { type: 'string' },
        },
        required: ['nombre'],
        additionalProperties: false,
      },
      run: input => execRegistrarCliente(biz, input),
    })
  }

  // Citas (módulo agenda).
  if (has('agenda')) {
    tools.push({
      name: 'agendar_cita',
      description: 'Agenda una cita o turno para un cliente.',
      schema: {
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
      run: input => {
        const cliente = typeof input?.cliente === 'string' ? input.cliente.trim() : ''
        if (!cliente) return Promise.resolve('ERROR: falta el nombre del cliente')
        const inicio = input?.inicio ? new Date(input.inicio) : null
        if (!inicio || Number.isNaN(inicio.getTime())) return Promise.resolve('ERROR: fecha/hora inválida')
        const cuando = new Intl.DateTimeFormat(biz.locale || DEFAULT_LOCALE, {
          dateStyle: 'short',
          timeStyle: 'short',
          timeZone: TZ,
        }).format(inicio)
        const serv = typeof input?.servicio === 'string' && input.servicio.trim() ? ` (${input.servicio.trim()})` : ''
        return crearPendiente(biz, chatKey, 'cita', input, `cita de ${cliente}${serv} el ${cuando}`)
      },
    })
  }

  // Cobros (módulo receivables). Las dos acciones van en un solo esquema por lo
  // mismo que `consultar`: dos herramientas sueltas pesarían el doble en cada
  // request, se usen o no.
  if (has('receivables')) {
    tools.push({
      name: 'cobro',
      description: 'Anota que alguien quedó debiendo, o que abonó a lo que debía.',
      schema: {
        type: 'object',
        properties: {
          accion: { type: 'string', enum: ['deuda', 'abono'] },
          cliente: { type: 'string' },
          monto: { type: 'number', description: 'Solo el número' },
          descripcion: { type: 'string', description: 'De qué es la deuda' },
          vence: { type: 'string', description: 'YYYY-MM-DD, solo para deuda' },
          metodo: { type: 'string', description: 'efectivo, transferencia... solo para abono' },
          telefono: { type: 'string' },
        },
        required: ['accion', 'cliente', 'monto'],
        additionalProperties: false,
      },
      run: input => {
        const monto = Number(input?.monto)
        if (!Number.isFinite(monto) || monto <= 0) return Promise.resolve('ERROR: monto inválido')
        const cliente = typeof input?.cliente === 'string' ? input.cliente.trim() : ''
        if (!cliente) return Promise.resolve('ERROR: falta el cliente')
        const esAbono = input?.accion === 'abono'
        const resumen = esAbono
          ? `abono de ${monto} ${biz.currency} de ${cliente}`
          : `deuda de ${cliente} por ${monto} ${biz.currency}`
        return crearPendiente(biz, chatKey, esAbono ? 'abono' : 'deuda', input, resumen)
      },
    })
  }

  // Consulta (solo lectura). UNA herramienta parametrizada en vez de una por
  // módulo: los esquemas viajan completos en CADA request, así que menos
  // superficie es directamente menos costo por mensaje. El enum se arma según
  // el plan para no ofrecerle al modelo recursos que no puede leer.
  const recursos = ['movimientos']
  if (has('agenda')) recursos.push('citas')
  if (has('sales')) recursos.push('clientes')
  if (has('receivables')) recursos.push('cobros')
  if (has('inventory')) recursos.push('inventario')
  tools.push({
    name: 'consultar',
    description: 'Consulta lo ya registrado para responder preguntas del dueño.',
    schema: {
      type: 'object',
      properties: {
        recurso: { type: 'string', enum: recursos },
        desde: { type: 'string', description: 'YYYY-MM-DD. Movimientos: por defecto 30 días atrás.' },
        hasta: { type: 'string', description: 'YYYY-MM-DD. Por defecto hoy.' },
        buscar: { type: 'string', description: 'Filtra por nombre (cliente, producto)' },
        limite: { type: 'number', description: 'Máx. filas. Por defecto 5' },
      },
      required: ['recurso'],
      additionalProperties: false,
    },
    run: input => execConsultar(biz, input),
  })

  return tools
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
    `Asistente de "${biz.name}" (${biz.businessType}). El dueño te manda notas cortas por WhatsApp, en español coloquial y con errores: entiéndelas y regístralas con tus herramientas. Si pregunta por datos ya registrados, búscalos con "consultar".`,
    `Moneda: ${biz.currency}. Ahora: ${localNow(biz.locale)} (${TZ}).`,
    ``,
    `REGLAS`,
    `1. Dinero o cita: llama la herramienta y transmite el resumen que devuelva preguntando "¿Lo anoto?". NO digas que quedó guardado: la confirmación la maneja el sistema. Un cliente sin monto ni cita regístralo directo.`,
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

/** Corre el agente. Devuelve el texto de respuesta, o null si hay que callar (grupos). */
async function runAgent(biz: WaBusiness, chat: WaChat, userText: string): Promise<string | null> {
  const reply = await runToolConversation({
    system: systemPrompt(biz, chat.isGroup),
    history: await recentHistory(chat.key),
    userText,
    tools: buildTools(biz, chat.key),
    maxIterations: MAX_TOOL_ITERATIONS,
  })

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

  // 3) ¿Responde a algo que quedó pendiente de confirmar?
  //
  // Va ANTES del agente y a propósito: un "sí" ejecuta el payload guardado tal
  // cual, sin que el modelo tenga que reconstruir de qué se hablaba. Además no
  // gasta una llamada al modelo, y la confirmación es el mensaje más repetido
  // del flujo. Si no es un sí/no claro, la pendiente sigue viva y el mensaje
  // sigue su curso normal (puede ser una corrección: "sí pero eran 300").
  const pendiente = await pendienteVigente(chat.key)
  if (pendiente) {
    const clase = claseRespuesta(body)
    if (clase === 'si') {
      const res = await aplicarPendiente(biz, pendiente)
      const reply = textoConfirmacion(pendiente, res)
      await logMessage({ workspaceId: biz.workspaceId, chatKey: chat.key, direction: 'out', body: reply })
      return { reply, workspaceId: biz.workspaceId, handled: true }
    }
    if (clase === 'no') {
      await cerrarPendiente(pendiente.id, 'cancelled')
      const reply = 'Listo, no lo anoto.'
      await logMessage({ workspaceId: biz.workspaceId, chatKey: chat.key, direction: 'out', body: reply })
      return { reply, workspaceId: biz.workspaceId, handled: true }
    }
  }

  // 4) ¿Está la IA configurada?
  if (!aiConfigured()) {
    if (chat.isGroup) return { reply: null, workspaceId: biz.workspaceId, handled: true }
    const reply = 'Recibí tu mensaje, pero el asistente aún no está activo. Inténtalo más tarde.'
    await logMessage({ workspaceId: biz.workspaceId, chatKey: chat.key, direction: 'out', body: reply })
    return { reply, workspaceId: biz.workspaceId, handled: true }
  }

  // 5) Correr el agente.
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

// ---------------------------------------------------------------------------
// Simulador (probar el agente desde la app, sin WhatsApp)
// ---------------------------------------------------------------------------
//
// Corre el MISMO agente y escribe los MISMOS datos, pero el espacio se toma de la
// sesión autenticada en vez de un número vinculado, y no se envía nada por
// WhatsApp. Usa su propia clave de chat para no mezclar el historial de prueba
// con el de una conversación real.

function simChatKey(workspaceId: string, isGroup: boolean): string {
  return `sim:${isGroup ? 'g' : 'd'}:${workspaceId}`
}

/** Procesa un mensaje de prueba contra el espacio indicado. */
export async function handleSimulatedMessage(params: {
  workspaceId: string
  userId: string
  text: string
  isGroup: boolean
}): Promise<{ reply: string | null; error?: string }> {
  const body = (params.text || '').trim()
  if (!body) return { reply: null, error: 'Escribe un mensaje.' }

  if (!aiConfigured()) {
    return {
      reply: null,
      error: `Falta ${aiMissingKeyName()}. Agrégala en las variables de entorno y vuelve a desplegar.`,
    }
  }

  const biz = await loadBusiness(params.workspaceId, params.userId)
  if (!biz) return { reply: null, error: 'No se pudo cargar el negocio.' }

  const key = simChatKey(params.workspaceId, params.isGroup)
  const chat: WaChat = { jid: key, key, isGroup: params.isGroup, sender: key }

  await logMessage({ workspaceId: biz.workspaceId, chatKey: key, direction: 'in', body })

  // Misma intercepción que en WhatsApp: el simulador corre el MISMO agente, así
  // que sin esto un "sí" volvería al modelo y solo crearía otra pendiente, sin
  // llegar a escribir nunca.
  const pendiente = await pendienteVigente(key)
  if (pendiente) {
    const clase = claseRespuesta(body)
    if (clase === 'si') {
      const res = await aplicarPendiente(biz, pendiente)
      const reply = textoConfirmacion(pendiente, res)
      await logMessage({ workspaceId: biz.workspaceId, chatKey: key, direction: 'out', body: reply })
      return { reply }
    }
    if (clase === 'no') {
      await cerrarPendiente(pendiente.id, 'cancelled')
      const reply = 'Listo, no lo anoto.'
      await logMessage({ workspaceId: biz.workspaceId, chatKey: key, direction: 'out', body: reply })
      return { reply }
    }
  }

  let reply: string | null
  try {
    reply = await runAgent(biz, chat, body)
  } catch (error) {
    console.error('handleSimulatedMessage', error)
    // Mostramos el error tal como lo da el proveedor: es lo único que distingue
    // "modelo inexistente" de "llave inválida" o "cuota agotada". Lo ve solo el
    // dueño del espacio y no contiene secretos.
    const detalle = error instanceof Error ? error.message : String(error)
    return { reply: null, error: `Falló la llamada al modelo: ${detalle}` }
  }

  if (reply) {
    await logMessage({ workspaceId: biz.workspaceId, chatKey: key, direction: 'out', body: reply })
  }
  return { reply }
}

/** Borra el historial de la conversación de prueba (para empezar de cero). */
export async function resetSimulatedChat(workspaceId: string): Promise<void> {
  const supabase = getSupabaseClient()
  await supabase
    .from('whatsapp_messages')
    .delete()
    .eq('workspace_id', workspaceId)
    .in('phone', [simChatKey(workspaceId, false), simChatKey(workspaceId, true)])
}
