import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { canManageWorkspace, getWorkspaceContext, seedCategoriesForWorkspace, READ_ONLY_ERROR } from '@/lib/workspaces'
import { describeError } from '@/lib/errors'
import { CATEGORY_TEMPLATES } from '@/types'

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
  let ctx
  try {
    ctx = await getWorkspaceContext()
  } catch (error) {
    console.error('POST /api/settings/business-type getWorkspaceContext', error)
    return NextResponse.json({ error: `No se pudo preparar tu cuenta: ${describeError(error)}` }, { status: 500 })
  }
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  if (!ctx.canWrite) {
    return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
  }

  if (!canManageWorkspace(ctx.role)) {
    return NextResponse.json({ error: 'Solo un administrador puede cambiar el tipo de negocio' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const businessType = typeof body.businessType === 'string' ? body.businessType.trim().slice(0, 80) : ''
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : ''

    if (!businessType) {
      return NextResponse.json({ error: 'Indica el tipo de negocio' }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    const patch: Record<string, unknown> = { business_type: businessType }
    if (name) patch.name = name

    const { error: updateError } = await supabase
      .from('workspaces')
      .update(patch)
      .eq('id', ctx.workspaceId)

    if (updateError) {
      throw updateError
    }

    // Si es el espacio personal, mantener también users.business_type sincronizado.
    if (ctx.isPersonal) {
      await supabase.from('users').update({ business_type: businessType }).eq('id', ctx.user.id)
    }

    // Solo re-sembramos categorías si el tipo tiene una plantilla específica.
    // Para tipos genéricos/personalizados NO borramos las categorías del usuario.
    let reseeded = false
    if (CATEGORY_TEMPLATES[businessType]) {
      const { error: deleteError } = await supabase
        .from('categories')
        .delete()
        .eq('workspace_id', ctx.workspaceId)

      if (deleteError) {
        throw deleteError
      }

      await seedCategoriesForWorkspace(ctx.workspaceId, ctx.user.id, businessType)
      reseeded = true
    }

    return NextResponse.json({ businessType, reseeded })
  } catch (error) {
    console.error('POST /api/settings/business-type', error)
    return NextResponse.json({ error: 'Error al actualizar el tipo de negocio' }, { status: 500 })
  }
}
