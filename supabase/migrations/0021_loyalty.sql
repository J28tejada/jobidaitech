-- =====================================================================
-- Fidelidad (tarjeta de sellos digital) + base para reactivación
-- =====================================================================
-- Config de fidelidad por espacio (cada N visitas atendidas → recompensa:
-- corte gratis o % de descuento) y contador de canjes por cliente para
-- reiniciar la "tarjeta". La reactivación (win-back) se calcula del historial,
-- no necesita columnas nuevas.
--
-- Es SEGURO re-ejecutar (idempotente). No toca datos existentes.
-- =====================================================================

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS loyalty_enabled    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS loyalty_threshold  integer NOT NULL DEFAULT 10,     -- visitas para la recompensa
  ADD COLUMN IF NOT EXISTS loyalty_reward_pct numeric(5,2) NOT NULL DEFAULT 100; -- 100 = gratis; si no, % de descuento

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS loyalty_redeemed_count integer NOT NULL DEFAULT 0;  -- nº de visitas al último canje
