-- Extensiones necesarias para UUID y utilidades
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- Tabla de usuarios autenticados (clave proveniente de Google OAuth)
create table if not exists public.users (
  id text primary key,
  email text unique,
  name text,
  image_url text,
  business_type text not null default 'carpentry',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Categorías personalizadas por usuario
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  subcategories jsonb,
  color text,
  created_at timestamptz not null default now()
);

-- Proyectos registrados por usuario
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  name text not null,
  description text,
  client text not null,
  start_date date not null,
  end_date date,
  status text not null check (status in ('active', 'completed', 'paused', 'cancelled')) default 'active',
  budget numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Transacciones de ingresos/egresos
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  category_id uuid references public.categories(id) on delete set null,
  category_name text not null,
  subcategory text,
  description text not null,
  amount numeric(14,2) not null,
  date date not null,
  payment_method text not null,
  reference text,
  attachments jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_user on public.projects(user_id);
create index if not exists idx_transactions_user on public.transactions(user_id);
create index if not exists idx_transactions_project on public.transactions(project_id);
create index if not exists idx_transactions_date on public.transactions(date);

-- Función genérica para actualizar "updated_at"
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_timestamp_users
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger set_timestamp_projects
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger set_timestamp_transactions
  before update on public.transactions
  for each row execute function public.set_updated_at();
