-- Rastro de origen: de dónde salió cada registro.
--
-- Todo lo que entra por WhatsApp tiene que ser tan auditable como lo cargado a
-- mano. Sin esto, un ingreso anotado por chat es indistinguible de uno tecleado
-- en la app, y ante una duda ("¿esto quién lo puso?") no hay a qué mirar.
--
-- Se reusa el nombre `source`, que ya es la convención del esquema
-- (opportunities.source guarda whatsapp / instagram / referido...). Una segunda
-- palabra para lo mismo obligaría a recordar cuál aplica en cada tabla.
--
-- NULL = cargado desde la app, que es el caso por defecto y el de todo lo
-- existente. No se rellena retroactivamente: inventar un origen para datos
-- viejos seria peor que dejarlo vacio.

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.expenses     ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.receivables  ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.clients      ADD COLUMN IF NOT EXISTS source text;

COMMENT ON COLUMN public.transactions.source IS
  'De dónde salió el registro: whatsapp, o NULL si se cargó desde la app.';
COMMENT ON COLUMN public.expenses.source IS
  'De dónde salió el registro: whatsapp, o NULL si se cargó desde la app.';
COMMENT ON COLUMN public.receivables.source IS
  'De dónde salió el registro: whatsapp, o NULL si se cargó desde la app.';
COMMENT ON COLUMN public.clients.source IS
  'De dónde salió el registro: whatsapp, o NULL si se cargó desde la app.';

-- Para poder listar rápido lo que entró por chat sin recorrer toda la tabla.
CREATE INDEX IF NOT EXISTS idx_transactions_source ON public.transactions (workspace_id, source) WHERE source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_source     ON public.expenses (workspace_id, source)     WHERE source IS NOT NULL;
