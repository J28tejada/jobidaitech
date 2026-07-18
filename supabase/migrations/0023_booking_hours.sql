-- =====================================================================
-- Horario de reservas POR DÍA
-- =====================================================================
-- Antes las reservas usaban un solo horario (open/close) para todos los
-- días. Ahora cada día de la semana puede tener su propio horario (o estar
-- cerrado), definido por el negocio. Se guarda como JSON:
--   { "1": {"open":"09:00","close":"19:00"}, "6": {"open":"08:00","close":"20:00"} }
-- La clave es el día (0=Dom .. 6=Sáb); si un día no aparece, está cerrado.
--
-- Nullable y sin relleno: si es NULL, la app cae al horario legado
-- (booking_days + booking_open_time/close_time) para no romper a nadie.
--
-- Es SEGURO re-ejecutar (idempotente). No toca datos existentes.
-- =====================================================================

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS booking_hours jsonb;
