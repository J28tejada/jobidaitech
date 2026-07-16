-- =====================================================================
-- Módulo CRM: Oportunidades (embudo de ventas) + seguimientos
-- =====================================================================
-- Embudo de oportunidades por etapa (nuevo → contactado → cotizado →
-- ganado/perdido) con monto estimado, origen, próxima acción/recordatorio y
-- un historial de actividades. Se apoya en Clientes (0014) y se conecta con
-- Cotizaciones y Proyectos.
--
-- Es SEGURO re-ejecutar (idempotente). No toca datos existentes.
-- =====================================================================

-- 1) OPORTUNIDADES ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.opportunities (
  id                uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  workspace_id      uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id           uuid REFERENCES public.users(id) ON DELETE SET NULL,
  client_id         uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name       text NOT NULL DEFAULT '',   -- snapshot (captura rápida sin ficha)
  client_phone      text,
  title             text,
  stage             text NOT NULL DEFAULT 'new' CHECK (stage IN ('new','contacted','quoted','won','lost')),
  value             numeric(15,2) NOT NULL DEFAULT 0,
  source            text,                        -- whatsapp / instagram / referido / anuncio / otro
  expected_close    date,
  next_action       text,
  next_action_date  date,
  lost_reason       text,
  quote_id          uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  project_id        uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 2) ACTIVIDADES (HISTORIAL DE SEGUIMIENTOS) --------------------------
CREATE TABLE IF NOT EXISTS public.opportunity_activities (
  id             uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  workspace_id   uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id        uuid REFERENCES public.users(id) ON DELETE SET NULL,
  type           text NOT NULL DEFAULT 'note' CHECK (type IN ('note','call','message','meeting','whatsapp')),
  body           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 3) ÍNDICES ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_opportunities_workspace ON public.opportunities(workspace_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage     ON public.opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_opportunities_next      ON public.opportunities(next_action_date);
CREATE INDEX IF NOT EXISTS idx_opportunities_client    ON public.opportunities(client_id);
CREATE INDEX IF NOT EXISTS idx_opp_activities_opp      ON public.opportunity_activities(opportunity_id);

-- 4) TRIGGER updated_at (reusa la función existente) ------------------
DROP TRIGGER IF EXISTS update_opportunities_updated_at ON public.opportunities;
CREATE TRIGGER update_opportunities_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) RLS (defensa adicional; las APIs usan service_role) --------------
ALTER TABLE public.opportunities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view workspace opportunities" ON public.opportunities;
CREATE POLICY "members can view workspace opportunities" ON public.opportunities
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = opportunities.workspace_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "members can view workspace opp activities" ON public.opportunity_activities;
CREATE POLICY "members can view workspace opp activities" ON public.opportunity_activities
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = opportunity_activities.workspace_id AND m.user_id = auth.uid())
  );

GRANT ALL ON TABLE public.opportunities          TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.opportunity_activities TO anon, authenticated, service_role;
