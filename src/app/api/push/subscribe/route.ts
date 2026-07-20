import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext } from '@/lib/workspaces'

// Guarda (o actualiza) la suscripción push del dispositivo del usuario.
export async function POST(request: Request) {
  const ctx = await getWorkspaceContext()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const body = await request.json()
    const sub = body.subscription || body
    const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint : ''
    const p256dh = sub?.keys?.p256dh
    const auth = sub?.keys?.auth
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Suscripción inválida' }, { status: 400 })
    }

    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        { user_id: ctx.user.id, workspace_id: ctx.workspaceId, endpoint, p256dh, auth },
        { onConflict: 'user_id,endpoint' }
      )
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/push/subscribe', error)
    return NextResponse.json({ error: 'Error al guardar la suscripción' }, { status: 500 })
  }
}
