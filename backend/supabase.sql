-- Run this once in Supabase SQL Editor before setting backend/.env credentials.
-- The backend uses its service-role key; never expose that key to the browser.

create table if not exists public.wlo_users (
  email text primary key,
  password_hash text not null,
  company_id text not null unique,
  company_name text not null,
  dataset_size integer not null default 56 check (dataset_size in (56, 90)),
  dataset_seed integer not null,
  created_at timestamptz not null default now()
);

-- Safe migration for an earlier 50/70 demo schema.
alter table public.wlo_users drop constraint if exists wlo_users_dataset_size_check;
alter table public.wlo_users add constraint wlo_users_dataset_size_check check (dataset_size between 1 and 500);

create table if not exists public.wlo_datasets (
  company_id text primary key,
  owner_email text not null references public.wlo_users(email) on delete cascade,
  neighborhoods jsonb not null,
  candidates jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.wlo_runs (
  id bigint generated always as identity primary key,
  company_id text,
  name text not null,
  algorithm text not null,
  warehouse_count integer not null,
  total_cost numeric not null,
  avg_distance numeric not null,
  runtime_ms integer not null,
  created_at timestamptz not null default now()
);

create index if not exists wlo_runs_company_created_idx on public.wlo_runs (company_id, created_at desc);

-- The server accesses this schema with the service-role key. If clients are
-- ever allowed to use Supabase directly, enable RLS and add user-scoped rules.
