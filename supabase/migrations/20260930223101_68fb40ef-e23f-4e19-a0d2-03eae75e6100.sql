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

create table if not exists public.catalog_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

grant select on public.catalog_categories, public.catalog_addon_groups, public.catalog_addon_items, public.catalog_products, public.catalog_product_addon_groups to anon;
grant select, insert, update, delete on public.catalog_categories, public.catalog_addon_groups, public.catalog_addon_items, public.catalog_products, public.catalog_product_addon_groups to authenticated;
grant select on public.catalog_admins to authenticated;
grant all on public.catalog_categories, public.catalog_addon_groups, public.catalog_addon_items, public.catalog_products, public.catalog_product_addon_groups, public.catalog_admins to service_role;

alter table public.catalog_categories enable row level security;
alter table public.catalog_addon_groups enable row level security;
alter table public.catalog_addon_items enable row level security;
alter table public.catalog_products enable row level security;
alter table public.catalog_product_addon_groups enable row level security;
alter table public.catalog_admins enable row level security;

create policy "public can read active categories" on public.catalog_categories for select to anon, authenticated using (active = true);
create policy "public can read active addon groups" on public.catalog_addon_groups for select to anon, authenticated using (active = true);
create policy "public can read active addon items" on public.catalog_addon_items for select to anon, authenticated using (active = true);
create policy "public can read active products" on public.catalog_products for select to anon, authenticated using (active = true);
create policy "public can read product addon groups" on public.catalog_product_addon_groups for select to anon, authenticated
using (exists (select 1 from public.catalog_products p where p.id = product_id and p.active = true));

create index if not exists idx_catalog_products_category on public.catalog_products(category_id);
create index if not exists idx_catalog_addon_items_group on public.catalog_addon_items(group_id);

create policy "admins can read own access" on public.catalog_admins for select to authenticated
using (user_id = auth.uid() and active = true);

create or replace function public.is_catalog_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.catalog_admins where user_id = auth.uid() and active = true); $$;
revoke all on function public.is_catalog_admin() from public;
grant execute on function public.is_catalog_admin() to authenticated;

create policy "catalog admins insert categories" on public.catalog_categories for insert to authenticated with check (public.is_catalog_admin());
create policy "catalog admins update categories" on public.catalog_categories for update to authenticated using (public.is_catalog_admin()) with check (public.is_catalog_admin());
create policy "catalog admins delete categories" on public.catalog_categories for delete to authenticated using (public.is_catalog_admin());
create policy "catalog admins read categories" on public.catalog_categories for select to authenticated using (public.is_catalog_admin());

create policy "catalog admins insert products" on public.catalog_products for insert to authenticated with check (public.is_catalog_admin());
create policy "catalog admins update products" on public.catalog_products for update to authenticated using (public.is_catalog_admin()) with check (public.is_catalog_admin());
create policy "catalog admins delete products" on public.catalog_products for delete to authenticated using (public.is_catalog_admin());
create policy "catalog admins read products" on public.catalog_products for select to authenticated using (public.is_catalog_admin());

create policy "catalog admins insert addon groups" on public.catalog_addon_groups for insert to authenticated with check (public.is_catalog_admin());
create policy "catalog admins update addon groups" on public.catalog_addon_groups for update to authenticated using (public.is_catalog_admin()) with check (public.is_catalog_admin());
create policy "catalog admins delete addon groups" on public.catalog_addon_groups for delete to authenticated using (public.is_catalog_admin());
create policy "catalog admins read addon groups" on public.catalog_addon_groups for select to authenticated using (public.is_catalog_admin());

create policy "catalog admins insert addon items" on public.catalog_addon_items for insert to authenticated with check (public.is_catalog_admin());
create policy "catalog admins update addon items" on public.catalog_addon_items for update to authenticated using (public.is_catalog_admin()) with check (public.is_catalog_admin());
create policy "catalog admins delete addon items" on public.catalog_addon_items for delete to authenticated using (public.is_catalog_admin());
create policy "catalog admins read addon items" on public.catalog_addon_items for select to authenticated using (public.is_catalog_admin());

create policy "catalog admins insert product addon links" on public.catalog_product_addon_groups for insert to authenticated with check (public.is_catalog_admin());
create policy "catalog admins update product addon links" on public.catalog_product_addon_groups for update to authenticated using (public.is_catalog_admin()) with check (public.is_catalog_admin());
create policy "catalog admins delete product addon links" on public.catalog_product_addon_groups for delete to authenticated using (public.is_catalog_admin());
create policy "catalog admins read product addon links" on public.catalog_product_addon_groups for select to authenticated using (public.is_catalog_admin());

create or replace function public.catalog_admin_exists()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.catalog_admins where active = true); $$;
revoke all on function public.catalog_admin_exists() from public;
grant execute on function public.catalog_admin_exists() to anon, authenticated;

create or replace function public.claim_catalog_admin()
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  perform pg_advisory_xact_lock(424242);
  if exists (select 1 from public.catalog_admins) then return false; end if;
  if not exists (select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null) then
    raise exception 'email not confirmed';
  end if;
  insert into public.catalog_admins (user_id) values (auth.uid());
  return true;
end; $$;
revoke all on function public.claim_catalog_admin() from public;
grant execute on function public.claim_catalog_admin() to authenticated;