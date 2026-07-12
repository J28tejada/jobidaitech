import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'

// Detalles de una transferencia (para la página de aceptación).
export async function GET(request: Request, { params }: { params: { token: string } }) {
  const supabase = getSupabaseClient()

  const { data: transfer, error } = await supabase
    .from('account_transfers')
    .select('to_email, project_ids, status, expires_at, from_user:from_user_id ( name, email )')
    .eq('token', params.token)
    .maybeSingle()

  if (error) {
    console.error('GET /api/transfers/[token]', error)
    return NextResponse.json({ error: 'Error al leer la transferencia' }, { status: 500 })
  }

  if (!transfer) {
    return NextResponse.json({ valid: false, reason: 'not_found' }, { status: 404 })
  }

  const fromUser = Array.isArray(transfer.from_user) ? transfer.from_user[0] : transfer.from_user
  const expired = transfer.expires_at ? new Date(transfer.expires_at).getTime() < Date.now() : false
  const valid = transfer.status === 'pending' && !expired

  return NextResponse.json({
    valid,
    reason: valid ? null : transfer.status !== 'pending' ? transfer.status : 'expired',
    toEmail: transfer.to_email,
    projectCount: Array.isArray(transfer.project_ids) ? transfer.project_ids.length : 0,
    fromName: fromUser?.name ?? fromUser?.email ?? null,
  })
}
