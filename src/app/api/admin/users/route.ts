import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext } from '@/lib/workspaces'

// Lista de todos los usuarios de la plataforma (solo administrador).
export async function GET() {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!ctx.isAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, plan, access_enabled, access_until, admin_note, trial_started_at, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('GET /api/admin/users', error)
    return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 })
  }

  return NextResponse.json({ users: data ?? [] })
}
