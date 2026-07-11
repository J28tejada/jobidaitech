import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext, seedCategoriesForWorkspace } from '@/lib/workspaces'
import { BusinessType } from '@/types'

const ALLOWED_TYPES: BusinessType[] = ['carpentry', 'construction']

export async function GET() {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('workspaces')
    .select('business_type')
    .eq('id', ctx.workspaceId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Error al obtener la configuración' }, { status: 500 })
  }

  return NextResponse.json({
    businessType: data?.business_type ?? 'carpentry',
  })
}

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { businessType } = body as { businessType?: BusinessType }

    if (!businessType || !ALLOWED_TYPES.includes(businessType)) {
      return NextResponse.json({ error: 'Tipo de negocio no soportado' }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    const { error: updateError } = await supabase
      .from('workspaces')
      .update({ business_type: businessType })
      .eq('id', ctx.workspaceId)

    if (updateError) {
      throw updateError
    }

    // Si es el espacio personal, mantener también users.business_type sincronizado.
    if (ctx.isPersonal) {
      await supabase.from('users').update({ business_type: businessType }).eq('id', ctx.user.id)
    }

    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .eq('workspace_id', ctx.workspaceId)

    if (deleteError) {
      throw deleteError
    }

    await seedCategoriesForWorkspace(ctx.workspaceId, ctx.user.id, businessType)

    return NextResponse.json({ businessType })
  } catch (error) {
    console.error('POST /api/settings/business-type', error)
    return NextResponse.json({ error: 'Error al actualizar el tipo de negocio' }, { status: 500 })
  }
}
