-- =====================================================================
-- Varios precios de video por cliente
-- =====================================================================
-- Un cliente puede tener VARIOS precios según el tipo de video
-- (ej. "Reel" 750, "Video largo" 1,500). Al registrar un video para ese
-- cliente se elige uno y el precio se pone solo.
-- Reemplaza a clients.video_rate (0044): si ya habías puesto un precio ahí,
-- se copia aquí como "Video" (una sola vez).
--
-- Es SEGURO re-ejecutar (idempotente). No toca datos existentes.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.client_video_rates (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id    uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  label        text NOT NULL DEFAULT '',
  rate         numeric(15,2) NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_video_rates_workspace ON public.client_video_rates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_client_video_rates_client    ON public.client_video_rates(client_id);

-- Copiar el precio único de 0044 (si existe la columna y aún no hay precios).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'video_rate'
  ) THEN
    INSERT INTO public.client_video_rates (workspace_id, client_id, label, rate)
    SELECT c.workspace_id, c.id, 'Video', c.video_rate
    FROM public.clients c
    WHERE c.video_rate IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.client_video_rates r WHERE r.client_id = c.id);
  END IF;
END $$;

-- RLS (defensa adicional; las APIs usan service_role)
ALTER TABLE public.client_video_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view workspace client_video_rates" ON public.client_video_rates;
CREATE POLICY "members can view workspace client_video_rates" ON public.client_video_rates
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = client_video_rates.workspace_id AND m.user_id = auth.uid())
  );

GRANT ALL ON TABLE public.client_video_rates TO anon, authenticated, service_role;
