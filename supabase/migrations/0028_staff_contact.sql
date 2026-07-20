-- =====================================================================
-- Contacto del barbero/personal (para avisarle de sus citas)
-- =====================================================================
-- Guarda teléfono y correo de cada barbero para notificarle cuando se le
-- asigna una reserva (email + WhatsApp). No requiere que el barbero tenga
-- cuenta propia.
--
-- Es SEGURO re-ejecutar (idempotente). No toca datos existentes.
-- =====================================================================

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text;
