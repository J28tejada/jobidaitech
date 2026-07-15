-- =====================================================================
-- Módulo 3: Inventario ("¿Qué tengo y cuánto?")
-- =====================================================================
-- Catálogo de productos con costo, precio, unidad, stock y alerta de bajo
-- stock, más un historial de movimientos (entrada/salida/ajuste). El stock
-- vive en products.stock; cada movimiento aplica stock += delta.
--
-- Es el segundo MÓDULO DE PAGO: se habilita según el plan del dueño del
-- espacio (ver src/lib/modules.ts → 'inventory' en trial/negocio/pro).
--
-- Es SEGURO re-ejecutar (idempotente). NO restringe a nadie: solo agrega
-- tablas nuevas.
-- =====================================================================

-- 1) PRODUCTOS --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id                   uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  workspace_id         uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id              uuid REFERENCES public.users(id) ON DELETE SET NULL,   -- creado por
  name                 text NOT NULL,
  sku                  text,
  unit                 text NOT NULL DEFAULT 'unidad',
  cost                 numeric(15,2) NOT NULL DEFAULT 0,
  price                numeric(15,2) NOT NULL DEFAULT 0,
  stock                numeric(15,2) NOT NULL DEFAULT 0,
  low_stock_threshold  numeric(15,2) NOT NULL DEFAULT 0,
  active               boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- 2) MOVIMIENTOS (HISTORIAL) -----------------------------------------
-- workspace_id se denormaliza para poder filtrar sin join.
-- quantity es el DELTA con signo aplicado al stock (+entrada, −salida).
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  product_id   uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  type         text NOT NULL DEFAULT 'adjust' CHECK (type IN ('in','out','adjust')),
  quantity     numeric(15,2) NOT NULL,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 3) ÍNDICES ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_workspace   ON public.products(workspace_id);
CREATE INDEX IF NOT EXISTS idx_products_active      ON public.products(active);
CREATE INDEX IF NOT EXISTS idx_inv_moves_product    ON public.inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_moves_workspace  ON public.inventory_movements(workspace_id);
-- SKU único por espacio (solo cuando hay sku), sin distinguir mayúsculas.
CREATE UNIQUE INDEX IF NOT EXISTS uidx_products_workspace_sku
  ON public.products (workspace_id, lower(sku)) WHERE sku IS NOT NULL AND sku <> '';

-- 4) TRIGGER updated_at (reusa la función existente) ------------------
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) RLS (defensa adicional; las APIs usan service_role) --------------
ALTER TABLE public.products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view workspace products" ON public.products;
CREATE POLICY "members can view workspace products" ON public.products
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members m
      WHERE m.workspace_id = products.workspace_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "members can view workspace movements" ON public.inventory_movements;
CREATE POLICY "members can view workspace movements" ON public.inventory_movements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members m
      WHERE m.workspace_id = inventory_movements.workspace_id AND m.user_id = auth.uid()
    )
  );

GRANT ALL ON TABLE public.products            TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.inventory_movements TO anon, authenticated, service_role;
