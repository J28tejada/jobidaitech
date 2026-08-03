-- =====================================================================
-- Avance de obra: etapas / partidas / tareas de un proyecto
-- =====================================================================
-- Los negocios que trabajan por proyecto (construcción, carpintería,
-- plomería, electricidad, soldadura, pintura, aires) necesitan saber
-- "¿cómo va la obra?", no solo "¿cuánto llevo cobrado?". Esta tabla
-- guarda las etapas/partidas del trabajo como un checklist simple; el
-- % de avance del proyecto se deriva de tareas hechas / tareas totales,
-- así no hay dos fuentes de verdad que se contradigan.
--
-- Es SEGURO re-ejecutar (idempotente). No toca datos existentes.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id   uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  title        text NOT NULL,
  done         boolean NOT NULL DEFAULT false,
  due_date     date,
  -- Orden manual dentro del proyecto (una obra tiene secuencia: cimientos,
  -- paredes, techo…). Se llena con el siguiente múltiplo de 10.
  position     integer NOT NULL DEFAULT 0,
  done_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project   ON public.project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_workspace ON public.project_tasks(workspace_id);

-- OJO con la función de `updated_at`: el repo está partido en dos.
-- `0001_init.sql` define `public.set_updated_at()`, pero diez migraciones
-- posteriores llaman a `public.update_updated_at_column()`, que no está
-- definida en ninguna migración. En la base real de producción pasa lo
-- contrario a lo que dice el repo: existe `update_updated_at_column` y NO
-- existe `set_updated_at`. Para no depender de cuál esté, esta migración se
-- asegura ella misma de la que usa. No toca `update_updated_at_column`, de la
-- que ya cuelgan los triggers de otras tablas.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_project_tasks ON public.project_tasks;
CREATE TRIGGER set_timestamp_project_tasks
  BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS (defensa adicional; las APIs usan service_role).
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view workspace project tasks" ON public.project_tasks;
CREATE POLICY "members can view workspace project tasks" ON public.project_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members m
      WHERE m.workspace_id = project_tasks.workspace_id AND m.user_id = auth.uid()
    )
  );

GRANT ALL ON TABLE public.project_tasks TO anon, authenticated, service_role;
