-- =====================================================================
-- Imagen de referencia por servicio (foto del corte)
-- =====================================================================
-- Cada servicio puede tener una foto de referencia que el cliente ve al
-- reservar. Se guarda en un bucket PÚBLICO (son fotos de cortes, no datos
-- sensibles) y en el servicio guardamos su URL pública.
--
-- Es SEGURO re-ejecutar (idempotente).
-- =====================================================================

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS image_url text;

-- Bucket público para las imágenes de servicios.
INSERT INTO storage.buckets (id, name, public)
VALUES ('service-images', 'service-images', true)
ON CONFLICT (id) DO NOTHING;
