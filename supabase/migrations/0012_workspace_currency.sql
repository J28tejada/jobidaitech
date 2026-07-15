-- =====================================================================
-- Ronda de madurez 1: Moneda/locale configurable por espacio
-- =====================================================================
-- Hasta ahora la moneda estaba fija en MXN en el código. Se agrega la
-- moneda y el locale al espacio (workspace) para poder mostrar RD$ (DOP)
-- y otras monedas de LATAM. Default = DOP (mercado inicial: RD).
--
-- Es SEGURO re-ejecutar (idempotente). Solo cambia el FORMATO de los
-- montos mostrados; no toca ningún valor guardado.
-- =====================================================================

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'DOP';

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'es-DO';

-- Backfill de espacios existentes al mercado inicial (RD).
-- (El dueño puede cambiarlo por espacio en Configuración.)
UPDATE public.workspaces SET currency = 'DOP' WHERE currency IS NULL OR currency = 'MXN';
UPDATE public.workspaces SET locale   = 'es-DO' WHERE locale   IS NULL OR locale   = 'es-MX';
