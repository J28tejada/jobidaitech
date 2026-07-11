-- =====================================================================
-- Fase 2: Invitaciones y colaboradores
-- =====================================================================
-- Permite que el Dueño/Admin de un negocio invite personas por correo
-- (mediante un enlace con token) y les asigne un rol y un alcance.
-- Incluye member_projects para el alcance por proyecto (se usa en Fase 3).
--
-- Es SEGURO re-ejecutar (idempotente).
-- =====================================================================

-- 1) INVITACIONES -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invitations (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email        text NOT NULL,
  role         text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','editor','member','viewer')),
  scope        text NOT NULL DEFAULT 'all'    CHECK (scope IN ('all','specific')),
  token        text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  invited_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '14 days')
);

CREATE INDEX IF NOT EXISTS idx_invitations_email     ON public.invitations (lower(email));
CREATE INDEX IF NOT EXISTS idx_invitations_workspace ON public.invitations (workspace_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token     ON public.invitations (token);

-- 2) ALCANCE POR PROYECTO (para Fase 3) -------------------------------
CREATE TABLE IF NOT EXISTS public.member_projects (
  member_id  uuid NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_member_projects_project ON public.member_projects (project_id);

-- 3) RLS --------------------------------------------------------------
ALTER TABLE public.invitations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_projects ENABLE ROW LEVEL SECURITY;

-- Miembros del espacio pueden ver sus invitaciones
DROP POLICY IF EXISTS "workspace members can view invitations" ON public.invitations;
CREATE POLICY "workspace members can view invitations" ON public.invitations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members m
      WHERE m.workspace_id = invitations.workspace_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "workspace members can view member_projects" ON public.member_projects;
CREATE POLICY "workspace members can view member_projects" ON public.member_projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members m
      WHERE m.id = member_projects.member_id AND m.user_id = auth.uid()
    )
  );

GRANT ALL ON TABLE public.invitations     TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.member_projects TO anon, authenticated, service_role;
