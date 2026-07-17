-- =====================================================================
-- Módulo Videos: registro de videos entregados + reporte al cliente
-- =====================================================================
-- Para negocios de producción de contenido: registrar cada video (fecha,
-- ID del video, tema, quién lo grabó) con precio automático según el
-- camarógrafo, sumar por rango de fechas y generar un reporte para el
-- cliente (imprimible + enlace público con token).
--
-- Es SEGURO re-ejecutar (idempotente). No toca datos existentes.
-- =====================================================================

-- 1) CAMARÓGRAFOS (con tarifa) ---------------------------------------
CREATE TABLE IF NOT EXISTS public.video_recorders (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  name         text NOT NULL,
  rate         numeric(15,2) NOT NULL DEFAULT 0,   -- tarifa por video
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 2) VIDEOS -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.videos (
  id            uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES public.users(id) ON DELETE SET NULL,
  client_id     uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  recorder_id   uuid REFERENCES public.video_recorders(id) ON DELETE SET NULL,
  recorder_name text NOT NULL DEFAULT '',           -- snapshot de quién grabó
  video_ref     text,                                -- ID del video (ej. IMG_5625)
  topic         text NOT NULL DEFAULT '',            -- tema
  video_date    date NOT NULL DEFAULT current_date,
  price         numeric(15,2) NOT NULL DEFAULT 0,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 3) REPORTES (para enlace público al cliente) -----------------------
CREATE TABLE IF NOT EXISTS public.video_reports (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  client_id    uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name  text NOT NULL DEFAULT '',
  title        text,
  date_from    date NOT NULL,
  date_to      date NOT NULL,
  total        numeric(15,2) NOT NULL DEFAULT 0,     -- snapshot al generar
  video_count  integer NOT NULL DEFAULT 0,
  token        text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 4) ÍNDICES ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_video_recorders_workspace ON public.video_recorders(workspace_id);
CREATE INDEX IF NOT EXISTS idx_videos_workspace          ON public.videos(workspace_id);
CREATE INDEX IF NOT EXISTS idx_videos_date               ON public.videos(video_date);
CREATE INDEX IF NOT EXISTS idx_videos_client             ON public.videos(client_id);
CREATE INDEX IF NOT EXISTS idx_videos_recorder           ON public.videos(recorder_id);
CREATE INDEX IF NOT EXISTS idx_video_reports_workspace   ON public.video_reports(workspace_id);
CREATE INDEX IF NOT EXISTS idx_video_reports_token       ON public.video_reports(token);

-- 5) TRIGGERS updated_at (reusa la función existente) -----------------
DROP TRIGGER IF EXISTS update_video_recorders_updated_at ON public.video_recorders;
CREATE TRIGGER update_video_recorders_updated_at
  BEFORE UPDATE ON public.video_recorders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_videos_updated_at ON public.videos;
CREATE TRIGGER update_videos_updated_at
  BEFORE UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) RLS (defensa adicional; las APIs usan service_role) --------------
ALTER TABLE public.video_recorders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_reports   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view workspace video_recorders" ON public.video_recorders;
CREATE POLICY "members can view workspace video_recorders" ON public.video_recorders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = video_recorders.workspace_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "members can view workspace videos" ON public.videos;
CREATE POLICY "members can view workspace videos" ON public.videos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = videos.workspace_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "members can view workspace video_reports" ON public.video_reports;
CREATE POLICY "members can view workspace video_reports" ON public.video_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = video_reports.workspace_id AND m.user_id = auth.uid())
  );

GRANT ALL ON TABLE public.video_recorders TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.videos          TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.video_reports   TO anon, authenticated, service_role;
