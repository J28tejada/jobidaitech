-- =====================================================================
-- Color de acento de la página de reservas
-- =====================================================================
-- El negocio puede elegir el color principal de su página de reservas
-- (encabezado, botones, selección). Se guarda como HEX (ej. #10b981).
--
-- Es SEGURO re-ejecutar (idempotente).
-- =====================================================================

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS booking_accent text;
