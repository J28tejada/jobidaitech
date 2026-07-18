-- =====================================================================
-- Reservas online: link público para que el cliente reserve 24/7
-- =====================================================================
-- Configuración de reservas por espacio: token público, horario, intervalo
-- de turnos, días abiertos y seña. La página pública usa el token para
-- mostrar servicios/barberos y crear la cita.
--
-- Es SEGURO re-ejecutar (idempotente). No toca datos existentes.
-- =====================================================================

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS booking_token      text DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  ADD COLUMN IF NOT EXISTS booking_enabled    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS booking_open_time  text NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS booking_close_time text NOT NULL DEFAULT '19:00',
  ADD COLUMN IF NOT EXISTS booking_slot_min   integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS booking_days       text NOT NULL DEFAULT '1,2,3,4,5,6',  -- 0=Dom .. 6=Sáb
  ADD COLUMN IF NOT EXISTS booking_deposit    numeric(15,2) NOT NULL DEFAULT 0;

-- Rellena token en filas que quedaron sin él y garantiza unicidad.
UPDATE public.workspaces
  SET booking_token = encode(extensions.gen_random_bytes(16), 'hex')
  WHERE booking_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_booking_token
  ON public.workspaces(booking_token);
