create policy "catalog admins read categories"
on public.catalog_categories for select to authenticated
using (public.is_catalog_admin());

create policy "catalog admins read products"
on public.catalog_products for select to authenticated
using (public.is_catalog_admin());

create policy "catalog admins read addon groups"
on public.catalog_addon_groups for select to authenticated
using (public.is_catalog_admin());

create policy "catalog admins read addon items"
on public.catalog_addon_items for select to authenticated
using (public.is_catalog_admin());

create policy "catalog admins read product addon links"
on public.catalog_product_addon_groups for select to authenticated
using (public.is_catalog_admin());
