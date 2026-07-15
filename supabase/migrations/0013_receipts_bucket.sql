-- =====================================================================
-- Ronda de madurez 1: bucket de almacenamiento para recibos/adjuntos
-- =====================================================================
-- Crea el bucket PRIVADO `receipts` donde se guardan los recibos de las
-- transacciones. Solo lo toca el service_role (que ignora RLS), así que no
-- hacen falta políticas de acceso: la app sirve los archivos con URLs
-- firmadas temporales (/api/uploads/sign).
--
-- Es SEGURO re-ejecutar (idempotente).
-- =====================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;
