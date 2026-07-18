-- =====================================================================
-- Limpieza: espacios "personal" duplicados + prevención
-- =====================================================================
-- Una condición de carrera (varias peticiones en la primera carga creando
-- el espacio personal a la vez, sin restricción única) dejó a algunos
-- usuarios con VARIOS espacios 'personal'. Eso hacía que .maybeSingle()
-- lanzara PGRST116 ("multiple rows") y rompiera getWorkspaceContext.
--
-- Esta migración:
--   1) Borra los espacios 'personal' duplicados que están VACÍOS (sin datos
--      reales), conservando SIEMPRE el más antiguo de cada dueño (el que la
--      app ya usa). Nunca borra un duplicado que tenga datos.
--   2) Crea un índice único parcial para impedir que vuelva a pasar
--      (un solo espacio 'personal' por dueño).
--
-- Es SEGURO re-ejecutar (idempotente) y NO borra datos de nadie.
-- =====================================================================

-- 1) BORRAR DUPLICADOS VACÍOS ----------------------------------------
--    Un espacio se borra solo si:
--      - NO es el más antiguo de su dueño (hay otro 'personal' anterior), y
--      - no tiene NINGÚN dato real (proyectos, transacciones, cobros,
--        productos, clientes, cotizaciones, oportunidades, servicios,
--        citas ni videos).
--    Las categorías y membresías (config) se eliminan en cascada.
DELETE FROM public.workspaces w
WHERE w.type = 'personal'
  AND EXISTS (
    SELECT 1 FROM public.workspaces w2
    WHERE w2.owner_id = w.owner_id
      AND w2.type = 'personal'
      AND w2.created_at < w.created_at
  )
  AND NOT EXISTS (SELECT 1 FROM public.projects       x WHERE x.workspace_id = w.id)
  AND NOT EXISTS (SELECT 1 FROM public.transactions   x WHERE x.workspace_id = w.id)
  AND NOT EXISTS (SELECT 1 FROM public.receivables    x WHERE x.workspace_id = w.id)
  AND NOT EXISTS (SELECT 1 FROM public.products       x WHERE x.workspace_id = w.id)
  AND NOT EXISTS (SELECT 1 FROM public.clients        x WHERE x.workspace_id = w.id)
  AND NOT EXISTS (SELECT 1 FROM public.quotes         x WHERE x.workspace_id = w.id)
  AND NOT EXISTS (SELECT 1 FROM public.opportunities  x WHERE x.workspace_id = w.id)
  AND NOT EXISTS (SELECT 1 FROM public.services       x WHERE x.workspace_id = w.id)
  AND NOT EXISTS (SELECT 1 FROM public.appointments   x WHERE x.workspace_id = w.id)
  AND NOT EXISTS (SELECT 1 FROM public.videos         x WHERE x.workspace_id = w.id);

-- 2) PREVENCIÓN: un solo espacio 'personal' por dueño ----------------
--    Si tras el paso 1 aún quedaran duplicados CON datos (caso raro que no
--    tocamos por seguridad), la creación del índice fallaría; lo capturamos
--    con un aviso en vez de abortar la migración.
DO $mig$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_one_personal_per_owner
    ON public.workspaces (owner_id)
    WHERE type = 'personal';
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Aún hay dueños con varios espacios personales con datos; revisa manualmente antes de crear el índice único.';
END
$mig$;
