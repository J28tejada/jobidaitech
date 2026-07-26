-- =====================================================================
-- Servicios por barbero
-- =====================================================================
-- Cada barbero puede hacer solo ciertos servicios (ej. uno recorta, otra hace
-- trenzas). Guardamos en `staff.service_ids` un arreglo JSON con los IDs de los
-- servicios que ofrece. NULL o vacío = hace TODOS los servicios (compatible con
-- lo existente). Se usa para:
--   - mostrar en la reserva solo los barberos que hacen el servicio elegido, y
--   - calcular la disponibilidad de "Sin preferencia" con la capacidad real
--     (cuántos barberos hacen ESE servicio), evitando ofrecer horarios que en
--     realidad no están libres para ese servicio.
--
-- Es SEGURO re-ejecutar (idempotente). No toca datos existentes.
-- =====================================================================

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS service_ids jsonb;
