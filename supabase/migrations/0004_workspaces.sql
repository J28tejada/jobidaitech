-- =====================================================================
-- Fase 1: Espacios (Workspaces) — cuenta personal + negocios
-- =====================================================================
-- Introduce el concepto de "Espacio" (workspace): un contenedor de datos
-- que puede ser 'personal' (uno por usuario, automatico) o 'business'
-- (un negocio, creado por un usuario que se vuelve su Dueño).
--
-- Es SEGURO re-ejecutar (idempotente).
-- =====================================================================

-- 1) TABLAS -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.workspaces (
  id            uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  type          text NOT NULL DEFAULT 'business' CHECK (type IN ('personal','business')),
  name          text NOT NULL,
  business_type text NOT NULL DEFAULT 'carpentry',
  owner_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','admin','editor','member','viewer')),
  scope        text NOT NULL DEFAULT 'all'   CHECK (scope IN ('all','specific')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

-- 2) COLUMNA workspace_id EN LAS TABLAS DE DATOS ----------------------

ALTER TABLE public.projects     ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.categories   ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- 3) BACKFILL: crear un espacio Personal por cada usuario existente ----

INSERT INTO public.workspaces (type, name, business_type, owner_id)
SELECT 'personal', 'Personal', COALESCE(u.business_type, 'carpentry'), u.id
FROM public.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspaces w WHERE w.owner_id = u.id AND w.type = 'personal'
);

-- Membresia de Dueño para cada espacio personal
INSERT INTO public.workspace_members (workspace_id, user_id, role, scope)
SELECT w.id, w.owner_id, 'owner', 'all'
FROM public.workspaces w
WHERE w.type = 'personal'
  AND NOT EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = w.id AND m.user_id = w.owner_id
  );

-- Asignar los datos existentes al espacio personal de su dueño
UPDATE public.projects p
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.owner_id = p.user_id AND w.type = 'personal' AND p.workspace_id IS NULL;

UPDATE public.categories c
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.owner_id = c.user_id AND w.type = 'personal' AND c.workspace_id IS NULL;

UPDATE public.transactions t
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.owner_id = t.user_id AND w.type = 'personal' AND t.workspace_id IS NULL;

-- 4) UNICIDAD DE CATEGORIAS POR ESPACIO (antes era por usuario) --------
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_user_id_name_type_key;
DO $mig$
BEGIN
  ALTER TABLE public.categories
    ADD CONSTRAINT categories_workspace_name_type_key UNIQUE (workspace_id, name, type);
EXCEPTION
  WHEN duplicate_table THEN NULL;   -- ya existe
  WHEN duplicate_object THEN NULL;  -- ya existe
END
$mig$;

-- 5) INDICES ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_projects_workspace     ON public.projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_categories_workspace   ON public.categories(workspace_id);
CREATE INDEX IF NOT EXISTS idx_transactions_workspace ON public.transactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wsmembers_user         ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_wsmembers_workspace    ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner       ON public.workspaces(owner_id);

-- 6) TRIGGER updated_at en workspaces ---------------------------------
DROP TRIGGER IF EXISTS update_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7) RLS (defensa adicional; las APIs usan service_role) --------------
ALTER TABLE public.workspaces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view their workspaces" ON public.workspaces;
CREATE POLICY "members can view their workspaces" ON public.workspaces
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members m
      WHERE m.workspace_id = workspaces.id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "owner can manage workspace" ON public.workspaces;
CREATE POLICY "owner can manage workspace" ON public.workspaces
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "users can view own memberships" ON public.workspace_members;
CREATE POLICY "users can view own memberships" ON public.workspace_members
  FOR SELECT USING (user_id = auth.uid());

GRANT ALL ON TABLE public.workspaces        TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.workspace_members TO anon, authenticated, service_role;
