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
    await seedSampleData(userId)
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

async function seedSampleData(userId: string) {
  const supabase = getSupabaseClient()

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('user_id', userId)

  const findCategoryId = (name: string) => categories?.find(category => category.name === name)?.id ?? null

  const projectsPayload = [
    {
      user_id: userId,
      name: 'Cocina Integral Roble Natural',
      description: 'Diseño y fabricación de cocina a medida con acabado mate',
      client: 'Familia Hernández',
      start_date: '2024-01-15',
      status: 'active',
      budget: 185000,
    },
    {
      user_id: userId,
      name: 'Closet Empotrado Minimalista',
      description: 'Closet empotrado con puertas corredizas y herrajes ocultos',
      client: 'Loft Reforma',
      start_date: '2024-02-01',
      end_date: '2024-05-20',
      status: 'completed',
      budget: 96000,
    },
  ]

  const { data: createdProjects, error: projectsError } = await supabase
    .from('projects')
    .insert(projectsPayload)
    .select('id, name')

  if (projectsError) {
    throw projectsError
  }

  const projectMap = new Map<string, string>()
  createdProjects?.forEach(project => {
    projectMap.set(project.name, project.id)
  })

  const transactionsPayload = [
    {
      user_id: userId,
      project_id: projectMap.get('Cocina Integral Roble Natural'),
      type: 'income' as const,
      category_id: findCategoryId('Anticipo'),
      category_name: 'Anticipo',
      subcategory: null,
      description: 'Anticipo del 40% del proyecto',
      amount: 74000,
      date: '2024-01-15',
      payment_method: 'bank_transfer',
      reference: 'TRF-001',
      attachments: [],
    },
    {
      user_id: userId,
      project_id: projectMap.get('Cocina Integral Roble Natural'),
      type: 'expense' as const,
      category_id: findCategoryId('Madera y Tableros'),
      category_name: 'Madera y Tableros',
      subcategory: 'Roble',
      description: 'Compra de tableros de roble y MDF para estructura',
      amount: 28000,
      date: '2024-01-18',
      payment_method: 'bank_transfer',
      reference: 'FAC-1042',
      attachments: [],
    },
    {
      user_id: userId,
      project_id: projectMap.get('Cocina Integral Roble Natural'),
      type: 'expense' as const,
      category_id: findCategoryId('Mano de Obra'),
      category_name: 'Mano de Obra',
      subcategory: 'Carpinteros',
      description: 'Pago semanal del equipo de taller',
      amount: 12500,
      date: '2024-01-25',
      payment_method: 'cash',
      reference: 'NOM-001',
      attachments: [],
    },
    {
      user_id: userId,
      project_id: projectMap.get('Closet Empotrado Minimalista'),
      type: 'income' as const,
      category_id: findCategoryId('Anticipo'),
      category_name: 'Anticipo',
      subcategory: null,
      description: 'Anticipo del 50% del proyecto',
      amount: 48000,
      date: '2024-02-01',
      payment_method: 'bank_transfer',
      reference: 'TRF-002',
      attachments: [],
    },
    {
      user_id: userId,
      project_id: projectMap.get('Closet Empotrado Minimalista'),
      type: 'income' as const,
      category_id: findCategoryId('Pago por Avance'),
      category_name: 'Pago por Avance',
      subcategory: null,
      description: 'Pago por instalación y ajustes finales',
      amount: 32000,
      date: '2024-04-22',
      payment_method: 'bank_transfer',
      reference: 'TRF-003',
      attachments: [],
    },
    {
      user_id: userId,
      project_id: projectMap.get('Closet Empotrado Minimalista'),
      type: 'expense' as const,
      category_id: findCategoryId('Herrajes y Accesorios'),
      category_name: 'Herrajes y Accesorios',
      subcategory: 'Correderas',
      description: 'Sistema de correderas y bisagras ocultas premium',
      amount: 8500,
      date: '2024-02-12',
      payment_method: 'bank_transfer',
      reference: 'FAC-1221',
      attachments: [],
    },
    {
      user_id: userId,
      project_id: projectMap.get('Closet Empotrado Minimalista'),
      type: 'expense' as const,
      category_id: findCategoryId('Acabados y Barnices'),
      category_name: 'Acabados y Barnices',
      subcategory: 'Laca',
      description: 'Compra de laca poliuretano tono natural',
      amount: 3400,
      date: '2024-03-05',
      payment_method: 'cash',
      reference: 'MAT-055',
      attachments: [],
    },
  ].filter(transaction => Boolean(transaction.project_id))

  if (transactionsPayload.length > 0) {
    const { error: transactionsError } = await supabase.from('transactions').insert(transactionsPayload)
    if (transactionsError) {
      throw transactionsError
    }
  }
}

const categoryToRow = (userId: string) => (category: Category) => ({
  user_id: userId,
  name: category.name,
  type: category.type,
  color: category.color ?? null,
  subcategories: category.subcategories ?? null,
})
