-- =====================================================================
-- Foto de portada de la página pública de reservas
-- =====================================================================
-- El negocio puede subir una imagen de portada (logo, flyer o un corte) que
-- se muestra en el encabezado de su enlace de reservas. Se guarda su URL
-- pública (bucket service-images ya existente).
--
-- Es SEGURO re-ejecutar (idempotente).
-- =====================================================================

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS booking_cover_url text;
