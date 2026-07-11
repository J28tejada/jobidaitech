import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext } from '@/lib/workspaces'

// Invitaciones pendientes dirigidas al correo del usuario autenticado.
export async function GET() {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const email = (ctx.user.email ?? '').toLowerCase()
  if (!email) {
    return NextResponse.json({ invitations: [] })
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('invitations')
    .select('token, role, created_at, workspaces:workspace_id ( name ), inviter:invited_by ( name, email )')
    .eq('email', email)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    console.error('GET /api/invitations/mine', error)
    return NextResponse.json({ invitations: [] })
  }

  const invitations = (data ?? []).map((row: any) => {
    const ws = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces
    const inviter = Array.isArray(row.inviter) ? row.inviter[0] : row.inviter
    return {
      token: row.token,
      role: row.role,
      workspaceName: ws?.name ?? 'Negocio',
      inviterName: inviter?.name ?? inviter?.email ?? null,
    }
  })

  return NextResponse.json({ invitations })
}
