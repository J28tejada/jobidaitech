import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext } from '@/lib/workspaces'

// Actualizar el acceso/suscripción de un usuario (solo administrador).
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!ctx.isAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const updates: Record<string, unknown> = {}

    if (typeof body.accessEnabled === 'boolean') {
      updates.access_enabled = body.accessEnabled
    }
    // accessUntil: string ISO, o null (indefinido)
    if (body.accessUntil !== undefined) {
      updates.access_until = body.accessUntil === null ? null : new Date(body.accessUntil).toISOString()
    }
    if (body.plan !== undefined) {
      updates.plan = body.plan === '' ? null : body.plan
    }
    if (body.adminNote !== undefined) {
      updates.admin_note = body.adminNote
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    const supabase = getSupabaseClient()
    const { error } = await supabase.from('users').update(updates).eq('id', params.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PATCH /api/admin/users/[id]', error)
    return NextResponse.json({ error: 'Error al actualizar el usuario' }, { status: 500 })
  }
}
