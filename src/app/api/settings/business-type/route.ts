import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { seedCategoriesForUser } from '@/lib/users'
import { BusinessType } from '@/types'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

const ALLOWED_TYPES: BusinessType[] = ['carpentry']

export async function GET() {
  const supabaseAuth = createSupabaseRouteClient()
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser()

  if (!user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('users')
    .select('business_type')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Error al obtener la configuración' }, { status: 500 })
  }

  return NextResponse.json({
    businessType: data?.business_type ?? 'carpentry',
  })
}

export async function POST(request: Request) {
  const supabaseAuth = createSupabaseRouteClient()
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser()

  if (!user?.id) {
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
      .from('users')
      .update({ business_type: businessType })
      .eq('id', user.id)

    if (updateError) {
      throw updateError
    }

    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      throw deleteError
    }

    await seedCategoriesForUser(user.id, businessType)

    return NextResponse.json({ businessType })
  } catch (error) {
    console.error('POST /api/settings/business-type', error)
    return NextResponse.json({ error: 'Error al actualizar el tipo de negocio' }, { status: 500 })
  }
}
