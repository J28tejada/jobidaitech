-- =====================================================================
-- Transferir proyectos a OTRA CUENTA (otro usuario)
-- =====================================================================
-- Caso: alguien registró datos con la cuenta equivocada y quiere pasarlos
-- a su cuenta real. La cuenta origen crea una transferencia hacia un correo;
-- la cuenta destino la acepta al iniciar sesión con ese correo. Los
-- proyectos y sus transacciones pasan al espacio personal del destino.
--
-- Es SEGURO re-ejecutar (idempotente).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.account_transfers (
  id                uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  from_user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  from_workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  to_email          text NOT NULL,
  project_ids       uuid[] NOT NULL,
  token             text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL DEFAULT (now() + interval '14 days')
);

CREATE INDEX IF NOT EXISTS idx_account_transfers_email ON public.account_transfers (lower(to_email));
CREATE INDEX IF NOT EXISTS idx_account_transfers_token ON public.account_transfers (token);

ALTER TABLE public.account_transfers ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.account_transfers TO anon, authenticated, service_role;

-- Aceptar una transferencia: mueve los proyectos (y sus transacciones) al
-- espacio destino, cambiando el dueño (created_by) a la cuenta destino y
-- reasignando las categorías por nombre/tipo. Devuelve cuántos proyectos movió.
CREATE OR REPLACE FUNCTION public.accept_account_transfer(
  p_token text,
  p_to_user uuid,
  p_to_workspace uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.account_transfers%ROWTYPE;
  pid uuid;
  moved integer := 0;
BEGIN
  SELECT * INTO t
    FROM public.account_transfers
    WHERE token = p_token AND status = 'pending' AND expires_at > now();

  IF NOT FOUND THEN
    RETURN -1;
  END IF;

  FOREACH pid IN ARRAY t.project_ids LOOP
    -- Mover transacciones del proyecto (solo si siguen en el espacio origen)
    UPDATE public.transactions
      SET workspace_id = p_to_workspace, user_id = p_to_user, category_id = NULL
      WHERE project_id = pid AND workspace_id = t.from_workspace_id;

    -- Reasignar categoría por nombre/tipo en el destino
    UPDATE public.transactions tx
      SET category_id = c.id
      FROM public.categories c
      WHERE tx.project_id = pid
        AND c.workspace_id = p_to_workspace
        AND c.name = tx.category_name
        AND c.type = tx.type;

    -- Mover el proyecto (solo si sigue en el espacio origen)
    UPDATE public.projects
      SET workspace_id = p_to_workspace, user_id = p_to_user, updated_at = now()
      WHERE id = pid AND workspace_id = t.from_workspace_id;

    IF FOUND THEN
      moved := moved + 1;
    END IF;

    DELETE FROM public.member_projects WHERE project_id = pid;
  END LOOP;

  UPDATE public.account_transfers SET status = 'accepted' WHERE id = t.id;
  RETURN moved;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_account_transfer(text, uuid, uuid) TO service_role, authenticated;

NOTIFY pgrst, 'reload schema';
