-- =====================================================================
-- Módulo 2: Cobros / Cuentas por cobrar ("¿Quién me debe?")
-- =====================================================================
-- Registra deudas de clientes (fiado), abonos y saldos por espacio.
-- Es el primer MÓDULO DE PAGO: se habilita según el plan del dueño del
-- espacio (ver src/lib/modules.ts → 'receivables' en trial/negocio/pro).
--
-- Es SEGURO re-ejecutar (idempotente). NO restringe a nadie: no toca
-- datos existentes; solo agrega tablas nuevas.
-- =====================================================================

-- 1) CUENTAS POR COBRAR ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.receivables (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,       -- creado por
  project_id   uuid REFERENCES public.projects(id) ON DELETE SET NULL,    -- opcional
  client       text NOT NULL,
  client_phone text,
  description  text,
  amount       numeric(15,2) NOT NULL DEFAULT 0,
  due_date     date,
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open','paid','cancelled')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 2) ABONOS (PAGOS PARCIALES) ----------------------------------------
-- workspace_id se denormaliza para poder filtrar sin join.
CREATE TABLE IF NOT EXISTS public.receivable_payments (
  id            uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  receivable_id uuid NOT NULL REFERENCES public.receivables(id) ON DELETE CASCADE,
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES public.users(id) ON DELETE SET NULL,
  amount        numeric(15,2) NOT NULL DEFAULT 0,
  date          date NOT NULL DEFAULT CURRENT_DATE,
  method        text,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 3) ÍNDICES ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_receivables_workspace ON public.receivables(workspace_id);
CREATE INDEX IF NOT EXISTS idx_receivables_status    ON public.receivables(status);
CREATE INDEX IF NOT EXISTS idx_receivables_due       ON public.receivables(due_date);
CREATE INDEX IF NOT EXISTS idx_receivables_project   ON public.receivables(project_id);
CREATE INDEX IF NOT EXISTS idx_rcv_payments_rcv      ON public.receivable_payments(receivable_id);
CREATE INDEX IF NOT EXISTS idx_rcv_payments_ws       ON public.receivable_payments(workspace_id);

-- 4) TRIGGER updated_at (reusa la función existente) ------------------
DROP TRIGGER IF EXISTS update_receivables_updated_at ON public.receivables;
CREATE TRIGGER update_receivables_updated_at
  BEFORE UPDATE ON public.receivables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) RLS (defensa adicional; las APIs usan service_role) --------------
ALTER TABLE public.receivables         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivable_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view workspace receivables" ON public.receivables;
CREATE POLICY "members can view workspace receivables" ON public.receivables
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members m
      WHERE m.workspace_id = receivables.workspace_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "members can view workspace payments" ON public.receivable_payments;
CREATE POLICY "members can view workspace payments" ON public.receivable_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members m
      WHERE m.workspace_id = receivable_payments.workspace_id AND m.user_id = auth.uid()
    )
  );

GRANT ALL ON TABLE public.receivables         TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.receivable_payments TO anon, authenticated, service_role;
