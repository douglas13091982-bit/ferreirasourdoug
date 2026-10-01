alter table public.store_delivery_settings
  add column if not exists mapbox_token text not null default '';

