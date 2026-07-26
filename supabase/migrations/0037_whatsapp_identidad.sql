-- WhatsApp: el número identifica a la PERSONA, no al negocio.
--
-- Antes, `whatsapp_numbers.workspace_id` era el dueño del vínculo y cada código
-- recibido lo reescribía: mandar un código de otro negocio MUDABA el número en
-- silencio, y las notas siguientes (ventas, gastos, deudas) caían en el negocio
-- equivocado sin aviso.
--
-- El modelo pasa a ser el mismo que ya usa la web (ver getWorkspaceContext):
-- la identidad es el usuario, y el negocio activo es un puntero conmutable
-- validado contra workspace_members. Aquí eso se traduce en:
--
--   user_id      -> identidad. Se fija en el primer vínculo y no cambia.
--   workspace_id -> negocio activo. Conmutable, solo entre espacios donde ese
--                   usuario sea miembro.
--
-- No hay cambio de columnas: UNIQUE(phone) sigue siendo correcto porque bajo
-- este modelo hay una fila por teléfono. Lo que cambia es el significado, y por
-- eso se documenta en el esquema: quien lea la tabla sin este contexto asumiría
-- lo anterior.

COMMENT ON COLUMN public.whatsapp_numbers.user_id IS
  'Identidad: a qué cuenta pertenece este teléfono. Se fija en el primer vínculo y no debe reasignarse. Un código de otra cuenta se rechaza.';

COMMENT ON COLUMN public.whatsapp_numbers.workspace_id IS
  'Negocio activo de este teléfono. Conmutable ("cambiar a X"), pero solo entre espacios donde user_id sea miembro.';

COMMENT ON TABLE public.whatsapp_numbers IS
  'Un teléfono por fila. El teléfono identifica a una persona (user_id); workspace_id es el negocio en el que está operando ahora.';

-- Si se borra la cuenta, el vínculo deja de tener sentido: sin identidad, el
-- teléfono quedaría apuntando a un negocio sin dueño verificable. Antes quedaba
-- huérfano con user_id NULL.
ALTER TABLE public.whatsapp_numbers
  DROP CONSTRAINT IF EXISTS whatsapp_numbers_user_id_fkey;

ALTER TABLE public.whatsapp_numbers
  ADD CONSTRAINT whatsapp_numbers_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- La regla "el negocio activo debe ser uno donde el usuario es miembro" cruza
-- dos tablas y se valida al escribir (tryLinkByCode / cambio de negocio). Un
-- CHECK no puede expresarla sin un trigger, y el trigger costaría más de lo que
-- protege: la única ruta de escritura es el agente.
