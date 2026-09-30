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
