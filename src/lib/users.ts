import type { BusinessType } from '@/types'
import { getSupabaseClient } from './supabase'

export interface EnsureUserPayload {
  id: string
  email?: string | null
  name?: string | null
  image?: string | null
}

export const DEFAULT_BUSINESS_TYPE: BusinessType = 'carpentry'

/**
 * Asegura que exista la fila del usuario en `public.users` y mantiene
 * actualizados su email/nombre/avatar. Devuelve el tipo de negocio guardado.
 */
export async function ensureUserRow(user: EnsureUserPayload): Promise<BusinessType> {
  const supabase = getSupabaseClient()
  const userId = user.id

  if (!userId) {
    throw new Error('El usuario autenticado no tiene un id válido')
  }

  const { data: existingUser, error: fetchError } = await supabase
    .from('users')
    .select('id, business_type, email, name, image_url')
    .eq('id', userId)
    .maybeSingle()

  if (fetchError) {
    throw fetchError
  }

  if (!existingUser) {
    const { error: insertUserError } = await supabase.from('users').insert({
      id: userId,
      email: user.email?.toLowerCase() ?? null,
      name: user.name ?? null,
      image_url: user.image ?? null,
      business_type: DEFAULT_BUSINESS_TYPE,
    })

    if (insertUserError) {
      throw insertUserError
    }

    return DEFAULT_BUSINESS_TYPE
  }

  const { error: updateUserError } = await supabase
    .from('users')
    .update({
      email: user.email?.toLowerCase() ?? existingUser.email,
      name: user.name ?? existingUser.name,
      image_url: user.image ?? existingUser.image_url,
    })
    .eq('id', userId)

  if (updateUserError) {
    throw updateUserError
  }

  return (existingUser.business_type as BusinessType) ?? DEFAULT_BUSINESS_TYPE
}
