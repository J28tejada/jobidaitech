import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { ACTIVE_WORKSPACE_COOKIE, getWorkspaceContext } from '@/lib/workspaces'

export async function POST(request: Request, { params }: { params: { token: string } }) {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseClient()

    const { data: transfer, error } = await supabase
      .from('account_transfers')
      .select('id, to_email, status, expires_at')
      .eq('token', params.token)
      .maybeSingle()

    if (error) throw error
    if (!transfer) {
      return NextResponse.json({ error: 'Transferencia no encontrada' }, { status: 404 })
    }
    if (transfer.status !== 'pending') {
      return NextResponse.json({ error: 'Esta transferencia ya no está disponible' }, { status: 409 })
    }
    if (transfer.expires_at && new Date(transfer.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'La transferencia expiró' }, { status: 410 })
    }

    const myEmail = (ctx.user.email ?? '').toLowerCase()
    if (myEmail !== transfer.to_email.toLowerCase()) {
      return NextResponse.json(
        {
          error: 'transfer_email_mismatch',
          message: `Esta transferencia es para ${transfer.to_email}. Inicia sesión con ese correo para aceptarla.`,
        },
        { status: 403 }
      )
    }

    // Los proyectos llegan al espacio PERSONAL de la cuenta destino.
    const { data: moved, error: rpcError } = await supabase.rpc('accept_account_transfer', {
      p_token: params.token,
      p_to_user: ctx.user.id,
      p_to_workspace: ctx.personalWorkspaceId,
    })

    if (rpcError) throw rpcError

    // Asegurar que el espacio activo sea el personal (donde llegaron los datos).
    const response = NextResponse.json({ moved: typeof moved === 'number' ? moved : 0 })
    response.cookies.set(ACTIVE_WORKSPACE_COOKIE, ctx.personalWorkspaceId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
    return response
  } catch (error) {
    console.error('POST /api/transfers/[token]/accept', error)
    return NextResponse.json({ error: 'Error al aceptar la transferencia' }, { status: 500 })
  }
}
