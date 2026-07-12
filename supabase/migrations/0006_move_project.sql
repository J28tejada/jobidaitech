-- =====================================================================
-- Mover un proyecto (con sus transacciones) de un espacio a otro
-- =====================================================================
-- Función atómica: mueve el proyecto y todas sus transacciones al espacio
-- destino en una sola transacción. Reasigna la categoría de cada
-- transacción a la categoría equivalente del destino (por nombre y tipo);
-- si no existe, deja la categoría en blanco pero conserva el nombre.
--
-- Es SEGURO re-ejecutar (CREATE OR REPLACE).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.move_project(p_project_id uuid, p_target_workspace uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mover las transacciones y limpiar la referencia de categoría del origen
  UPDATE public.transactions
    SET workspace_id = p_target_workspace, category_id = NULL
    WHERE project_id = p_project_id;

  -- Reasignar la categoría por nombre y tipo en el destino
  UPDATE public.transactions t
    SET category_id = c.id
    FROM public.categories c
    WHERE t.project_id = p_project_id
      AND c.workspace_id = p_target_workspace
      AND c.name = t.category_name
      AND c.type = t.type;

  -- Mover el proyecto
  UPDATE public.projects
    SET workspace_id = p_target_workspace, updated_at = now()
    WHERE id = p_project_id;

  -- Limpiar asignaciones de alcance del espacio origen
  DELETE FROM public.member_projects WHERE project_id = p_project_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.move_project(uuid, uuid) TO service_role, authenticated;

-- Refrescar el cache de PostgREST para que la función esté disponible por RPC
NOTIFY pgrst, 'reload schema';
