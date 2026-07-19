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
    if (body.planTier !== undefined && ['trial', 'basico', 'negocio', 'pro'].includes(body.planTier)) {
      updates.plan_tier = body.planTier
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

// Eliminar por completo una cuenta (solo administrador). Borra el usuario de
// Auth y su fila en public.users, que en cascada elimina sus espacios y todos
// sus datos. Requiere confirmación: el body debe traer `confirm` con el correo
// exacto de la cuenta a eliminar.
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!ctx.isAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  if (params.id === ctx.user.id) {
    return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta.' }, { status: 400 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const confirm = typeof body.confirm === 'string' ? body.confirm.trim().toLowerCase() : ''

    const supabase = getSupabaseClient()
    const { data: target, error: findErr } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', params.id)
      .maybeSingle()
    if (findErr) throw findErr
    if (!target) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // La confirmación debe coincidir con el correo (o el nombre) de la cuenta.
    const email = (target.email ?? '').trim().toLowerCase()
    const name = (target.name ?? '').trim().toLowerCase()
    if (!confirm || (confirm !== email && confirm !== name)) {
      return NextResponse.json(
        { error: 'La confirmación no coincide con el correo de la cuenta.' },
        { status: 400 }
      )
    }

    // 1) Borrar de Auth (evita que pueda volver a iniciar sesión). Si ya no
    //    existe en Auth, seguimos con el borrado de datos.
    try {
      await supabase.auth.admin.deleteUser(params.id)
    } catch (e) {
      console.error('deleteUser auth', e)
    }

    // 2) Borrar la fila del usuario: en cascada elimina espacios y datos.
    const { error: delErr } = await supabase.from('users').delete().eq('id', params.id)
    if (delErr) throw delErr

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/admin/users/[id]', error)
    return NextResponse.json({ error: 'Error al eliminar la cuenta' }, { status: 500 })
  }
}
