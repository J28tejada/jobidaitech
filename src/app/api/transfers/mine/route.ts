import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext } from '@/lib/workspaces'

// Transferencias pendientes dirigidas al correo del usuario autenticado.
export async function GET() {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const email = (ctx.user.email ?? '').toLowerCase()
  if (!email) {
    return NextResponse.json({ transfers: [] })
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('account_transfers')
    .select('token, project_ids, created_at, from_user:from_user_id ( name, email )')
    .eq('to_email', email)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    console.error('GET /api/transfers/mine', error)
    return NextResponse.json({ transfers: [] })
  }

  const transfers = (data ?? []).map((row: any) => {
    const fromUser = Array.isArray(row.from_user) ? row.from_user[0] : row.from_user
    return {
      token: row.token,
      projectCount: Array.isArray(row.project_ids) ? row.project_ids.length : 0,
      fromName: fromUser?.name ?? fromUser?.email ?? null,
    }
  })

  return NextResponse.json({ transfers })
}
