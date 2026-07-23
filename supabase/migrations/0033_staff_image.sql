-- 0033_staff_image.sql
-- Foto del barbero/personal, para mostrarla como avatar en la página pública
-- de reservas ("Elige tu barbero"). La imagen se sube al bucket público
-- `service-images` (ya creado en 0029) y aquí solo guardamos su URL.
-- Idempotente.

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS image_url text;
