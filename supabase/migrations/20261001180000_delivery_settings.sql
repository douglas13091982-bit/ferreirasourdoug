-- Configuração de entrega / frete baseada na distância calculada pelo Mapbox.
create table if not exists public.store_delivery_settings (
  id boolean primary key default true,
  base_fee numeric(10,2) not null default 0,
  price_per_km numeric(10,2) not null default 2.50,
  minimum_fee numeric(10,2) not null default 7.00,
  max_delivery_km numeric(10,2) not null default 20.00,
  origin_address text not null default 'Rua Frederico Hubner, 37, América, Joinville - SC, 89204-280, Brasil',
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.store_delivery_settings (id) values (true) on conflict (id) do nothing;
grant select on public.store_delivery_settings to anon, authenticated;
grant insert, update, delete on public.store_delivery_settings to authenticated;
alter table public.store_delivery_settings enable row level security;
create policy "public can read delivery settings" on public.store_delivery_settings for select to anon, authenticated using (active = true);
create policy "catalog admins manage delivery settings" on public.store_delivery_settings for all to authenticated using (public.is_catalog_admin()) with check (public.is_catalog_admin());
