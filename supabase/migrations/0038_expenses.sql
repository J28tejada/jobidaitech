-- =====================================================================
-- Gastos simples del negocio (sin proyecto)
-- =====================================================================
-- Los rubros de servicios/citas (barbería, salón, etc.) NO usan el módulo
-- de proyectos, y hoy los gastos exigen un proyecto. Esta tabla permite
-- registrar gastos simples (alquiler, productos, luz, salarios…) sin proyecto.
-- Alimentan el reporte simple de dinero (/finanzas): ingresos (citas) −
-- gastos = balance.
--
-- Es SEGURO re-ejecutar (idempotente). No toca datos existentes.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.expenses (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  category     text,
  description  text NOT NULL DEFAULT '',
  amount       numeric(15,2) NOT NULL DEFAULT 0,
  date         date NOT NULL DEFAULT current_date,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_workspace ON public.expenses(workspace_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date      ON public.expenses(date);

DROP TRIGGER IF EXISTS update_expenses_updated_at ON public.expenses;
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS (defensa adicional; las APIs usan service_role).
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view workspace expenses" ON public.expenses;
CREATE POLICY "members can view workspace expenses" ON public.expenses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = expenses.workspace_id AND m.user_id = auth.uid())
  );

GRANT ALL ON TABLE public.expenses TO anon, authenticated, service_role;
