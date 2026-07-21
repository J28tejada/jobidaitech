-- =====================================================================
-- Mensaje de bienvenida de la página de reservas
-- =====================================================================
-- Texto corto que el negocio puede editar y que se muestra bajo su nombre
-- en la página pública de reservas (ej. "Reserva tu corte fácil y rápido").
--
-- Es SEGURO re-ejecutar (idempotente).
-- =====================================================================

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS booking_intro text;
