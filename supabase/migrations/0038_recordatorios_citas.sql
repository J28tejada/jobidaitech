-- Recordatorios de citas por WhatsApp.
--
-- El job que los envía corre cada pocos minutos, así que necesita una marca para
-- no avisar dos veces la misma cita: sin esto, dos corridas solapadas —o un
-- reintento— mandarían el recordatorio repetido, y eso al barbero se le lee como
-- que el sistema falla.
--
-- Es `timestamptz` y no un booleano a propósito: saber CUÁNDO se avisó permite
-- diagnosticar después ("¿salió tarde?"), y no cuesta más.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminded_at timestamptz;

COMMENT ON COLUMN public.appointments.reminded_at IS
  'Cuándo se envió el recordatorio previo por WhatsApp. NULL = todavía no. Evita avisos duplicados si el job corre dos veces.';

-- El job busca citas por ventana de tiempo entre las que aún no se avisaron.
-- El índice parcial mantiene chico el conjunto: las ya avisadas no se vuelven a
-- mirar nunca, y son la enorme mayoría con el tiempo.
CREATE INDEX IF NOT EXISTS idx_appointments_pendientes_recordar
  ON public.appointments (starts_at)
  WHERE reminded_at IS NULL;
