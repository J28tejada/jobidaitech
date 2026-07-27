-- WhatsApp propio del negocio.
--
-- Hasta ahora todo salía por el número de la plataforma: los mensajes al dueño
-- (correcto, es Jobidai hablando con su cliente) y también los recordatorios a
-- los clientes del negocio (incorrecto). Un recordatorio desde un número que el
-- cliente no tiene agendado se lee como spam, y le carga a la plataforma la
-- reputación de mensajería de todos sus negocios.
--
-- Cada negocio conecta su propio WhatsApp como una instancia de Evolution. NULL
-- significa que todavía no lo conectó, y en ese caso NO se cae al número de la
-- plataforma: se avisa y no se manda. Ese fallback anularía el motivo del cambio.

ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS evolution_instance text;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS evolution_phone text;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS evolution_connected_at timestamptz;

COMMENT ON COLUMN public.workspaces.evolution_instance IS
  'Instancia de Evolution con el WhatsApp propio del negocio. NULL = no conectado; los mensajes a clientes quedan deshabilitados (no se usa el número de la plataforma).';
COMMENT ON COLUMN public.workspaces.evolution_phone IS
  'Número que quedó vinculado, para mostrarlo en Ajustes y detectar que cambió.';
COMMENT ON COLUMN public.workspaces.evolution_connected_at IS
  'Cuándo se vinculó por última vez. Sirve para diagnosticar sesiones caídas.';

-- El webhook llega con el nombre de la instancia y hay que resolver el negocio a
-- partir de él, en cada mensaje.
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_evolution_instance
  ON public.workspaces (evolution_instance) WHERE evolution_instance IS NOT NULL;
