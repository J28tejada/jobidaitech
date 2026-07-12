import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { computeCanWrite, getWorkspaceContext } from '@/lib/workspaces'

// Estado de la suscripción del usuario autenticado (para el aviso/banner).
export async function GET() {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = getSupabaseClient()
  const { data: row } = await supabase
    .from('users')
    .select('access_enabled, access_until, plan, trial_started_at')
    .eq('id', ctx.user.id)
    .maybeSingle()

  const accessUntil = row?.access_until ?? null
  const plan = row?.plan ?? null
  const isTrial = !plan && !!accessUntil
  const canWrite = ctx.isAdmin || computeCanWrite(row ?? null)

  let daysLeft: number | null = null
  if (accessUntil) {
    daysLeft = Math.ceil((new Date(accessUntil).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  }

  return NextResponse.json({
    canWrite,
    isAdmin: ctx.isAdmin,
    isTrial,
    plan,
    accessUntil,
    daysLeft,
    accessEnabled: row?.access_enabled ?? true,
  })
}
