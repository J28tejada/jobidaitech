-- =====================================================================
-- Solicitudes de plan (desde la página pública de precios /planes)
-- =====================================================================
-- Cuando un visitante elige un plan, se registra aquí para que el dueño lo
-- active desde /admin. La API pública inserta con service_role.
--
-- Es SEGURO re-ejecutar (idempotente).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.plan_requests (
  id         uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  name       text,
  whatsapp   text,
  business   text,
  plan       text,                          -- basico | negocio | pro
  cycle      text NOT NULL DEFAULT 'monthly' CHECK (cycle IN ('monthly','annual')),
  message    text,
  status     text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','won','lost')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plan_requests_created ON public.plan_requests (created_at);
CREATE INDEX IF NOT EXISTS idx_plan_requests_status  ON public.plan_requests (status);

ALTER TABLE public.plan_requests ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.plan_requests TO anon, authenticated, service_role;
