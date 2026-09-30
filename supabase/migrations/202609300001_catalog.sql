-- Ferreira Sourdough catalog schema
-- Execute in the project's Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.catalog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_addon_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer not null default 1 check (max_select >= min_select),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_addon_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.catalog_addon_groups(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null default 0,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.catalog_categories(id) on delete set null,
  name text not null,
  description text not null default '',
  price numeric(10,2),
  unit text not null default '',
  image_url text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_product_addon_groups (
  product_id uuid not null references public.catalog_products(id) on delete cascade,
  group_id uuid not null references public.catalog_addon_groups(id) on delete cascade,
  primary key (product_id, group_id)
);

alter table public.catalog_categories enable row level security;
alter table public.catalog_addon_groups enable row level security;
alter table public.catalog_addon_items enable row level security;
alter table public.catalog_products enable row level security;
alter table public.catalog_product_addon_groups enable row level security;

-- Public catalog is readable; writes remain blocked until an authenticated
-- admin policy is explicitly configured for the project's auth model.
create policy "public can read active categories"
on public.catalog_categories for select
to anon, authenticated
using (active = true);

create policy "public can read active addon groups"
on public.catalog_addon_groups for select
to anon, authenticated
using (active = true);

create policy "public can read active addon items"
on public.catalog_addon_items for select
to anon, authenticated
using (active = true);

create policy "public can read active products"
on public.catalog_products for select
to anon, authenticated
using (active = true);

create policy "public can read product addon groups"
on public.catalog_product_addon_groups for select
to anon, authenticated
using (
  exists (
    select 1 from public.catalog_products p
    where p.id = product_id and p.active = true
  )
);

create index if not exists idx_catalog_products_category on public.catalog_products(category_id);
create index if not exists idx_catalog_addon_items_group on public.catalog_addon_items(group_id);
