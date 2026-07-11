// Etiquetas y descripciones de roles (seguro para usar en el cliente).
export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'member' | 'viewer'

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: 'Dueño',
  admin: 'Administrador',
  editor: 'Editor',
  member: 'Colaborador',
  viewer: 'Visor',
}

export const ROLE_DESCRIPTIONS: Record<WorkspaceRole, string> = {
  owner: 'Control total del negocio',
  admin: 'Gestiona datos y miembros',
  editor: 'Crea y edita todos los datos',
  member: 'Crea y edita solo lo suyo',
  viewer: 'Solo puede ver',
}

// Roles que se pueden asignar al invitar (nunca 'owner').
export const ASSIGNABLE_ROLES: WorkspaceRole[] = ['admin', 'editor', 'member', 'viewer']

export const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 0,
  member: 1,
  editor: 2,
  admin: 3,
  owner: 4,
}

export function canManageMembers(role: WorkspaceRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.admin
}
