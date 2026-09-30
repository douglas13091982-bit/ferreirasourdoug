create table if not exists public.catalog_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.catalog_admins enable row level security;

drop policy if exists "admins can read own access" on public.catalog_admins;
create policy "admins can read own access" on public.catalog_admins for select to authenticated
using (user_id = auth.uid() and active = true);

create or replace function public.is_catalog_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.catalog_admins where user_id = auth.uid() and active = true);
$$;

revoke all on function public.is_catalog_admin() from public;
grant execute on function public.is_catalog_admin() to authenticated;

create policy "catalog admins insert categories" on public.catalog_categories for insert to authenticated with check (public.is_catalog_admin());
create policy "catalog admins update categories" on public.catalog_categories for update to authenticated using (public.is_catalog_admin()) with check (public.is_catalog_admin());
create policy "catalog admins delete categories" on public.catalog_categories for delete to authenticated using (public.is_catalog_admin());

create policy "catalog admins insert products" on public.catalog_products for insert to authenticated with check (public.is_catalog_admin());
create policy "catalog admins update products" on public.catalog_products for update to authenticated using (public.is_catalog_admin()) with check (public.is_catalog_admin());
create policy "catalog admins delete products" on public.catalog_products for delete to authenticated using (public.is_catalog_admin());

create policy "catalog admins insert addon groups" on public.catalog_addon_groups for insert to authenticated with check (public.is_catalog_admin());
create policy "catalog admins update addon groups" on public.catalog_addon_groups for update to authenticated using (public.is_catalog_admin()) with check (public.is_catalog_admin());
create policy "catalog admins delete addon groups" on public.catalog_addon_groups for delete to authenticated using (public.is_catalog_admin());

create policy "catalog admins insert addon items" on public.catalog_addon_items for insert to authenticated with check (public.is_catalog_admin());
create policy "catalog admins update addon items" on public.catalog_addon_items for update to authenticated using (public.is_catalog_admin()) with check (public.is_catalog_admin());
create policy "catalog admins delete addon items" on public.catalog_addon_items for delete to authenticated using (public.is_catalog_admin());

create policy "catalog admins insert product addon links" on public.catalog_product_addon_groups for insert to authenticated with check (public.is_catalog_admin());
create policy "catalog admins update product addon links" on public.catalog_product_addon_groups for update to authenticated using (public.is_catalog_admin()) with check (public.is_catalog_admin());
create policy "catalog admins delete product addon links" on public.catalog_product_addon_groups for delete to authenticated using (public.is_catalog_admin());

-- Após criar o usuário no Supabase Auth:
-- insert into public.catalog_admins (user_id) values ('UUID_DO_USUARIO_AUTH');
