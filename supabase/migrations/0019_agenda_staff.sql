-- =====================================================================
-- Agenda: Barberos / personal + comisiones + propinas
-- =====================================================================
-- Convierte la Agenda en una herramienta real de barbería (y salón/spa):
-- catálogo de barberos con % de comisión, asignación de la cita a un barbero,
-- y propina por servicio. Base para el panel de comisiones por barbero.
--
-- Es SEGURO re-ejecutar (idempotente). No toca datos existentes.
-- =====================================================================

-- 1) BARBEROS / PERSONAL ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff (
  id             uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  workspace_id   uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id        uuid REFERENCES public.users(id) ON DELETE SET NULL,
  name           text NOT NULL,
  commission_pct numeric(5,2) NOT NULL DEFAULT 0,  -- % de comisión por servicio
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- 2) CITAS: asignar barbero + propina ---------------------------------
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS staff_id   uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS staff_name text NOT NULL DEFAULT '',        -- snapshot
  ADD COLUMN IF NOT EXISTS tip        numeric(15,2) NOT NULL DEFAULT 0;

-- 3) ÍNDICES ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_staff_workspace       ON public.staff(workspace_id);
CREATE INDEX IF NOT EXISTS idx_appointments_staff    ON public.appointments(staff_id);

-- 4) TRIGGER updated_at ----------------------------------------------
DROP TRIGGER IF EXISTS update_staff_updated_at ON public.staff;
CREATE TRIGGER update_staff_updated_at
  BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) RLS + grants -----------------------------------------------------
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view workspace staff" ON public.staff;
CREATE POLICY "members can view workspace staff" ON public.staff
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = staff.workspace_id AND m.user_id = auth.uid())
  );

GRANT ALL ON TABLE public.staff TO anon, authenticated, service_role;
