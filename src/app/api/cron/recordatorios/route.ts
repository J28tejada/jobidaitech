// Recordatorios por WhatsApp. Lo dispara un reloj externo, no un usuario.
//
// La lógica vive acá y no en el servidor que corre Evolution a propósito: así no
// hay credenciales de Supabase ni reglas de negocio fuera del repo, y cambiar de
// disparador (tarea programada, cron de Vercel, pg_cron) no toca nada de esto.
//
// Dos trabajos, uno por frecuencia:
//   ?tipo=citas   cada ~5 min  → avisa las citas que arrancan en ~10 minutos
//   ?tipo=diario  1 vez al día → recuerda registrar ingresos y gastos
//
// Protegido con CRON_TOKEN (header x-cron-token o ?token=). Sin esa variable la
// ruta responde 503 en vez de quedar abierta: un endpoint que dispara mensajes a
// clientes reales no puede quedar accesible por olvidar configurarlo.

import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { avisar, destinatarios, telefonoDelNegocio, textoRecordatorio } from '@/lib/notificacionesWa'
import { whatsappConfigured } from '@/lib/whatsapp'
import { archetypeFor } from '@/lib/moduleProfiles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Ventana de disparo. Más ancha que el intervalo del job (~5 min) para que
// ninguna cita se cuele entre dos corridas; `reminded_at` evita el duplicado que
// ese solape podría causar.
const MIN_ANTES = 8
const MAX_ANTES = 13

function autorizado(request: NextRequest): boolean {
  const esperado = process.env.CRON_TOKEN
  if (!esperado) return false
  const header = request.headers.get('x-cron-token')
  const query = new URL(request.url).searchParams.get('token')
  return header === esperado || query === esperado
}

/** Citas que empiezan dentro de la ventana y todavía no se avisaron. */
async function recordarCitas(): Promise<{ enviados: number; citas: number }> {
  const supabase = getSupabaseClient()
  const ahora = Date.now()
  const desde = new Date(ahora + MIN_ANTES * 60_000).toISOString()
  const hasta = new Date(ahora + MAX_ANTES * 60_000).toISOString()

  const { data: citas, error } = await supabase
    .from('appointments')
    .select('id,workspace_id,client_name,client_phone,title,starts_at,staff_id')
    .is('reminded_at', null)
    .in('status', ['scheduled', 'confirmed'])
    .gte('starts_at', desde)
    .lte('starts_at', hasta)
    .limit(100)
  if (error) {
    console.error('recordarCitas', error)
    return { enviados: 0, citas: 0 }
  }
  if (!citas?.length) return { enviados: 0, citas: 0 }

  // Se marcan ANTES de enviar. Si el envío falla se pierde ese recordatorio,
  // pero al revés —marcar después— un fallo a mitad de tanda haría que la
  // corrida siguiente lo repita, y un aviso duplicado es peor que uno perdido:
  // el faltante se nota una vez, el repetido erosiona la confianza en el sistema.
  const ids = (citas as any[]).map(c => c.id)
  await supabase.from('appointments').update({ reminded_at: new Date().toISOString() }).in('id', ids)

  const staffIds = Array.from(new Set((citas as any[]).map(c => c.staff_id).filter(Boolean)))
  const telStaff = new Map<string, string | null>()
  if (staffIds.length) {
    const { data: staff } = await supabase.from('staff').select('id,phone').in('id', staffIds)
    for (const s of (staff ?? []) as any[]) telStaff.set(s.id, s.phone ?? null)
  }

  const wsIds = Array.from(new Set((citas as any[]).map(c => c.workspace_id)))
  const { data: espacios } = await supabase
    .from('workspaces')
    .select('id,booking_notify_phone')
    .in('id', wsIds)
  const telNegocio = new Map<string, string | null>()
  for (const w of (espacios ?? []) as any[]) {
    telNegocio.set(w.id, await telefonoDelNegocio({ id: w.id, booking_notify_phone: w.booking_notify_phone }))
  }

  let enviados = 0
  for (const c of citas as any[]) {
    const minutos = Math.max(1, Math.round((new Date(c.starts_at).getTime() - ahora) / 60_000))
    const destinos = destinatarios({
      telefonoNegocio: telNegocio.get(c.workspace_id) ?? null,
      telefonoBarbero: c.staff_id ? telStaff.get(c.staff_id) ?? null : null,
    })
    if (!destinos.length) continue
    await avisar(
      destinos,
      textoRecordatorio({
        cliente: c.client_name,
        telefonoCliente: c.client_phone,
        servicio: c.title,
        minutos,
      })
    )
    enviados += destinos.length
  }
  return { enviados, citas: citas.length }
}

/**
 * Recordatorio diario de registro. Solo a negocios por obra: ahí el gasto del
 * día (materiales, jornales) se olvida y descuadra la ganancia del trabajo. En
 * una barbería la venta se anota sola con el corte, así que el mismo mensaje
 * sería ruido — y un recordatorio que no aporta es el primer paso a que dejen de
 * leer los que sí importan.
 */
async function recordatorioDiario(): Promise<{ enviados: number }> {
  const supabase = getSupabaseClient()
  const { data: espacios, error } = await supabase
    .from('workspaces')
    .select('id,name,business_type,booking_notify_phone')
    .eq('type', 'business')
  if (error) {
    console.error('recordatorioDiario', error)
    return { enviados: 0 }
  }

  let enviados = 0
  for (const w of (espacios ?? []) as any[]) {
    if (archetypeFor(w.business_type) !== 'projects') continue
    const tel = await telefonoDelNegocio({ id: w.id, booking_notify_phone: w.booking_notify_phone })
    if (!tel) continue
    await avisar(
      [tel],
      '👷 ¿Ya anotaste los gastos e ingresos de hoy?\nMándamelos por aquí y los registro en la obra que me digas.'
    )
    enviados++
  }
  return { enviados }
}

export async function POST(request: NextRequest) {
  if (!autorizado(request)) {
    return NextResponse.json(
      { error: process.env.CRON_TOKEN ? 'no autorizado' : 'CRON_TOKEN no configurado' },
      { status: process.env.CRON_TOKEN ? 401 : 503 }
    )
  }
  if (!whatsappConfigured()) {
    return NextResponse.json({ ok: false, error: 'WhatsApp no configurado' }, { status: 503 })
  }

  const tipo = new URL(request.url).searchParams.get('tipo') ?? 'citas'
  try {
    if (tipo === 'diario') return NextResponse.json({ ok: true, ...(await recordatorioDiario()) })
    return NextResponse.json({ ok: true, ...(await recordarCitas()) })
  } catch (error) {
    console.error('POST /api/cron/recordatorios', error)
    return NextResponse.json({ ok: false, error: 'fallo interno' }, { status: 500 })
  }
}

// GET para poder verificar desde el navegador que la ruta existe y está
// protegida, sin disparar envíos.
export async function GET(request: NextRequest) {
  return NextResponse.json({
    ok: true,
    servicio: 'recordatorios',
    tokenConfigurado: Boolean(process.env.CRON_TOKEN),
    whatsappConfigurado: whatsappConfigured(),
    autorizado: autorizado(request),
  })
}
