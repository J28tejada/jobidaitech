import { CATEGORY_TEMPLATES, type BusinessType, type Category } from '@/types'
import { getSupabaseClient } from './supabase'

interface EnsureUserPayload {
  id: string
  email?: string | null
  name?: string | null
  image?: string | null
}

const DEFAULT_BUSINESS_TYPE: BusinessType = 'carpentry'

export async function ensureUserAndCategories(user: EnsureUserPayload) {
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

    await seedCategoriesForUser(userId, DEFAULT_BUSINESS_TYPE)
  } else {
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
  }
}

export async function seedCategoriesForUser(userId: string, businessType: BusinessType) {
  const supabase = getSupabaseClient()
  const template = CATEGORY_TEMPLATES[businessType]

  if (!template || template.length === 0) {
    return
  }

  const payload = template.map(categoryToRow(userId))

  const { error } = await supabase.from('categories').insert(payload)
  if (error) {
    throw error
  }
}

const categoryToRow = (userId: string) => (category: Category) => ({
  user_id: userId,
  name: category.name,
  type: category.type,
  color: category.color ?? null,
  subcategories: category.subcategories ?? null,
})
