-- 0034_booking_slug.sql
-- Enlace corto y con identidad de la barbería para reservar. En vez de
-- compartir el token largo (/reservar/<64 hex>), el negocio elige un "slug"
-- (ej. "mibarberia") y comparte /r/mibarberia — más corto y de marca.
-- El token largo sigue funcionando (compatibilidad). Idempotente.

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS booking_slug text;

-- Único (case-insensitive) solo entre los que tienen slug definido.
CREATE UNIQUE INDEX IF NOT EXISTS workspaces_booking_slug_key
  ON public.workspaces (lower(booking_slug))
  WHERE booking_slug IS NOT NULL;
