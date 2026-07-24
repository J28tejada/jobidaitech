-- =====================================================================
-- Soporte a grupos de WhatsApp para el agente de captura
-- =====================================================================
-- Un negocio puede conectar un GRUPO de WhatsApp (no solo un número directo):
-- el dueño agrega el número del asistente al grupo y envía el código ahí. A
-- partir de ese momento, cualquier anotación en el grupo se registra en la app.
--
-- La columna `phone` de whatsapp_numbers guarda, para grupos, el id del grupo
-- (parte antes de @g.us). `is_group` distingue el tipo de chat. El teléfono de
-- quien escribe en el grupo se guarda en whatsapp_messages.meta.sender.
--
-- Es SEGURO re-ejecutar (idempotente). No toca datos existentes.
-- =====================================================================

ALTER TABLE public.whatsapp_numbers
  ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false;
