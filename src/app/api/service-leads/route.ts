import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext } from '@/lib/workspaces'
import { notifyServiceLead } from '@/lib/email'
import { track } from '@/lib/analytics'

// Registrar interés en el servicio de manejo/consultoría de redes.
export async function POST(request: Request) {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ctx.user.name ?? null
    const whatsapp = typeof body.whatsapp === 'string' ? body.whatsapp.trim() : null
    const business = typeof body.business === 'string' ? body.business.trim() : null
    const message = typeof body.message === 'string' ? body.message.trim() : null

    const supabase = getSupabaseClient()
    const { error } = await supabase.from('service_leads').insert({
      user_id: ctx.user.id,
      name,
      email: ctx.user.email ?? null,
      whatsapp,
      business,
      message,
    })

    if (error) {
      throw error
    }

    await notifyServiceLead({ name, email: ctx.user.email, whatsapp, business, message })
    await track('service_lead', { userId: ctx.user.id, workspaceId: ctx.workspaceId })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/service-leads', error)
    return NextResponse.json({ error: 'Error al enviar tu solicitud' }, { status: 500 })
  }
}
