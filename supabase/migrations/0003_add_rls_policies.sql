-- Enable Row Level Security on all tables
-- Esto asegura que incluso si alguien tiene acceso directo a la base de datos,
-- solo puede ver y modificar sus propios datos
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- IMPORTANTE: Las políticas RLS funcionan cuando se accede desde el cliente de Supabase (anónimo).
-- En nuestras API routes usamos el service role key, por lo que el filtrado por user_id en el código
-- es la principal capa de seguridad. Las políticas RLS son una defensa adicional.

-- Policy for users table: Users can only see and modify their own record
-- auth.uid() retorna UUID, pero id es text. Convertimos ambos a text para comparar
CREATE POLICY "Users can view own data"
  ON public.users
  FOR SELECT
  USING ((id::text) = (auth.uid()::text));

CREATE POLICY "Users can update own data"
  ON public.users
  FOR UPDATE
  USING ((id::text) = (auth.uid()::text));

CREATE POLICY "Users can insert own data"
  ON public.users
  FOR INSERT
  WITH CHECK ((id::text) = (auth.uid()::text));

-- Policy for projects table: Users can only see and modify their own projects
CREATE POLICY "Users can view own projects"
  ON public.projects
  FOR SELECT
  USING ((user_id::text) = (auth.uid()::text));

CREATE POLICY "Users can insert own projects"
  ON public.projects
  FOR INSERT
  WITH CHECK ((user_id::text) = (auth.uid()::text));

CREATE POLICY "Users can update own projects"
  ON public.projects
  FOR UPDATE
  USING ((user_id::text) = (auth.uid()::text));

CREATE POLICY "Users can delete own projects"
  ON public.projects
  FOR DELETE
  USING ((user_id::text) = (auth.uid()::text));

-- Policy for transactions table: Users can only see and modify their own transactions
CREATE POLICY "Users can view own transactions"
  ON public.transactions
  FOR SELECT
  USING ((user_id::text) = (auth.uid()::text));

CREATE POLICY "Users can insert own transactions"
  ON public.transactions
  FOR INSERT
  WITH CHECK ((user_id::text) = (auth.uid()::text));

CREATE POLICY "Users can update own transactions"
  ON public.transactions
  FOR UPDATE
  USING ((user_id::text) = (auth.uid()::text));

CREATE POLICY "Users can delete own transactions"
  ON public.transactions
  FOR DELETE
  USING ((user_id::text) = (auth.uid()::text));

-- Policy for categories table: Users can only see and modify their own categories
CREATE POLICY "Users can view own categories"
  ON public.categories
  FOR SELECT
  USING ((user_id::text) = (auth.uid()::text));

CREATE POLICY "Users can insert own categories"
  ON public.categories
  FOR INSERT
  WITH CHECK ((user_id::text) = (auth.uid()::text));

CREATE POLICY "Users can update own categories"
  ON public.categories
  FOR UPDATE
  USING ((user_id::text) = (auth.uid()::text));

CREATE POLICY "Users can delete own categories"
  ON public.categories
  FOR DELETE
  USING ((user_id::text) = (auth.uid()::text));

