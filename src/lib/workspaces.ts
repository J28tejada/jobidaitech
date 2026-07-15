import { cookies } from 'next/headers'

import { CATEGORY_TEMPLATES, type BusinessType, type Category } from '@/types'
import { getSupabaseClient } from './supabase'
import { createSupabaseRouteClient } from './supabase-route'
import { DEFAULT_BUSINESS_TYPE, ensureUserRow, type EnsureUserPayload } from './users'
import { hasModule, type ModuleKey, type PlanTier } from './modules'

export const ACTIVE_WORKSPACE_COOKIE = 'active_workspace_id'

export type WorkspaceType = 'personal' | 'business'
export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'member' | 'viewer'

// Jerarquía de roles: a mayor número, más permisos.
export const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 0,
  member: 1,
  editor: 2,
  admin: 3,
  owner: 4,
}

// Roles que se pueden asignar al invitar (nunca 'owner').
export const ASSIGNABLE_ROLES: WorkspaceRole[] = ['admin', 'editor', 'member', 'viewer']

/** ¿Puede gestionar miembros e invitaciones? (admin o dueño) */
export function canManageMembers(role: WorkspaceRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.admin
}

/** ¿Puede cambiar la configuración del espacio / categorías compartidas? (admin o dueño) */
export function canManageWorkspace(role: WorkspaceRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.admin
}

/**
 * Acceso de escritura sobre datos (proyectos/transacciones):
 * - viewer: nada
 * - member: puede crear y editar solo lo suyo
 * - editor/admin/owner: acceso total
 */
export function getWriteAccess(role: WorkspaceRole): { allowed: boolean; ownOnly: boolean } {
  const rank = ROLE_RANK[role]
  if (rank >= ROLE_RANK.editor) return { allowed: true, ownOnly: false }
  if (rank >= ROLE_RANK.member) return { allowed: true, ownOnly: true }
  return { allowed: false, ownOnly: false }
}

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
  membershipId: string | null
  scope: 'all' | 'specific'
  /** IDs de proyectos visibles cuando scope='specific'; null = todos. */
  allowedProjectIds: string[] | null
  /** ¿La suscripción del usuario permite hacer cambios? (false = solo lectura) */
  canWrite: boolean
  /** ¿Es administrador de la plataforma? */
  isAdmin: boolean
  /** Plan efectivo del espacio activo (del dueño, en un negocio). */
  planTier: PlanTier
  /** ¿El plan del espacio activo incluye este módulo? */
  hasModule: (key: ModuleKey) => boolean
}

const DEFAULT_ADMIN_EMAILS = ['josuetejadaromero@gmail.com']

/** ¿El correo es de un administrador de la plataforma? (configurable con ADMIN_EMAILS) */
export function isPlatformAdmin(email?: string | null): boolean {
  if (!email) return false
  const fromEnv = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  const list = fromEnv.length > 0 ? fromEnv : DEFAULT_ADMIN_EMAILS
  return list.includes(email.toLowerCase())
}

/** Respuesta estándar cuando el usuario está en modo solo lectura. */
export const READ_ONLY_ERROR = {
  error: 'subscription_read_only',
  message:
    'Tu suscripción está inactiva: puedes ver toda tu información pero no hacer cambios. Contacta a soporte para reactivarla.',
}

/** Respuesta estándar cuando el plan del espacio no incluye el módulo. */
export const MODULE_LOCKED_ERROR = {
  error: 'module_locked',
  message:
    'Este módulo no está incluido en tu plan actual. Actualiza tu plan para activarlo.',
}

/** Calcula si un usuario puede hacer cambios según su suscripción. */
export function computeCanWrite(row: { access_enabled?: boolean | null; access_until?: string | null } | null): boolean {
  if (!row) return true
  if (row.access_enabled === false) return false
  if (!row.access_until) return true
  return new Date(row.access_until).getTime() > Date.now()
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
  const supabase = getSupabaseClient()

  // Estado de suscripción del propio usuario (aplica a su espacio personal)
  const isAdmin = isPlatformAdmin(profile.email)
  const { data: accessRow } = await supabase
    .from('users')
    .select('access_enabled, access_until, plan_tier')
    .eq('id', user.id)
    .maybeSingle()
  const myCanWrite = computeCanWrite(accessRow)
  const myPlanTier = (accessRow?.plan_tier as PlanTier) ?? 'pro'

  let workspaceId = personalWorkspaceId
  let role: WorkspaceRole = 'owner'
  let isPersonal = true
  let membershipId: string | null = null
  let scope: 'all' | 'specific' = 'all'
  let allowedProjectIds: string[] | null = null

  const requested = cookies().get(ACTIVE_WORKSPACE_COOKIE)?.value

  if (requested && requested !== personalWorkspaceId) {
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id, role, scope')
      .eq('user_id', user.id)
      .eq('workspace_id', requested)
      .maybeSingle()

    if (membership) {
      workspaceId = requested
      role = (membership.role as WorkspaceRole) ?? 'member'
      isPersonal = false
      membershipId = membership.id
      scope = (membership.scope as 'all' | 'specific') ?? 'all'

      if (scope === 'specific') {
        const { data: mp } = await supabase
          .from('member_projects')
          .select('project_id')
          .eq('member_id', membership.id)
        allowedProjectIds = (mp ?? []).map((r: { project_id: string }) => r.project_id)
      }
    }
  }

  // Acceso de escritura EFECTIVO según el espacio activo:
  // - Personal: depende de la suscripción del propio usuario.
  // - Negocio: depende de la suscripción del DUEÑO del negocio (quien paga por
  //   todos sus miembros). Así un empleado con su prueba vencida puede trabajar
  //   dentro de un negocio con suscripción activa.
  let canWrite: boolean
  let planTier: PlanTier
  if (isPersonal) {
    canWrite = isAdmin || myCanWrite
    planTier = myPlanTier
  } else {
    const { data: ws } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .maybeSingle()

    if (!ws?.owner_id || ws.owner_id === user.id) {
      // Si soy el dueño (o no se pudo leer), aplica mi propia suscripción y plan.
      canWrite = isAdmin || myCanWrite
      planTier = myPlanTier
    } else {
      const { data: ownerRow } = await supabase
        .from('users')
        .select('access_enabled, access_until, plan_tier')
        .eq('id', ws.owner_id)
        .maybeSingle()
      canWrite = isAdmin || computeCanWrite(ownerRow)
      planTier = (ownerRow?.plan_tier as PlanTier) ?? 'pro'
    }
  }

  return {
    user: profile,
    workspaceId,
    personalWorkspaceId,
    role,
    isPersonal,
    membershipId,
    scope,
    allowedProjectIds,
    canWrite,
    isAdmin,
    planTier,
    hasModule: (key: ModuleKey) => hasModule(planTier, key),
  }
}

/**
 * Devuelve el rol del usuario en un espacio concreto (o null si no es miembro).
 */
export async function getMembershipRole(userId: string, workspaceId: string): Promise<WorkspaceRole | null> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  return (data?.role as WorkspaceRole) ?? null
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
