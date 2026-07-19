-- =====================================================================
-- Variantes de precio por servicio (ej. por rango de edad)
-- =====================================================================
-- Un mismo corte puede costar distinto según el público (Niño, Adolescente,
-- Adulto…). Guardamos las variantes como JSON en el servicio:
--   [{"label":"Niño","price":150}, {"label":"Adulto","price":250}]
-- Si un servicio no tiene variantes, usa su precio base (columna price).
--
-- Es SEGURO re-ejecutar (idempotente). No toca datos existentes.
-- =====================================================================

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS variants jsonb;
