-- =====================================================================
-- Notificación de reservas (webhook → n8n → WhatsApp)
-- =====================================================================
-- Cuando un cliente reserva online, el negocio puede recibir un aviso por
-- WhatsApp. El envío se delega a un webhook (ej. n8n), que es quien manda
-- el WhatsApp. Guardamos:
--   booking_notify_url   : URL del webhook (n8n) al que avisamos
--   booking_notify_phone : WhatsApp del barbero/negocio a notificar
--
-- Es SEGURO re-ejecutar (idempotente). No toca datos existentes.
-- =====================================================================

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS booking_notify_url   text,
  ADD COLUMN IF NOT EXISTS booking_notify_phone text;
