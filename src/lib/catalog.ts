import { supabase } from "@/lib/supabase";

export type CatalogProduct = {
  id: string;
  c: string;
  n: string;
  d: string;
  p: number | null;
  u: string;
  i: string;
  a: string[];
  on: boolean;
};

export type CatalogCategory = { id: string; n: string };
export type CatalogAddonItem = { id: string; n: string; p: number; on: boolean };
export type CatalogAddonGroup = {
  id: string;
  n: string;
  min?: number;
  max?: number;
  items: CatalogAddonItem[];
};

export type Catalog = {
  prods: CatalogProduct[];
  cats: CatalogCategory[];
  groups: CatalogAddonGroup[];
};

const STORAGE_KEY = "fs_catalog_v1";

export function readLocalCatalog(): Catalog {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { prods: [], cats: [], groups: [] };
    const parsed = JSON.parse(raw);
    return {
      prods: Array.isArray(parsed.prods) ? parsed.prods : [],
      cats: Array.isArray(parsed.cats) ? parsed.cats : [],
      groups: Array.isArray(parsed.groups) ? parsed.groups : [],
    };
  } catch {
    return { prods: [], cats: [], groups: [] };
  }
}

export function saveLocalCatalog(catalog: Catalog) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
}

export async function loadRemoteCatalog(): Promise<Catalog | null> {
  if (!supabase) return null;

  const [cats, products, groups, items, links] = await Promise.all([
    supabase.from("catalog_categories").select("id,name").eq("active", true).order("sort_order"),
    supabase.from("catalog_products").select("id,category_id,name,description,price,unit,image_url,active").eq("active", true).order("sort_order"),
    supabase.from("catalog_addon_groups").select("id,name,min_select,max_select").eq("active", true).order("sort_order"),
    supabase.from("catalog_addon_items").select("id,group_id,name,price,active").eq("active", true).order("sort_order"),
    supabase.from("catalog_product_addon_groups").select("product_id,group_id"),
  ]);

  if (cats.error || products.error || groups.error || items.error || links.error) {
    return null;
  }

  const catRows = cats.data ?? [];
  const productRows = products.data ?? [];
  const groupRows = groups.data ?? [];
  const itemRows = items.data ?? [];
  const linkRows = links.data ?? [];

  return {
    cats: catRows.map((c) => ({ id: c.id, n: c.name })),
    prods: productRows.map((p) => ({
      id: p.id,
      c: p.category_id ?? "",
      n: p.name,
      d: p.description ?? "",
      p: p.price === null ? null : Number(p.price),
      u: p.unit ?? "",
      i: p.image_url ?? "",
      a: linkRows.filter((l) => l.product_id === p.id).map((l) => l.group_id),
      on: p.active,
    })),
    groups: groupRows.map((g) => ({
      id: g.id,
      n: g.name,
      min: g.min_select,
      max: g.max_select,
      items: itemRows
        .filter((item) => item.group_id === g.id)
        .map((item) => ({ id: item.id, n: item.name, p: Number(item.price), on: item.active })),
    })),
  };
}

export async function saveRemoteCatalog(catalog: Catalog): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Supabase não configurado." };

  const categoryRows = catalog.cats.map((c, index) => ({ id:c.id, name:c.n, sort_order:index, active:true }));
  const productRows = catalog.prods.map((p, index) => ({ id:p.id, category_id:p.c || null, name:p.n, description:p.d, price:p.p, unit:p.u, image_url:p.i, sort_order:index, active:p.on }));
  const groupRows = catalog.groups.map((g, index) => ({ id:g.id, name:g.n, min_select:g.min ?? 0, max_select:g.max ?? 1, sort_order:index, active:true }));
  const itemRows = catalog.groups.flatMap(g => g.items.map((i,index) => ({ id:i.id, group_id:g.id, name:i.n, price:i.p, sort_order:index, active:i.on })));
  const linkRows = catalog.prods.flatMap(p => p.a.map(group_id => ({ product_id:p.id, group_id })));

  const writes = await Promise.all([
    supabase.from("catalog_categories").upsert(categoryRows),
    supabase.from("catalog_products").upsert(productRows),
    supabase.from("catalog_addon_groups").upsert(groupRows),
    supabase.from("catalog_addon_items").upsert(itemRows),
  ]);
  const failed = writes.find(w => w.error);
  if (failed?.error) return { ok:false, error:failed.error.message };

  const linkReset = await supabase.from("catalog_product_addon_groups").delete().neq("product_id", "");
  if (linkReset.error) return { ok:false, error:linkReset.error.message };
  if (linkRows.length) {
    const inserted = await supabase.from("catalog_product_addon_groups").insert(linkRows);
    if (inserted.error) return { ok:false, error:inserted.error.message };
  }
  return { ok:true };
}
