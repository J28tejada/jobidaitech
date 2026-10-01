-- =====================================================================
-- Precio por video según el cliente
-- =====================================================================
-- Cada cliente puede tener su propio precio por video (ej. Refriservices paga
-- 750 y otro cliente 1,000). Al registrar un video para ese cliente, el precio
-- se pone solo con esta tarifa (tiene prioridad sobre la del camarógrafo).
-- NULL = sin precio propio (se usa la tarifa del camarógrafo, como antes).
--
-- Es SEGURO re-ejecutar (idempotente). No toca datos existentes.
-- =====================================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS video_rate numeric(15,2);
