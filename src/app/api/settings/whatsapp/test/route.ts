import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { aiConfigured, aiMissingKeyName, aiModel, aiProvider } from '@/lib/ai'
import { getWorkspaceContext, getWriteAccess, READ_ONLY_ERROR } from '@/lib/workspaces'
import { whatsappConfigured } from '@/lib/whatsapp'
import { handleSimulatedMessage, resetSimulatedChat } from '@/lib/whatsappAgent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET: diagnóstico. Dice qué está configurado y qué falta, sin exponer secretos.
// Se puede abrir directo en el navegador para depurar un despliegue:
//   https://<app>/api/settings/whatsapp/test
// Un 404 aquí significa que el despliegue no tiene este código.
export async function GET() {
  const ctx = await getWorkspaceContext()
  if (!ctx) return NextResponse.json({ error: 'No autorizado — inicia sesión primero' }, { status: 401 })

  // ¿Corrieron las migraciones 0035/0036?
  let tablasListas = false
  let errorTablas: string | null = null
  let columnaGrupos = false
  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('whatsapp_numbers').select('id').limit(1)
    tablasListas = !error
    if (error) errorTablas = error.message
    const { error: gErr } = await supabase.from('whatsapp_numbers').select('is_group').limit(1)
    columnaGrupos = !gErr
  } catch (error) {
    errorTablas = error instanceof Error ? error.message : String(error)
  }

  const listo = aiConfigured() && tablasListas && ctx.canWrite && getWriteAccess(ctx.role).allowed

  return NextResponse.json({
    listoParaProbar: listo,
    ia: {
      proveedor: aiProvider(),
      modelo: aiModel(),
      llaveConfigurada: aiConfigured(),
      falta: aiConfigured() ? null : aiMissingKeyName(),
    },
    baseDeDatos: {
      migracion0035: tablasListas,
      migracion0036: columnaGrupos,
      error: errorTablas,
    },
    espacio: {
      nombre: ctx.workspaceId,
      rol: ctx.role,
      puedeEscribir: ctx.canWrite,
      permisoDeEscritura: getWriteAccess(ctx.role).allowed,
    },
    numeroVisibleConfigurado: Boolean(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER),
    evolutionConfigurado: whatsappConfigured(),
  })
}

// Probador del agente de WhatsApp desde la app (sin WhatsApp, sin Evolution).
//
// A diferencia de /api/whatsapp/webhook (que es público y se autentica con el
// token de Evolution), esta ruta usa la sesión del usuario: el espacio sale del
// contexto autenticado, así que no hace falta tener un número vinculado y nadie
// puede escribir en un espacio que no es suyo.
//
// Corre el mismo agente y guarda los mismos datos reales — es una prueba de
// verdad, no un simulacro.

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
  // El agente registra transacciones/citas: exigimos el mismo permiso de
  // escritura que las rutas que crean esos datos.
  if (!getWriteAccess(ctx.role).allowed) {
    return NextResponse.json({ error: 'No tienes permiso para registrar datos en este espacio' }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => ({}))

    if (body?.action === 'reset') {
      await resetSimulatedChat(ctx.workspaceId)
      return NextResponse.json({ ok: true })
    }

    const text = typeof body?.text === 'string' ? body.text : ''
    const isGroup = body?.isGroup === true

    const { reply, error } = await handleSimulatedMessage({
      workspaceId: ctx.workspaceId,
      userId: ctx.user.id,
      text,
      isGroup,
    })

    if (error) return NextResponse.json({ error }, { status: 400 })
    return NextResponse.json({ reply })
  } catch (error) {
    console.error('POST /api/settings/whatsapp/test', error)
    return NextResponse.json({ error: 'Error al probar el asistente' }, { status: 500 })
  }
}
