import { NextResponse } from 'next/server'

import { getWorkspaceContext, getWriteAccess, READ_ONLY_ERROR } from '@/lib/workspaces'
import { handleSimulatedMessage, resetSimulatedChat } from '@/lib/whatsappAgent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
