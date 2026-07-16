-- =====================================================================
-- Módulo Ventas: Clientes + Cotizaciones (con partidas y aceptación pública)
-- =====================================================================
-- Clientes (CRM ligero) y Cotizaciones/Presupuestos con renglones, ITBIS
-- opcional, número correlativo, y un token para una página pública donde el
-- cliente ve y acepta la cotización (sin cuenta). Al aceptarse puede
-- convertirse en proyecto.
--
-- Es SEGURO re-ejecutar (idempotente). No toca datos existentes.
-- =====================================================================

-- 1) CLIENTES ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  name         text NOT NULL,
  phone        text,
  email        text,
  tax_id       text,               -- RNC / cédula
  address      text,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Opcional: ligar proyectos a un cliente (no rompe nada; el texto `client` queda).
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- 2) COTIZACIONES -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quotes (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  client_id    uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name  text NOT NULL DEFAULT '',   -- snapshot (por si no hay cliente ligado)
  client_phone text,
  number       text,                        -- COT-0001 (correlativo por espacio)
  title        text,
  notes        text,                         -- términos/condiciones
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','rejected','expired')),
  tax_enabled  boolean NOT NULL DEFAULT false,
  tax_rate     numeric(5,2) NOT NULL DEFAULT 18,
  subtotal     numeric(15,2) NOT NULL DEFAULT 0,
  tax_amount   numeric(15,2) NOT NULL DEFAULT 0,
  total        numeric(15,2) NOT NULL DEFAULT 0,
  valid_until  date,
  token        text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  accepted_at  timestamptz,
  project_id   uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 3) PARTIDAS (RENGLONES) --------------------------------------------
CREATE TABLE IF NOT EXISTS public.quote_items (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  quote_id     uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  description  text NOT NULL DEFAULT '',
  quantity     numeric(15,2) NOT NULL DEFAULT 1,
  unit_price   numeric(15,2) NOT NULL DEFAULT 0,
  position     integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 4) ÍNDICES ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_clients_workspace   ON public.clients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_quotes_workspace    ON public.quotes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status       ON public.quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_client       ON public.quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote   ON public.quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_projects_client     ON public.projects(client_id);

-- 5) TRIGGERS updated_at (reusa la función existente) -----------------
DROP TRIGGER IF EXISTS update_clients_updated_at ON public.clients;
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_quotes_updated_at ON public.quotes;
CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) RLS (defensa adicional; las APIs usan service_role) --------------
ALTER TABLE public.clients     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view workspace clients" ON public.clients;
CREATE POLICY "members can view workspace clients" ON public.clients
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = clients.workspace_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "members can view workspace quotes" ON public.quotes;
CREATE POLICY "members can view workspace quotes" ON public.quotes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = quotes.workspace_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "members can view workspace quote items" ON public.quote_items;
CREATE POLICY "members can view workspace quote items" ON public.quote_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = quote_items.workspace_id AND m.user_id = auth.uid())
  );

GRANT ALL ON TABLE public.clients     TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.quotes      TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.quote_items TO anon, authenticated, service_role;
