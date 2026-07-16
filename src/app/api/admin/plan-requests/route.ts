import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext } from '@/lib/workspaces'

// Solicitudes de plan (solo administrador).
export async function GET() {
  const ctx = await getWorkspaceContext()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!ctx.isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('plan_requests')
    .select('id, name, whatsapp, business, plan, cycle, message, status, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('GET /api/admin/plan-requests', error)
    return NextResponse.json({ error: 'Error al obtener solicitudes' }, { status: 500 })
  }
  return NextResponse.json({ requests: data ?? [] })
}
