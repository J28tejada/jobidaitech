-- =====================================================================
-- Módulo Agenda: Citas + catálogo de servicios
-- =====================================================================
-- Abre el nicho de servicios (barberías, salones, clínicas, talleres de
-- servicio): catálogo de servicios (duración + precio) y agenda de citas con
-- estado y recordatorio por WhatsApp. Se apoya en Clientes (0014).
--
-- Es SEGURO re-ejecutar (idempotente). No toca datos existentes.
-- =====================================================================

-- 1) SERVICIOS (CATÁLOGO) --------------------------------------------
CREATE TABLE IF NOT EXISTS public.services (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  name         text NOT NULL,
  duration_min integer NOT NULL DEFAULT 30,
  price        numeric(15,2) NOT NULL DEFAULT 0,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 2) CITAS ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.appointments (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  client_id    uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name  text NOT NULL DEFAULT '',
  client_phone text,
  service_id   uuid REFERENCES public.services(id) ON DELETE SET NULL,
  title        text,                        -- snapshot del servicio/descripción
  starts_at    timestamptz NOT NULL,
  duration_min integer NOT NULL DEFAULT 30,
  price        numeric(15,2) NOT NULL DEFAULT 0,
  status       text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','confirmed','done','cancelled','no_show')),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 3) ÍNDICES ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_services_workspace     ON public.services(workspace_id);
CREATE INDEX IF NOT EXISTS idx_appointments_workspace ON public.appointments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_appointments_starts    ON public.appointments(starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status    ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_client    ON public.appointments(client_id);

-- 4) TRIGGERS updated_at (reusa la función existente) -----------------
DROP TRIGGER IF EXISTS update_services_updated_at ON public.services;
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_appointments_updated_at ON public.appointments;
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) RLS (defensa adicional; las APIs usan service_role) --------------
ALTER TABLE public.services     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view workspace services" ON public.services;
CREATE POLICY "members can view workspace services" ON public.services
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = services.workspace_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "members can view workspace appointments" ON public.appointments;
CREATE POLICY "members can view workspace appointments" ON public.appointments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = appointments.workspace_id AND m.user_id = auth.uid())
  );

GRANT ALL ON TABLE public.services     TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.appointments TO anon, authenticated, service_role;
