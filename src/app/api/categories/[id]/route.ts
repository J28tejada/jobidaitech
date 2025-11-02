import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabaseAuth = createSupabaseRouteClient()
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser()

  if (!user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) {
    console.error(`DELETE /api/categories/${params.id}`, error)
    return NextResponse.json({ error: 'No se pudo eliminar la categoría' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
