-- =====================================================================
-- Fundación SaaS: planes por espacio, métricas y leads del servicio
-- =====================================================================
-- Base para el modelo modular (tipo Odoo, empaquetado en planes), la
-- medición de producto (para decidir el siguiente módulo con datos) y la
-- línea de servicios de marketing (captura de interesados).
--
-- Es SEGURO re-ejecutar (idempotente). NO restringe a nadie: los espacios
-- existentes quedan en plan 'pro' (todos los módulos).
-- =====================================================================

-- 1) PLAN DEL USUARIO (entitlements empaquetados) --------------------
-- El plan del DUEÑO cubre a su negocio (igual que la suscripción). Los
-- usuarios existentes quedan en 'pro' (todos los módulos): no se restringe.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'pro'
  CHECK (plan_tier IN ('trial','basico','negocio','pro'));

-- 2) EVENTOS DE PRODUCTO (métricas) ----------------------------------
CREATE TABLE IF NOT EXISTS public.app_events (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  event        text NOT NULL,
  props        jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_app_events_event   ON public.app_events (event);
CREATE INDEX IF NOT EXISTS idx_app_events_created ON public.app_events (created_at);

-- 3) LEADS DEL SERVICIO DE MARKETING ---------------------------------
CREATE TABLE IF NOT EXISTS public.service_leads (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  name         text,
  email        text,
  whatsapp     text,
  business     text,
  message      text,
  status       text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','won','lost')),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_leads_created ON public.service_leads (created_at);

-- 4) RLS (las APIs usan service_role; se activa por consistencia) -----
ALTER TABLE public.app_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_leads ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.app_events    TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.service_leads TO anon, authenticated, service_role;
