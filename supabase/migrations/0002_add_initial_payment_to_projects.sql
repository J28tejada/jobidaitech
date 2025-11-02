-- Add initial_payment column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS initial_payment NUMERIC(12, 2) DEFAULT NULL;

-- Add comment to the column
COMMENT ON COLUMN projects.initial_payment IS 'Abono inicial o anticipo recibido al iniciar el proyecto';

