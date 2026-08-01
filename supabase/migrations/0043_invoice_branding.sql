-- =====================================================================
-- Marca en facturas/reportes: emisor (negocio) + logo del cliente
-- =====================================================================
-- Para que el reporte de videos se vea como una factura con identidad:
--   workspaces.invoice_* : datos y logo del EMISOR (ej. "Jobidai Media"),
--     configurables en Ajustes. Si están vacíos, se usa el nombre del negocio.
--   clients.logo_url     : logo del CLIENTE (ej. "Refriservices"), que se sube
--     en su ficha y aparece en su factura.
-- Los logos se suben al bucket público `service-images` (0029) y aquí solo se
-- guarda su URL.
--
-- Es SEGURO re-ejecutar (idempotente). No toca datos existentes.
-- =====================================================================

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS invoice_logo_url text,
  ADD COLUMN IF NOT EXISTS invoice_name     text,
  ADD COLUMN IF NOT EXISTS invoice_tax_id   text,
  ADD COLUMN IF NOT EXISTS invoice_phone    text,
  ADD COLUMN IF NOT EXISTS invoice_email    text,
  ADD COLUMN IF NOT EXISTS invoice_address  text;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS logo_url text;
