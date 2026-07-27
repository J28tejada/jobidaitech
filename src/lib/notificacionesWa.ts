// Notificaciones por WhatsApp del negocio (reservas y recordatorios).
//
// Envía DIRECTO por Evolution (lib/whatsapp) en vez de rebotar por el webhook a
// n8n. La ruta por webhook seguía existiendo pero suma tres puntos de falla —que
// n8n esté corriendo, que el flujo esté armado, que la URL sea la correcta— sin
// aportar nada ahora que la app sabe enviar sola. Se conserva como respaldo por
// si un negocio configuró el suyo propio.
//
// Todos los envíos son fire-and-forget: una notificación que falla no puede
// tumbar la reserva que la originó.

import { getSupabaseClient } from './supabase'
import { sendWhatsAppText, whatsappConfigured, normalizePhone } from './whatsapp'

/**
 * A qué números avisar de algo de este negocio.
 *
 * Preferimos el barbero asignado —es quien tiene que estar—, y sumamos el número
 * de avisos del negocio si es distinto. Si no hay barbero, queda solo el del
 * negocio. Se deduplica por teléfono normalizado: el dueño suele ser también
 * quien atiende, y recibir dos veces el mismo aviso se lee como error.
 */
export function destinatarios(params: {
  telefonoNegocio?: string | null
  telefonoBarbero?: string | null
}): string[] {
  const salida: string[] = []
  const vistos = new Set<string>()
  for (const t of [params.telefonoBarbero, params.telefonoNegocio]) {
    const n = normalizePhone(t)
    if (n && !vistos.has(n)) {
      vistos.add(n)
      salida.push(n)
    }
  }
  return salida
}

/**
 * Envía a varios destinos sin propagar fallos.
 *
 * Con `workspaceId` además deja el aviso en la bitácora del chat. Eso no es
 * cosmético: el agente arma su contexto desde `whatsapp_messages`, así que sin
 * esto el dueño recibe "⏰ En 10 minutos: Juan", responde "avísale" y el modelo
 * no tiene idea de a quién se refiere.
 */
export async function avisar(destinos: string[], texto: string, workspaceId?: string): Promise<void> {
  if (!whatsappConfigured() || !texto) return
  for (const d of destinos) {
    try {
      await sendWhatsAppText(d, texto)
      if (workspaceId) {
        await getSupabaseClient()
          .from('whatsapp_messages')
          .insert({ workspace_id: workspaceId, phone: d, direction: 'out', body: texto })
      }
    } catch (error) {
      console.error('avisar', error)
    }
  }
}

export function textoReservaNueva(params: {
  negocio: string
  cliente: string
  telefonoCliente: string
  servicio?: string | null
  barbero?: string | null
  cuando: string
}): string {
  const partes = [`📅 Nueva reserva en ${params.negocio}`, ``, `${params.cliente} · ${params.telefonoCliente}`]
  if (params.servicio) partes.push(params.servicio)
  if (params.cuando) partes.push(params.cuando)
  if (params.barbero) partes.push(`Con: ${params.barbero}`)
  return partes.join('\n')
}

export function textoRecordatorio(params: {
  cliente: string
  telefonoCliente?: string | null
  servicio?: string | null
  minutos: number
}): string {
  const que = params.servicio ? ` (${params.servicio})` : ''
  const tel = params.telefonoCliente ? `\n${params.telefonoCliente}` : ''
  return `⏰ En ${params.minutos} minutos: ${params.cliente}${que}${tel}`
}

/**
 * Número de avisos del negocio. Usa `booking_notify_phone` si está configurado
 * y, si no, el WhatsApp vinculado del espacio: el dueño ya lo conectó al agente,
 * así que pedirle configurar otro número sería fricción sin motivo.
 */
export async function telefonoDelNegocio(ws: {
  id: string
  booking_notify_phone?: string | null
}): Promise<string | null> {
  if (ws.booking_notify_phone) return ws.booking_notify_phone
  try {
    const { data } = await getSupabaseClient()
      .from('whatsapp_numbers')
      .select('phone')
      .eq('workspace_id', ws.id)
      .eq('active', true)
      .eq('is_group', false)
      .limit(1)
    return (data?.[0] as any)?.phone ?? null
  } catch (error) {
    console.error('telefonoDelNegocio', error)
    return null
  }
}
