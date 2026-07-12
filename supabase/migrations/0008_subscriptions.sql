-- =====================================================================
-- Suscripciones / control de acceso por usuario
-- =====================================================================
-- Cada usuario tiene un estado de acceso de ESCRITURA:
--   canWrite = access_enabled AND (access_until IS NULL OR now() < access_until)
--
-- - Usuario NUEVO: access_until = fecha de registro + 30 días (prueba).
-- - Usuario EXISTENTE (al aplicar esta migración): access_until = NULL
--   (activo indefinido; no se bloquea a nadie de golpe).
-- - "Desactivar" no prohíbe el acceso: el usuario sigue viendo su
--   información, pero no puede hacer cambios (solo lectura).
--
-- Es SEGURO re-ejecutar (idempotente).
-- =====================================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS access_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS access_until   timestamptz;         -- NULL = indefinido
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS plan           text;                -- NULL = prueba; 'mensual' | 'anual' | 'cortesia' | ...
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS admin_note     text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;

-- Los usuarios que ya existían quedan activos indefinidos (grandfathered).
-- (access_until permanece NULL para ellos; los nuevos reciben 30 días desde el código.)

CREATE INDEX IF NOT EXISTS idx_users_access_until ON public.users(access_until);
