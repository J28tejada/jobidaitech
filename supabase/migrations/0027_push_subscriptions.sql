-- =====================================================================
-- Suscripciones de notificaciones push (Web Push / PWA)
-- =====================================================================
-- Guarda la suscripción push de cada usuario por dispositivo, para enviarle
-- una notificación nativa (ej. cuando entra una reserva). Un usuario puede
-- tener varias (un dispositivo = una suscripción).
--
-- Es SEGURO re-ejecutar (idempotente).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  endpoint     text NOT NULL,
  p256dh       text NOT NULL,
  auth         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user      ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_workspace ON public.push_subscriptions(workspace_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.push_subscriptions TO anon, authenticated, service_role;
