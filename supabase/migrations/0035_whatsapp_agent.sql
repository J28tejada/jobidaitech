-- =====================================================================
-- Agente de captura por WhatsApp (WhatsApp + IA)
-- =====================================================================
-- El dueño del negocio escribe sus anotaciones en lenguaje natural a un
-- número de WhatsApp de la plataforma. Un agente de IA (Claude) interpreta
-- el mensaje, extrae los datos y los registra en la app (ingresos/gastos,
-- citas, clientes), confirmando o pidiendo aclaración por el mismo chat.
--
-- Este archivo crea la infraestructura de datos:
--   1. whatsapp_numbers        -> teléfonos autorizados vinculados a un negocio
--   2. whatsapp_link_codes     -> códigos de un solo uso para vincular
--   3. whatsapp_messages       -> bitácora de la conversación (contexto + auditoría)
--   4. whatsapp_pending_actions-> acciones a la espera de confirmación (multi-turno)
--
-- Es SEGURO re-ejecutar (idempotente). No toca datos existentes. El dueño la
-- corre a mano en el SQL Editor de Supabase.
-- =====================================================================

-- 1) NÚMEROS AUTORIZADOS ----------------------------------------------
-- Un teléfono (solo dígitos, con código de país, ej. 18091234567) queda
-- vinculado a EXACTAMENTE un espacio. Es el "quién" del que llegan las notas.
CREATE TABLE IF NOT EXISTS public.whatsapp_numbers (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  phone        text NOT NULL,
  label        text,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phone)
);

-- 2) CÓDIGOS DE VINCULACIÓN -------------------------------------------
-- El dueño ve un código en la app y lo envía por WhatsApp. Al recibirlo,
-- vinculamos su número con el negocio. De un solo uso y con expiración.
CREATE TABLE IF NOT EXISTS public.whatsapp_link_codes (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  code         text NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code)
);

-- 3) BITÁCORA DE MENSAJES ---------------------------------------------
-- Entrantes y salientes. Sirve de contexto para el agente (últimos mensajes)
-- y de auditoría. workspace_id puede ser NULL si el número aún no está vinculado.
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  phone        text NOT NULL,
  direction    text NOT NULL CHECK (direction IN ('in','out')),
  body         text,
  meta         jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 4) ACCIONES PENDIENTES DE CONFIRMACIÓN ------------------------------
-- Cuando el agente entiende una acción con impacto (un monto, una cita) puede
-- dejarla "pendiente" y pedir un "sí" por WhatsApp antes de guardarla.
CREATE TABLE IF NOT EXISTS public.whatsapp_pending_actions (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  phone        text NOT NULL,
  kind         text NOT NULL,
  payload      jsonb NOT NULL,
  summary      text,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','expired')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz
);

-- 5) ÍNDICES ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_wa_numbers_workspace   ON public.whatsapp_numbers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wa_linkcodes_workspace ON public.whatsapp_link_codes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_phone      ON public.whatsapp_messages(phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_messages_workspace  ON public.whatsapp_messages(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_pending_phone       ON public.whatsapp_pending_actions(phone, status);

-- 6) TRIGGERS updated_at (reusa la función existente) -----------------
DROP TRIGGER IF EXISTS update_wa_numbers_updated_at ON public.whatsapp_numbers;
CREATE TRIGGER update_wa_numbers_updated_at
  BEFORE UPDATE ON public.whatsapp_numbers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7) RLS (defensa adicional; las APIs usan service_role) --------------
ALTER TABLE public.whatsapp_numbers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_link_codes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_pending_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view workspace whatsapp numbers" ON public.whatsapp_numbers;
CREATE POLICY "members can view workspace whatsapp numbers" ON public.whatsapp_numbers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = whatsapp_numbers.workspace_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "members can view workspace whatsapp messages" ON public.whatsapp_messages;
CREATE POLICY "members can view workspace whatsapp messages" ON public.whatsapp_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = whatsapp_messages.workspace_id AND m.user_id = auth.uid())
  );

GRANT ALL ON TABLE public.whatsapp_numbers         TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.whatsapp_link_codes      TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.whatsapp_messages        TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.whatsapp_pending_actions TO anon, authenticated, service_role;
