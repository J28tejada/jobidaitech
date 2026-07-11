import { cookies } from 'next/headers'

import { CATEGORY_TEMPLATES, type BusinessType, type Category } from '@/types'
import { getSupabaseClient } from './supabase'
import { createSupabaseRouteClient } from './supabase-route'
import { DEFAULT_BUSINESS_TYPE, ensureUserRow, type EnsureUserPayload } from './users'

export const ACTIVE_WORKSPACE_COOKIE = 'active_workspace_id'

export type WorkspaceType = 'personal' | 'business'
export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'member' | 'viewer'

export interface UserProfile {
  id: string
  email?: string | null
  name?: string | null
  image?: string | null
}

export interface WorkspaceSummary {
  id: string
  name: string
  type: WorkspaceType
  businessType: BusinessType
  role: WorkspaceRole
  isActive: boolean
}

export interface WorkspaceContext {
  user: UserProfile
  workspaceId: string
  personalWorkspaceId: string
  role: WorkspaceRole
  isPersonal: boolean
}

function profileFromAuthUser(user: {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}): UserProfile {
  const meta = user.user_metadata ?? {}
  return {
    id: user.id,
    email: user.email,
    name: (meta.full_name as string) ?? (meta.name as string) ?? user.email,
    image: (meta.avatar_url as string) ?? null,
  }
}

/**
 * Siembra las categorías por defecto (según el tipo de negocio) en un espacio.
 */
export async function seedCategoriesForWorkspace(
  workspaceId: string,
  ownerId: string,
  businessType: BusinessType
) {
  const supabase = getSupabaseClient()
  const template = CATEGORY_TEMPLATES[businessType]

  if (!template || template.length === 0) {
    return
  }

  const payload = template.map((category: Category) => ({
    workspace_id: workspaceId,
    user_id: ownerId,
    name: category.name,
    type: category.type,
    color: category.color ?? null,
    subcategories: category.subcategories ?? null,
  }))

  const { error } = await supabase.from('categories').insert(payload)
  if (error) {
    throw error
  }
}

/**
 * Asegura que el usuario tenga fila en `users` y un espacio Personal
 * (con sus categorías sembradas). Devuelve el id del espacio personal.
 */
export async function ensureUserAndPersonalWorkspace(profile: EnsureUserPayload): Promise<string> {
  const businessType = await ensureUserRow(profile)
  const supabase = getSupabaseClient()

  const { data: personal, error } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', profile.id)
    .eq('type', 'personal')
    .maybeSingle()

  if (error) {
    throw error
  }

  if (personal?.id) {
    return personal.id
  }

  // Crear espacio personal + membresía + categorías
  const { data: created, error: createError } = await supabase
    .from('workspaces')
    .insert({
      type: 'personal',
      name: 'Personal',
      business_type: businessType,
      owner_id: profile.id,
    })
    .select('id')
    .single()

  if (createError || !created) {
    throw createError ?? new Error('No se pudo crear el espacio personal')
  }

  await supabase.from('workspace_members').insert({
    workspace_id: created.id,
    user_id: profile.id,
    role: 'owner',
    scope: 'all',
  })

  await seedCategoriesForWorkspace(created.id, profile.id, businessType)

  return created.id
}

/**
 * Resuelve el contexto de la petición: usuario autenticado + espacio activo.
 * El espacio activo se lee de una cookie y se valida contra la membresía.
 * Si no hay cookie válida, cae al espacio personal.
 */
export async function getWorkspaceContext(): Promise<WorkspaceContext | null> {
  const supabaseAuth = createSupabaseRouteClient()
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser()

  if (!user?.id) {
    return null
  }

  const profile = profileFromAuthUser(user)
  const personalWorkspaceId = await ensureUserAndPersonalWorkspace(profile)

  let workspaceId = personalWorkspaceId
  let role: WorkspaceRole = 'owner'
  let isPersonal = true

  const requested = cookies().get(ACTIVE_WORKSPACE_COOKIE)?.value

  if (requested && requested !== personalWorkspaceId) {
    const supabase = getSupabaseClient()
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('workspace_id', requested)
      .maybeSingle()

    if (membership) {
      workspaceId = requested
      role = (membership.role as WorkspaceRole) ?? 'member'
      isPersonal = false
    }
  }

  return { user: profile, workspaceId, personalWorkspaceId, role, isPersonal }
}

/**
 * Lista todos los espacios a los que pertenece el usuario, marcando el activo.
 */
export async function listWorkspacesForUser(userId: string, activeWorkspaceId: string): Promise<WorkspaceSummary[]> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('workspace_members')
    .select('role, workspaces:workspace_id ( id, name, type, business_type )')
    .eq('user_id', userId)

  if (error) {
    throw error
  }

  type WorkspaceEmbed = { id: string; name: string; type: WorkspaceType; business_type: BusinessType }
  const rows = (data ?? []) as unknown as Array<{
    role: WorkspaceRole
    // Supabase puede tipar el embed como objeto o arreglo según la relación
    workspaces: WorkspaceEmbed | WorkspaceEmbed[] | null
  }>

  return rows
    .map(row => {
      const ws = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces
      if (!ws) return null
      return {
        id: ws.id,
        name: ws.name,
        type: ws.type,
        businessType: (ws.business_type as BusinessType) ?? DEFAULT_BUSINESS_TYPE,
        role: row.role,
        isActive: ws.id === activeWorkspaceId,
      }
    })
    .filter((w): w is WorkspaceSummary => w !== null)
    // Personal primero, luego negocios por nombre
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'personal' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}
