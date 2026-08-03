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
import { normalizePhone, sendWhatsAppText } from './whatsapp'
import { hasModule, type PlanTier, type ModuleKey } from './modules'
import { archetypeFor, type Archetype } from './moduleProfiles'
import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from './format'

// Marca de origen en todo lo que escribe el agente. Un registro que entró por
// chat tiene que ser tan auditable como uno tecleado en la app: sin esto, ante
// un "¿esto quién lo puso?" no hay a qué mirar.
const ORIGEN = 'whatsapp'
const NOTA_ORIGEN = 'Registrado por WhatsApp'

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

export type ResultadoVinculo =
  | { estado: 'vinculado'; negocio: string }
  | { estado: 'cambiado'; negocio: string }
  | { estado: 'ajeno' }

/**
 * Si el texto trae un código válido, vincula el chat y devuelve qué pasó.
 * Devuelve null si no había código (el mensaje sigue su curso normal).
 *
 * El teléfono identifica a una PERSONA: `user_id` se fija en el primer vínculo y
 * no se reasigna. Antes, cualquier código válido reescribía el vínculo, así que
 * un dueño que reenviara un código sin pensar veía sus ventas caer en otro
 * negocio, sin ningún aviso. Un código de otra cuenta ahora se rechaza; uno de
 * la misma cuenta solo conmuta el negocio activo.
 */
export async function tryLinkByCode(
  chatKey: string,
  text: string,
  isGroup: boolean
): Promise<ResultadoVinculo | null> {
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

  const { data: existing } = await supabase
    .from('whatsapp_numbers')
    .select('id, user_id, workspace_id')
    .eq('phone', chatKey)
    .maybeSingle()

  // Un grupo no es una persona, así que ahí no aplica la identidad: se vincula
  // al negocio y punto.
  if (existing && !isGroup && existing.user_id && existing.user_id !== valid.user_id) {
    return { estado: 'ajeno' }
  }

  const yaEstaba = existing?.workspace_id === valid.workspace_id
  if (existing) {
    await supabase
      .from('whatsapp_numbers')
      .update({
        workspace_id: valid.workspace_id,
        // La identidad solo se escribe si faltaba (vínculos viejos o grupos).
        user_id: existing.user_id ?? valid.user_id,
        active: true,
        is_group: isGroup,
      })
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
  const negocio = ws?.name ?? 'tu negocio'
  return { estado: existing && !yaEstaba ? 'cambiado' : 'vinculado', negocio }
}

/**
 * Negocios entre los que este teléfono puede conmutar: aquellos donde su dueño
 * es miembro. Se valida contra workspace_members igual que la web, para que un
 * puntero viejo no dé acceso a un espacio del que ya lo sacaron.
 */
async function negociosDelTelefono(chatKey: string): Promise<{ id: string; name: string }[]> {
  const supabase = getSupabaseClient()
  const { data: num } = await supabase
    .from('whatsapp_numbers')
    .select('user_id')
    .eq('phone', chatKey)
    .maybeSingle()
  if (!num?.user_id) return []

  const { data: miembros } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', num.user_id)
  const ids = (miembros ?? []).map((m: any) => m.workspace_id)
  if (!ids.length) return []

  const { data: ws } = await supabase.from('workspaces').select('id,name').in('id', ids)
  return ((ws ?? []) as any[]).map(w => ({ id: w.id, name: w.name }))
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

/**
 * Resuelve a qué proyecto va un movimiento.
 *
 * Sin nombre cae en "General", que es lo correcto para negocios donde cada venta
 * es independiente. Con nombre busca por coincidencia parcial y, si no existe,
 * lo crea: en obra el dueño menciona el trabajo antes de haberlo dado de alta en
 * la app, y obligarlo a crearlo primero rompe la captura por chat.
 *
 * Si el nombre coincide con dos proyectos no se adivina. Imputar gastos a la
 * obra equivocada corrompe justo el número que estos negocios necesitan.
 */
async function resolverProyecto(biz: WaBusiness, nombre: unknown): Promise<{ id: string } | { error: string }> {
  const buscado = typeof nombre === 'string' ? nombre.trim() : ''
  if (!buscado) {
    const id = await ensureDefaultProject(biz)
    return id ? { id } : { error: 'no se pudo preparar el registro' }
  }

  const supabase = getSupabaseClient()
  const { data: hallados } = await supabase
    .from('projects')
    .select('id,name')
    .eq('workspace_id', biz.workspaceId)
    .ilike('name', `%${buscado}%`)
    .limit(2)
  if (hallados?.length === 1) return { id: (hallados[0] as any).id }
  if (hallados && hallados.length > 1) {
    return { error: `hay más de un proyecto que coincide con "${buscado}"; sé más específico` }
  }

  // `client` es NOT NULL y no se puede partir "obra de Pedro" en obra + cliente
  // de forma confiable, así que se repite el nombre. El dueño lo corrige en la app.
  const { data: creado, error } = await supabase
    .from('projects')
    .insert({
      workspace_id: biz.workspaceId,
      user_id: biz.userId,
      name: buscado,
      description: 'Creado por WhatsApp',
      client: buscado,
      start_date: new Date().toISOString().slice(0, 10),
      status: 'active',
      budget: 0,
    })
    .select('id')
    .single()
  if (error) {
    console.error('resolverProyecto crear', error)
    return { error: 'no se pudo crear el proyecto' }
  }
  return { id: (creado as any).id }
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
  // Descripción y categoría son obligatorias, igual que al cargar desde la app
  // (POST /api/transactions las exige). Antes se rellenaban con "Ingreso"/
  // "Gasto": el registro entraba, pero quedaba un monto sin concepto, imposible
  // de auditar después. Es preferible que el agente pregunte una vez.
  const description = typeof input?.descripcion === 'string' ? input.descripcion.trim() : ''
  if (!description) return 'ERROR: falta decir de qué fue'
  const category = typeof input?.categoria === 'string' && input.categoria.trim()
    ? input.categoria.trim()
    : tipo === 'income' ? 'Ventas' : 'Gastos'

  // `monto` es SIEMPRE el de cada unidad. Con cantidad > 1 y agrupar=false se
  // escribe una fila por unidad; con agrupar=true, una sola por el total. La
  // decisión la toma el dueño, no nosotros: diez cortes como diez registros
  // sirven para contar clientes y ver el ticket promedio; como uno solo, para
  // cerrar el día rápido. Ninguna de las dos es correcta siempre.
  const cantidad = Math.max(1, Math.round(Number(input?.cantidad) || 1))
  const agrupar = input?.agrupar !== false
  const filas = cantidad > 1 && !agrupar ? cantidad : 1
  const montoPorFila = cantidad > 1 && agrupar ? amount * cantidad : amount
  const descFila = cantidad > 1 && agrupar ? `${description} (${cantidad} x ${amount})` : description

  const supabase = getSupabaseClient()

  // En rubros que no trabajan por obra (barbería, tienda, restaurante) el gasto
  // va a `expenses` y no a `transactions`. Esa tabla existe justamente porque
  // `transactions.project_id` es NOT NULL y esos negocios no tienen proyectos:
  // forzarlos a uno llamado "General" ensucia el dato y, sobre todo, el panel y
  // /finanzas leen de `expenses`, así que un gasto en `transactions` les queda
  // invisible. Los ingresos sí siguen en `transactions`, que es de donde el
  // panel los suma.
  const arq = archetypeFor(biz.businessType)
  if (tipo === 'expense' && arq !== 'projects' && arq !== 'general') {
    const { error: errGasto } = await supabase.from('expenses').insert(
      Array.from({ length: filas }, () => ({
        workspace_id: biz.workspaceId,
        user_id: biz.userId,
        category,
        description: descFila,
        amount: montoPorFila,
        date: toDateOnly(input?.fecha),
        source: ORIGEN,
      }))
    )
    if (errGasto) {
      console.error('aplicarMovimiento gasto simple', errGasto)
      return 'ERROR: no se pudo guardar el gasto'
    }
    return filas > 1
      ? `OK: ${filas} gastos de ${montoPorFila} registrados.`
      : `OK: gasto de ${montoPorFila} registrado.`
  }

  const proyecto = await resolverProyecto(biz, input?.proyecto)
  if ('error' in proyecto) return `ERROR: ${proyecto.error}`
  const projectId = proyecto.id

  const { data: cat } = await supabase
    .from('categories')
    .select('id')
    .eq('workspace_id', biz.workspaceId)
    .eq('name', category)
    .eq('type', tipo)
    .maybeSingle()

  const { error } = await supabase.from('transactions').insert(
    Array.from({ length: filas }, () => ({
      workspace_id: biz.workspaceId,
      user_id: biz.userId,
      project_id: projectId,
      type: tipo,
      category_id: cat?.id ?? null,
      category_name: category,
      description: descFila,
      amount: montoPorFila,
      date: toDateOnly(input?.fecha),
      payment_method: typeof input?.metodo_pago === 'string' && input.metodo_pago.trim() ? input.metodo_pago.trim() : 'cash',
      // El comprobante que mandó por foto queda adjunto al movimiento, igual que
      // si lo hubiera subido desde la app. Sin esto la lectura sería una
      // anotación sin respaldo.
      attachments: input?.adjunto ? [input.adjunto] : [],
      source: ORIGEN,
    }))
  )
  if (error) {
    console.error('aplicarMovimiento', error)
    return 'ERROR: no se pudo guardar el movimiento'
  }
  const que = tipo === 'income' ? 'ingreso' : 'gasto'
  return filas > 1
    ? `OK: ${filas} ${que}s de ${montoPorFila} registrados.`
    : `OK: ${que} de ${montoPorFila} registrado.`
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
      notes: typeof input?.notas === 'string' && input.notas.trim() ? input.notas.trim() : NOTA_ORIGEN,
      source: ORIGEN,
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
      source: ORIGEN,
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

/**
 * Busca la próxima cita de un cliente por nombre. Devuelve la cita o el motivo.
 *
 * Se limita a citas FUTURAS y no canceladas a propósito: es lo que acota a quién
 * se le puede escribir. Sin ese filtro, el agente se convertiría en un canal
 * para mandar WhatsApp a cualquier número que aparezca en la base, y eso es
 * exactamente por lo que WhatsApp cierra cuentas.
 */
async function proximaCitaDe(
  biz: WaBusiness,
  nombre: string
): Promise<{ cita: any } | { error: string }> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('appointments')
    .select('id,client_name,client_phone,title,starts_at')
    .eq('workspace_id', biz.workspaceId)
    .in('status', ['scheduled', 'confirmed'])
    .gte('starts_at', new Date().toISOString())
    .ilike('client_name', `%${nombre}%`)
    .order('starts_at', { ascending: true })
    .limit(2)
  if (error) {
    console.error('proximaCitaDe', error)
    return { error: 'no se pudo buscar la cita' }
  }
  if (!data?.length) return { error: `no encontré una cita próxima de "${nombre}"` }
  if (data.length > 1) return { error: `"${nombre}" tiene más de una cita próxima; sé más específico` }
  const cita = data[0] as any
  if (!cita.client_phone) return { error: `la cita de ${cita.client_name} no tiene teléfono guardado` }
  return { cita }
}

/** Texto que se le manda al cliente. Siempre identifica al negocio. */
function textoAvisoCliente(biz: WaBusiness, cita: any, personalizado?: unknown): string {
  const cuando = new Intl.DateTimeFormat(biz.locale || DEFAULT_LOCALE, {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: TZ,
  }).format(new Date(cita.starts_at))
  const extra = typeof personalizado === 'string' && personalizado.trim() ? `\n${personalizado.trim()}` : ''
  const serv = cita.title ? ` (${cita.title})` : ''
  // El nombre del negocio va sí o sí: al cliente le entra un mensaje de un
  // número que no tiene agendado, y sin saber de quién es parece spam.
  return `Hola ${cita.client_name}, te recordamos tu cita en ${biz.name}${serv}: ${cuando}.${extra}`
}

/**
 * Instancia de Evolution con el WhatsApp propio del negocio, o null si todavía
 * no lo conectó.
 */
export async function instanciaDelNegocio(workspaceId: string): Promise<string | null> {
  try {
    const { data } = await getSupabaseClient()
      .from('workspaces')
      .select('evolution_instance')
      .eq('id', workspaceId)
      .maybeSingle()
    return (data as any)?.evolution_instance ?? null
  } catch (error) {
    console.error('instanciaDelNegocio', error)
    return null
  }
}

/**
 * Manda el recordatorio al cliente. Solo se llama al confirmar, como todo lo que
 * sale hacia afuera.
 *
 * Sale por el WhatsApp del NEGOCIO. Si no lo conectó, no se manda ni se cae al
 * número de la plataforma: al cliente le llegaría desde un número que no tiene
 * agendado —se lee como spam— y le cargaría a Jobidai la reputación de
 * mensajería de todos sus negocios.
 */
async function aplicarAvisoCliente(biz: WaBusiness, input: any): Promise<string> {
  const nombre = typeof input?.cliente === 'string' ? input.cliente.trim() : ''
  if (!nombre) return 'ERROR: falta el cliente'

  const instancia = await instanciaDelNegocio(biz.workspaceId)
  if (!instancia) {
    return 'ERROR: todavía no conectaste el WhatsApp del negocio. Entrá a Ajustes → WhatsApp del negocio y conectalo; así el mensaje le llega a tu cliente desde TU número'
  }

  const r = await proximaCitaDe(biz, nombre)
  if ('error' in r) return `ERROR: ${r.error}`

  const enviado = await sendWhatsAppText(
    r.cita.client_phone,
    textoAvisoCliente(biz, r.cita, input?.mensaje),
    instancia
  )
  if (!enviado) return 'ERROR: no se pudo enviar el mensaje'
  return `OK: le avisé a ${r.cita.client_name} desde tu número.`
}

const ETAPAS_ABIERTAS = ['new', 'contacted', 'quoted']

/**
 * Crea una oportunidad o la mueve de etapa. Pasa por confirmación como el resto:
 * lleva un monto asociado, y la regla del prompt ya distingue "cliente suelto"
 * (directo) de cualquier cosa con plata.
 */
async function aplicarOportunidad(biz: WaBusiness, input: any): Promise<string> {
  const cliente = typeof input?.cliente === 'string' ? input.cliente.trim() : ''
  if (!cliente) return 'ERROR: falta el cliente'
  const supabase = getSupabaseClient()

  if (input?.accion === 'mover') {
    const etapa = String(input?.etapa || '')
    if (!['contacted', 'quoted', 'won', 'lost'].includes(etapa)) return 'ERROR: etapa inválida'

    const { data: ops, error } = await supabase
      .from('opportunities')
      .select('id,client_name,title')
      .eq('workspace_id', biz.workspaceId)
      .in('stage', ETAPAS_ABIERTAS)
      .ilike('client_name', `%${cliente}%`)
      .order('created_at', { ascending: false })
      .limit(2)
    if (error) {
      console.error('aplicarOportunidad buscar', error)
      return 'ERROR: no se pudo actualizar la oportunidad'
    }
    if (!ops?.length) return `ERROR: no encontré una oportunidad abierta de "${cliente}"`
    if (ops.length > 1) return `ERROR: hay más de una oportunidad abierta de "${cliente}"; sé más específico`

    const op = ops[0] as any
    const cambios: Record<string, unknown> = { stage: etapa }
    if (etapa === 'lost' && typeof input?.motivo === 'string' && input.motivo.trim()) {
      cambios.lost_reason = input.motivo.trim()
    }
    const { error: errUpd } = await supabase.from('opportunities').update(cambios).eq('id', op.id)
    if (errUpd) {
      console.error('aplicarOportunidad mover', errUpd)
      return 'ERROR: no se pudo actualizar la oportunidad'
    }
    const etiqueta = etapa === 'won' ? 'ganada' : etapa === 'lost' ? 'perdida' : etapa === 'quoted' ? 'cotizada' : 'contactada'
    return `OK: la oportunidad de ${op.client_name} quedó ${etiqueta}.`
  }

  const valor = Number(input?.valor)
  const { data, error } = await supabase
    .from('opportunities')
    .insert({
      workspace_id: biz.workspaceId,
      user_id: biz.userId,
      client_name: cliente,
      client_phone: typeof input?.telefono === 'string' ? normalizePhone(input.telefono) || null : null,
      title: typeof input?.titulo === 'string' && input.titulo.trim() ? input.titulo.trim() : null,
      stage: 'new',
      value: Number.isFinite(valor) && valor > 0 ? valor : 0,
      source: 'whatsapp',
      notes: typeof input?.notas === 'string' && input.notas.trim() ? input.notas.trim() : null,
    })
    .select('id')
    .single()
  if (error) {
    console.error('aplicarOportunidad crear', error)
    return 'ERROR: no se pudo guardar la oportunidad'
  }
  return `OK: oportunidad de ${cliente} registrada (id ${data?.id}).`
}

/**
 * Mueve stock. Replica la convención de /api/products/[id]/movements, que es la
 * que ya usa la app: `inventory_movements.quantity` guarda el delta CON SIGNO
 * (negativo en salidas, no la cantidad absoluta) y `products.stock` se reescribe
 * a mano, porque no hay trigger que lo haga. Si se guardara la cantidad sin
 * signo, el historial quedaría inconsistente con el de la app.
 */
async function aplicarInventario(biz: WaBusiness, input: any): Promise<string> {
  const nombre = typeof input?.producto === 'string' ? input.producto.trim() : ''
  if (!nombre) return 'ERROR: falta el producto'
  const cantidad = Number(input?.cantidad)
  if (!Number.isFinite(cantidad) || cantidad <= 0) return 'ERROR: cantidad inválida'

  const supabase = getSupabaseClient()
  const { data: prods, error } = await supabase
    .from('products')
    .select('id,name,stock,unit')
    .eq('workspace_id', biz.workspaceId)
    .eq('active', true)
    .ilike('name', `%${nombre}%`)
    .limit(2)
  if (error) {
    console.error('aplicarInventario buscar', error)
    return 'ERROR: no se pudo mover el stock'
  }
  if (!prods?.length) return `ERROR: no encontré el producto "${nombre}"`
  // Con dos coincidencias no se adivina: mover el stock del producto equivocado
  // es peor que pedir precisión.
  if (prods.length > 1) return `ERROR: hay más de un producto que coincide con "${nombre}"; sé más específico`

  const prod = prods[0] as any
  const actual = Number(prod.stock ?? 0)
  const delta = input?.accion === 'entrada' ? cantidad : -cantidad
  const nuevo = Number((actual + delta).toFixed(2))
  if (nuevo < 0) return `ERROR: solo hay ${actual} de ${prod.name}`

  const { error: errMov } = await supabase.from('inventory_movements').insert({
    product_id: prod.id,
    workspace_id: biz.workspaceId,
    user_id: biz.userId,
    type: delta > 0 ? 'in' : 'out',
    quantity: delta,
    note: typeof input?.nota === 'string' && input.nota.trim() ? input.nota.trim() : NOTA_ORIGEN,
  })
  if (errMov) {
    console.error('aplicarInventario movimiento', errMov)
    return 'ERROR: no se pudo mover el stock'
  }

  const { error: errUpd } = await supabase
    .from('products')
    .update({ stock: nuevo })
    .eq('id', prod.id)
    .eq('workspace_id', biz.workspaceId)
  if (errUpd) {
    console.error('aplicarInventario stock', errUpd)
    return 'ERROR: se anotó el movimiento pero no se pudo actualizar el stock'
  }
  return `OK: ${prod.name} queda en ${nuevo} ${prod.unit || ''}`.trim()
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
      notes: typeof input?.notas === 'string' && input.notas.trim() ? input.notas.trim() : NOTA_ORIGEN,
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

type TipoPendiente = 'movimiento' | 'cita' | 'deuda' | 'abono' | 'inventario' | 'oportunidad' | 'aviso_cliente'

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
  const cant = Math.round(Number(payload?.cantidad) || 1)
  if (kind === 'movimiento' && cant > 1) {
    return `PENDIENTE: ${resumen}. Pregúntale EXACTAMENTE si quiere que lo guarde como ${cant} registros individuales o como uno solo por el total. No lo decidas vos.`
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
    case 'inventario':
      res = await aplicarInventario(biz, row.payload)
      break
    case 'oportunidad':
      res = await aplicarOportunidad(biz, row.payload)
      break
    case 'aviso_cliente':
      res = await aplicarAvisoCliente(biz, row.payload)
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
function textoConfirmacion(pendiente: any, res: string, negocio: string): string {
  if (!res.startsWith('OK')) {
    return res.startsWith('ERROR: ')
      ? `Uy, ${res.slice(7)}.`
      : 'Uy, no pude guardarlo. ¿Lo intentamos de nuevo?'
  }
  // Se nombra SIEMPRE el negocio. Sin eso, "Listo, anoté 5000" es ambiguo para
  // quien tiene más de un espacio: el dato queda bien guardado, pero el dueño lo
  // busca donde no está y concluye que la app perdió el registro. Quien tiene un
  // solo negocio lee una redundancia inofensiva; quien tiene varios, la
  // diferencia entre confiar o no en lo que le decimos.
  const donde = negocio ? ` en ${negocio}` : ''
  // En abonos e inventario el detalle que devuelve la escritura trae el dato que
  // se quiere saber (saldo restante, stock resultante), y no incluye ids.
  if (pendiente.kind === 'abono' || pendiente.kind === 'inventario') {
    return `${res.replace(/^OK:\s*/, '').trim()}${donde} ✅`
  }
  // Un aviso al cliente no se "anota": se manda. Decirle "anoté" al dueño lo
  // dejaría sin saber si el mensaje salió.
  if (pendiente.kind === 'aviso_cliente') {
    return `${res.replace(/^OK:\s*/, '').trim()} ✅`
  }
  return `Listo, anoté ${pendiente.summary}${donde}. ✅`
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

/**
 * Detecta un pedido de cambio de negocio.
 * Devuelve el destino, `''` si pidió ver la lista, o null si no es un pedido.
 * Solo frases cortas: "cambiar a X" dentro de una nota larga es texto, no orden.
 */
function pedidoDeCambio(texto: string): string | null {
  const t = normalizar(texto)
  if (!t || t.split(/\s+/).length > 6) return null
  if (/^(cambiar de negocio|cambiar negocio|que negocios tengo|mis negocios|listar negocios)$/.test(t)) return ''
  const m = t.match(/^(?:cambia|cambiar|cambiame|pasa|pasar|pasame|ir|irme)\s+(?:a|al)\s+(?:negocio\s+)?(.+)$/)
  return m ? m[1].trim() : null
}

/**
 * Interpreta cómo quiere agrupar N unidades iguales.
 * Devuelve true (uno solo por el total), false (uno por unidad) o null si la
 * respuesta no lo aclara y hay que volver a preguntar.
 */
function claseAgrupacion(texto: string): boolean | null {
  const t = normalizar(texto)
  if (!t || t.split(/\s+/).length > 6) return null
  if (/\b(junto|juntos|junta|juntas|uno solo|una sola|todo junto|todos juntos|agrupado|agrupa|uno|total|el total|sumado)\b/.test(t)) return true
  if (/\b(individual|individuales|separado|separados|separada|separadas|uno por uno|cada uno|por separado|detallado|dividido)\b/.test(t)) return false
  return null
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
      // En rubros sin obra los gastos viven en `expenses` (ver aplicarMovimiento).
      // Hay que leer de las dos tablas o el agente respondería "gastaste 0"
      // justo después de haber anotado un gasto él mismo.
      const arqC = archetypeFor(biz.businessType)
      let sueltos: any[] = []
      if (arqC !== 'projects' && arqC !== 'general') {
        const { data: ex } = await supabase
          .from('expenses')
          .select('amount,description,category,date')
          .eq('workspace_id', biz.workspaceId)
          .gte('date', desde)
          .lte('date', hasta)
          .order('date', { ascending: false })
          .limit(200)
        sueltos = (ex ?? []) as any[]
      }

      if (!data?.length && !sueltos.length) return `Sin movimientos entre ${desde} y ${hasta}.`
      let ing = 0
      let gas = 0
      for (const t of (data ?? []) as any[]) {
        if (t.type === 'income') ing += Number(t.amount) || 0
        else gas += Number(t.amount) || 0
      }
      for (const e of sueltos) gas += Number(e.amount) || 0

      const lineas = [
        ...((data ?? []) as any[]).map(t => ({
          date: String(t.date),
          txt: `${String(t.date).slice(5)} ${t.type === 'income' ? '+' : '-'}${t.amount} ${t.description || t.category_name || ''}`.trim(),
        })),
        ...sueltos.map(e => ({
          date: String(e.date),
          txt: `${String(e.date).slice(5)} -${e.amount} ${e.description || e.category || ''}`.trim(),
        })),
      ]
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, limite)
        .map(l => l.txt)
        .join('; ')
      const total = ((data ?? []) as any[]).length + sueltos.length
      return `${desde}..${hasta}: ingresos ${ing}, gastos ${gas}, ganancia ${ing - gas}, ${total} movs. Últimos: ${lineas}`
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

    case 'proyectos': {
      // La pregunta de un negocio por obra no es "cuánto vendí" sino "cuánto
      // gané en ESTE trabajo", así que se devuelve la ganancia por proyecto.
      let qp = supabase
        .from('projects')
        .select('id,name,status,budget')
        .eq('workspace_id', biz.workspaceId)
        .order('created_at', { ascending: false })
        .limit(limite)
      if (buscar) qp = qp.ilike('name', `%${buscar}%`)
      const { data: proys, error } = await qp
      if (error) {
        console.error('execConsultar proyectos', error)
        return 'ERROR: no se pudo consultar'
      }
      if (!proys?.length) return buscar ? `Sin proyectos que coincidan con "${buscar}".` : 'Sin proyectos.'

      const ids = (proys as any[]).map(p => p.id)
      const { data: txs } = await supabase
        .from('transactions')
        .select('project_id,type,amount')
        .eq('workspace_id', biz.workspaceId)
        .in('project_id', ids)
      const acum = new Map<string, { ing: number; gas: number }>()
      for (const t of (txs ?? []) as any[]) {
        const a = acum.get(t.project_id) ?? { ing: 0, gas: 0 }
        if (t.type === 'income') a.ing += Number(t.amount) || 0
        else a.gas += Number(t.amount) || 0
        acum.set(t.project_id, a)
      }
      return (proys as any[])
        .map(p => {
          const a = acum.get(p.id) ?? { ing: 0, gas: 0 }
          const pres = Number(p.budget) > 0 ? ` pres ${p.budget}` : ''
          const est = p.status && p.status !== 'active' ? ` [${p.status}]` : ''
          return `${p.name}${est}: ingresos ${a.ing}, gastos ${a.gas}, ganancia ${a.ing - a.gas}${pres}`
        })
        .join('; ')
    }

    case 'oportunidades': {
      // Por defecto solo las abiertas: la pregunta es "qué tengo en el aire",
      // no el archivo histórico.
      let q = supabase
        .from('opportunities')
        .select('client_name,title,stage,value,next_action')
        .eq('workspace_id', biz.workspaceId)
        .in('stage', ETAPAS_ABIERTAS)
        .order('created_at', { ascending: false })
        .limit(limite)
      if (buscar) q = q.ilike('client_name', `%${buscar}%`)
      const { data, error } = await q
      if (error) {
        console.error('execConsultar oportunidades', error)
        return 'ERROR: no se pudo consultar'
      }
      if (!data?.length) return 'Sin oportunidades abiertas.'
      const total = (data as any[]).reduce((s, o) => s + (Number(o.value) || 0), 0)
      const lista = (data as any[])
        .map(o => `${o.client_name}${o.title ? ` (${o.title})` : ''} ${o.stage}${Number(o.value) > 0 ? ` ${o.value}` : ''}`)
        .join('; ')
      return `${data.length} abiertas por ${total}. ${lista}`
    }

    default:
      return 'ERROR: recurso no válido'
  }
}

// ---------------------------------------------------------------------------
// Herramientas expuestas al modelo (según los módulos del plan)
// ---------------------------------------------------------------------------

function buildTools(biz: WaBusiness, chatKey: string, adjunto?: any): AgentTool[] {
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
        descripcion: { type: 'string', description: 'De qué fue, concreto (ej. corte de pelo, 3 sacos de cemento). Si no lo dijo, pregúntalo.' },
        categoria: { type: 'string', description: 'Ej. Ventas, Insumos' },
        metodo_pago: { type: 'string', description: 'efectivo, transferencia o tarjeta' },
        fecha: { type: 'string', description: 'YYYY-MM-DD. Por defecto hoy.' },
        proyecto: { type: 'string', description: 'Obra o trabajo al que va. Se crea si no existe.' },
        cantidad: { type: 'number', description: 'Cuántas unidades iguales (ej. 10 cortes). Por defecto 1.' },
        agrupar: { type: 'boolean', description: 'Con cantidad > 1: true = un solo registro por el total, false = uno por unidad. Pregúntaselo, no lo decidas.' },
      },
      // `descripcion` es obligatoria igual que en la app: un monto sin concepto
      // entra a la base pero no se puede auditar después.
      required: ['tipo', 'monto', 'descripcion'],
      additionalProperties: false,
    },
    run: input => {
      const monto = Number(input?.monto)
      if (!Number.isFinite(monto) || monto <= 0) return Promise.resolve('ERROR: monto inválido')
      if (!(typeof input?.descripcion === 'string' && input.descripcion.trim())) {
        return Promise.resolve('ERROR: falta decir de qué fue; pregúntaselo')
      }
      // Con varias unidades, cómo agruparlas lo decide el dueño y la pregunta va
      // dentro de la confirmación, no antes.
      //
      // El primer intento fue devolver un error pidiéndole al modelo que
      // preguntara, pero el modelo simplemente inventó el valor y siguió de
      // largo: no hay forma de verificar desde acá si preguntó. Al meter la
      // elección en la confirmación —que ya es determinista— la respuesta del
      // dueño es la única fuente, y se descarta lo que el modelo haya supuesto.
      const cant = Math.round(Number(input?.cantidad) || 1)
      if (cant > 1) delete input.agrupar
      const esGasto = input?.tipo === 'gasto'
      const desc = typeof input?.descripcion === 'string' && input.descripcion.trim() ? ` por ${input.descripcion.trim()}` : ''
      const fecha = toDateOnly(input?.fecha)
      const cuando = fecha === new Date().toISOString().slice(0, 10) ? '' : ` del ${fecha}`
      // La obra va en el resumen para que el dueño vea la imputación ANTES de
      // aceptar: en negocios por proyecto, un gasto en la obra equivocada es un
      // error caro y silencioso.
      const obra = typeof input?.proyecto === 'string' && input.proyecto.trim() ? ` — ${input.proyecto.trim()}` : ''
      // El resumen dice cómo va a quedar guardado, no solo cuánto: es la última
      // pantalla antes de escribir, y "10 registros" contra "1 registro" no se
      // deduce del monto.
      const forma = cant > 1
        ? `de ${cant} x ${monto} ${biz.currency} (total ${cant * monto})`
        : `de ${monto} ${biz.currency}`
      return crearPendiente(
        biz,
        chatKey,
        'movimiento',
        // El adjunto viaja dentro del payload de la pendiente: la escritura pasa
        // al confirmar, y para entonces el mensaje con la foto ya quedó atrás.
        adjunto ? { ...input, adjunto } : input,
        `${esGasto ? 'gasto' : 'ingreso'} ${forma}${desc}${cuando}${obra}${adjunto ? ' (con comprobante)' : ''}`
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

  // Inventario (módulo inventory). Solo movimientos: crear productos pide
  // precio, costo, unidad y mínimo, y eso por chat es más friccioso que hacerlo
  // en la app. Si el producto no existe, se devuelve un error accionable.
  if (has('inventory')) {
    tools.push({
      name: 'inventario',
      description: 'Suma o descuenta stock de un producto que ya existe.',
      schema: {
        type: 'object',
        properties: {
          accion: { type: 'string', enum: ['entrada', 'salida'] },
          producto: { type: 'string', description: 'Nombre, aunque sea parcial' },
          cantidad: { type: 'number', description: 'Siempre positivo' },
          nota: { type: 'string' },
        },
        required: ['accion', 'producto', 'cantidad'],
        additionalProperties: false,
      },
      run: input => {
        const cantidad = Number(input?.cantidad)
        if (!Number.isFinite(cantidad) || cantidad <= 0) return Promise.resolve('ERROR: cantidad inválida')
        const producto = typeof input?.producto === 'string' ? input.producto.trim() : ''
        if (!producto) return Promise.resolve('ERROR: falta el producto')
        const verbo = input?.accion === 'entrada' ? 'entrada' : 'salida'
        return crearPendiente(biz, chatKey, 'inventario', input, `${verbo} de ${cantidad} de ${producto}`)
      },
    })
  }

  // Oportunidades (módulo crm). Es el encaje más natural con WhatsApp: los
  // prospectos ya llegan por ahí y hoy se pierden si no se cargan a mano.
  if (has('crm')) {
    tools.push({
      name: 'oportunidad',
      description: 'Registra un prospecto interesado, o mueve uno a otra etapa.',
      schema: {
        type: 'object',
        properties: {
          accion: { type: 'string', enum: ['crear', 'mover'] },
          cliente: { type: 'string' },
          titulo: { type: 'string', description: 'Qué quiere (ej. peinado de novia)' },
          valor: { type: 'number', description: 'Monto estimado' },
          etapa: { type: 'string', enum: ['contacted', 'quoted', 'won', 'lost'], description: 'Solo para mover' },
          motivo: { type: 'string', description: 'Por qué se perdió, solo con etapa lost' },
          telefono: { type: 'string' },
          notas: { type: 'string' },
        },
        required: ['accion', 'cliente'],
        additionalProperties: false,
      },
      run: input => {
        const cliente = typeof input?.cliente === 'string' ? input.cliente.trim() : ''
        if (!cliente) return Promise.resolve('ERROR: falta el cliente')
        let resumen: string
        if (input?.accion === 'mover') {
          const etiquetas: Record<string, string> = {
            contacted: 'contactada', quoted: 'cotizada', won: 'ganada', lost: 'perdida',
          }
          const etiqueta = etiquetas[String(input?.etapa)] || String(input?.etapa)
          resumen = `la oportunidad de ${cliente} como ${etiqueta}`
        } else {
          const valor = Number(input?.valor)
          const monto = Number.isFinite(valor) && valor > 0 ? ` por ~${valor} ${biz.currency}` : ''
          const que = typeof input?.titulo === 'string' && input.titulo.trim() ? ` (${input.titulo.trim()})` : ''
          resumen = `oportunidad de ${cliente}${que}${monto}`
        }
        return crearPendiente(biz, chatKey, 'oportunidad', input, resumen)
      },
    })
  }

  // Avisar al cliente de su cita (módulo agenda).
  //
  // Es la única herramienta que manda un mensaje FUERA del chat del dueño, y por
  // eso es la más acotada: solo a alguien con una cita próxima registrada, nunca
  // a un número suelto. Sin ese límite, el agente sería un canal para mandar
  // WhatsApp a cualquiera de la base, que es justo por lo que se cierran cuentas.
  if (has('agenda')) {
    tools.push({
      name: 'avisar_cliente',
      description: 'Le envía a un cliente un recordatorio de su próxima cita.',
      schema: {
        type: 'object',
        properties: {
          cliente: { type: 'string', description: 'Nombre, aunque sea parcial' },
          mensaje: { type: 'string', description: 'Algo extra que quiera agregarle. Opcional.' },
        },
        required: ['cliente'],
        additionalProperties: false,
      },
      run: async input => {
        const nombre = typeof input?.cliente === 'string' ? input.cliente.trim() : ''
        if (!nombre) return 'ERROR: falta el cliente'
        // Se resuelve la cita ANTES de confirmar para que el resumen muestre a
        // quién y qué se va a mandar. Confirmar a ciegas un mensaje que sale
        // hacia afuera no es confirmar.
        const r = await proximaCitaDe(biz, nombre)
        if ('error' in r) return `ERROR: ${r.error}`
        const texto = textoAvisoCliente(biz, r.cita, input?.mensaje)
        return crearPendiente(
          biz,
          chatKey,
          'aviso_cliente',
          input,
          `este mensaje a ${r.cita.client_name} (${r.cita.client_phone}):\n\n"${texto}"`
        )
      },
    })
  }

  // Consulta (solo lectura). UNA herramienta parametrizada en vez de una por
  // módulo: los esquemas viajan completos en CADA request, así que menos
  // superficie es directamente menos costo por mensaje. El enum se arma según
  // el plan para no ofrecerle al modelo recursos que no puede leer.
  const recursos = ['movimientos', 'proyectos']
  if (has('agenda')) recursos.push('citas')
  if (has('sales')) recursos.push('clientes')
  if (has('receivables')) recursos.push('cobros')
  if (has('inventory')) recursos.push('inventario')
  if (has('crm')) recursos.push('oportunidades')
  tools.push({
    name: 'consultar',
    description: 'Consulta lo ya registrado para responder preguntas del dueño.',
    schema: {
      type: 'object',
      properties: {
        recurso: { type: 'string', enum: recursos },
        desde: { type: 'string', description: 'YYYY-MM-DD. Movimientos: por defecto 30 días atrás.' },
        hasta: { type: 'string', description: 'YYYY-MM-DD. Por defecto hoy.' },
        buscar: { type: 'string', description: 'Filtra por nombre. Úsalo SIEMPRE que pregunten por una obra, cliente o producto concreto.' },
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
// Una línea por arquetipo, no un prompt por rubro: son más de sesenta rubros y
// se reusa la misma clasificación que ordena el nav (moduleProfiles), para que
// el agente y la app no digan cosas distintas sobre el mismo negocio.
//
// La de `projects` es la única que cambia comportamiento, y es deliberado: en
// obra, un movimiento sin proyecto pierde la ganancia por trabajo, que es el
// dato que justifica la app. En los demás rubros basta con orientar el foco.
const FOCO_POR_ARQUETIPO: Record<Archetype, string> = {
  projects: 'Trabaja por obra: si un ingreso o gasto no dice a qué trabajo va, pregúntalo y mándalo en "proyecto".',
  appointments: 'Trabaja con citas: lo habitual son turnos y cobros del día.',
  retail: 'Vende productos: lo habitual son ventas y movimientos de stock.',
  food: 'Vende comida: lo habitual son ventas del día e insumos.',
  creative: 'Trabaja por encargo: lo habitual son prospectos y trabajos entregados.',
  general: '',
}

function systemPrompt(biz: WaBusiness, isGroup: boolean): string {
  const foco = FOCO_POR_ARQUETIPO[archetypeFor(biz.businessType)]
  const lines = [
    `Asistente de "${biz.name}" (${biz.businessType}). El dueño te manda notas cortas por WhatsApp, en español coloquial y con errores: entiéndelas y regístralas con tus herramientas. Si pregunta por datos ya registrados, búscalos con "consultar".`,
    `Moneda: ${biz.currency}. Ahora: ${localNow(biz.locale)} (${TZ}).`,
    ...(foco ? [foco] : []),
    ``,
    `REGLAS`,
    `1. Dinero, cita o stock: llama la herramienta y transmite el resumen que devuelva preguntando "¿Lo anoto?". NO digas que quedó guardado: la confirmación la maneja el sistema. Un cliente sin monto ni cita regístralo directo.`,
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
async function runAgent(biz: WaBusiness, chat: WaChat, userText: string, adjunto?: any): Promise<string | null> {
  const reply = await runToolConversation({
    system: systemPrompt(biz, chat.isGroup),
    history: await recentHistory(chat.key),
    userText,
    tools: buildTools(biz, chat.key, adjunto),
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
export async function handleInboundMessage(
  chat: WaChat,
  text: string,
  /** Comprobante que vino por foto, para adjuntarlo al movimiento que se registre. */
  adjunto?: { path: string; name: string; type: string } | null
): Promise<InboundResult> {
  const body = (text || '').trim()
  if (!chat.key || !body) return { reply: null, workspaceId: null, handled: false }

  // 1) ¿Es un código de vinculación?
  const linked = await tryLinkByCode(chat.key, body, chat.isGroup)
  if (linked) {
    await logMessage({ workspaceId: null, chatKey: chat.key, direction: 'in', body, sender: chat.sender })

    let reply: string
    if (linked.estado === 'ajeno') {
      // Se avisa sin nombrar el negocio del código: quien manda el código puede
      // no ser el dueño de este teléfono.
      reply = 'Ese código es de otra cuenta. Este WhatsApp ya está conectado a la tuya, así que no lo cambié.'
    } else if (linked.estado === 'cambiado') {
      reply = `Listo, ahora estás en "${linked.negocio}". Todo lo que me escribas se anota ahí.`
    } else {
      reply = chat.isGroup
        ? `¡Listo! Este grupo quedó conectado a "${linked.negocio}". 🎉\nEscriban aquí sus ventas, gastos, clientes o citas y yo los anoto.`
        : `¡Listo! Tu WhatsApp quedó conectado a "${linked.negocio}". 🎉\nEscríbeme tus ventas, gastos, clientes o citas y yo los anoto.`

      // Invitación a conectar el número del negocio. Va solo al vincular por
      // primera vez, solo en chat directo, solo si el rubro maneja citas y solo
      // si no lo conectó ya: un negocio sin clientes a quienes recordarles nada
      // leería una función que no le sirve, y eso enseña a ignorar los avisos.
      const bizNuevo = await resolveBusinessForChat(chat.key)
      if (!chat.isGroup && bizNuevo && archetypeFor(bizNuevo.businessType) === 'appointments') {
        const yaTiene = await instanciaDelNegocio(bizNuevo.workspaceId)
        if (!yaTiene) {
          reply += `\n\n📲 ¿Quieres mandarle recordatorios a tus clientes? Conecta el WhatsApp de tu negocio en la aplicación de Jobidai Business → Ajustes → WhatsApp del negocio, y los mensajes les van a llegar desde TU número.`
        }
      }
    }

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
      'Hola 👋 Este es el asistente de Jobidai Business. Para empezar a usar tu WhatsApp para anotar ventas y gastos, abre la app, ve a "Conectar WhatsApp" y envíame el código que te muestra.'
    await logMessage({ workspaceId: null, chatKey: chat.key, direction: 'out', body: reply })
    return { reply, workspaceId: null, handled: true }
  }

  await logMessage({ workspaceId: biz.workspaceId, chatKey: chat.key, direction: 'in', body, sender: chat.sender })

  // 3) ¿Pide cambiar de negocio?
  //
  // Determinista y no una herramienta: es una operación exacta, no
  // interpretativa. Que la decida el modelo sería caro (una llamada) y frágil
  // (elegir mal el negocio manda la plata al lugar equivocado). En grupos no
  // aplica: un grupo pertenece a un negocio, no a una persona.
  if (!chat.isGroup) {
    const destino = pedidoDeCambio(body)
    if (destino !== null) {
      const negocios = await negociosDelTelefono(chat.key)
      let reply: string
      if (negocios.length <= 1) {
        reply = 'Solo tienes un negocio conectado a este número.'
      } else if (!destino) {
        reply = `Tus negocios: ${negocios.map(n => n.name).join(', ')}. Escríbeme "cambiar a <nombre>".`
      } else {
        const buscado = normalizar(destino)
        const halladas = negocios.filter(n => normalizar(n.name).includes(buscado))
        if (halladas.length === 0) {
          reply = `No encontré "${destino}". Tus negocios: ${negocios.map(n => n.name).join(', ')}.`
        } else if (halladas.length > 1) {
          reply = `Hay varios que coinciden: ${halladas.map(n => n.name).join(', ')}. Sé más específico.`
        } else {
          const supabase = getSupabaseClient()
          await supabase
            .from('whatsapp_numbers')
            .update({ workspace_id: halladas[0].id })
            .eq('phone', chat.key)
          // Lo pendiente era de otro negocio: dejarlo vivo lo aplicaría en el
          // equivocado al primer "sí".
          await supabase
            .from('whatsapp_pending_actions')
            .update({ status: 'cancelled' })
            .eq('phone', chat.key)
            .eq('status', 'pending')
          reply = `Listo, ahora estás en "${halladas[0].name}".`
        }
      }
      await logMessage({ workspaceId: biz.workspaceId, chatKey: chat.key, direction: 'out', body: reply })
      return { reply, workspaceId: biz.workspaceId, handled: true }
    }
  }

  // 4) ¿Responde a algo que quedó pendiente de confirmar?
  //
  // Va ANTES del agente y a propósito: un "sí" ejecuta el payload guardado tal
  // cual, sin que el modelo tenga que reconstruir de qué se hablaba. Además no
  // gasta una llamada al modelo, y la confirmación es el mensaje más repetido
  // del flujo. Si no es un sí/no claro, la pendiente sigue viva y el mensaje
  // sigue su curso normal (puede ser una corrección: "sí pero eran 300").
  const pendiente = await pendienteVigente(chat.key)
  if (pendiente) {
    // Con varias unidades hay una decisión antes del sí/no: juntas o separadas.
    // Se resuelve acá y no en el modelo, que ya demostró que inventa el valor en
    // vez de preguntar. Un "sí" a secas no alcanza: no dice cómo agrupar.
    const cantPend = Math.round(Number(pendiente.payload?.cantidad) || 1)
    const faltaAgrupar = pendiente.kind === 'movimiento' && cantPend > 1 && typeof pendiente.payload?.agrupar !== 'boolean'
    if (faltaAgrupar) {
      const eleccion = claseAgrupacion(body)
      if (eleccion === null) {
        if (claseRespuesta(body) === 'no') {
          await cerrarPendiente(pendiente.id, 'cancelled')
          const reply = 'Listo, no lo anoto.'
          await logMessage({ workspaceId: biz.workspaceId, chatKey: chat.key, direction: 'out', body: reply })
          return { reply, workspaceId: biz.workspaceId, handled: true }
        }
        // Si no es ni una cosa ni la otra, se sigue al agente: puede ser una
        // corrección ("eran 600 cada uno") y no una respuesta a la pregunta.
      } else {
        const payload = { ...pendiente.payload, agrupar: eleccion }
        const res = await aplicarPendiente(biz, { ...pendiente, payload })
        const reply = textoConfirmacion({ ...pendiente, summary: res.replace(/^OK:\s*/, '').replace(/\.$/, '') }, res, biz.name)
        await logMessage({ workspaceId: biz.workspaceId, chatKey: chat.key, direction: 'out', body: reply })
        return { reply, workspaceId: biz.workspaceId, handled: true }
      }
    }
    const clase = faltaAgrupar ? null : claseRespuesta(body)
    if (clase === 'si') {
      const res = await aplicarPendiente(biz, pendiente)
      const reply = textoConfirmacion(pendiente, res, biz.name)
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

  // 5) ¿Está la IA configurada?
  if (!aiConfigured()) {
    if (chat.isGroup) return { reply: null, workspaceId: biz.workspaceId, handled: true }
    const reply = 'Recibí tu mensaje, pero el asistente aún no está activo. Inténtalo más tarde.'
    await logMessage({ workspaceId: biz.workspaceId, chatKey: chat.key, direction: 'out', body: reply })
    return { reply, workspaceId: biz.workspaceId, handled: true }
  }

  // 6) Correr el agente.
  let reply: string | null
  try {
    reply = await runAgent(biz, chat, body, adjunto)
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
      const reply = textoConfirmacion(pendiente, res, biz.name)
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
