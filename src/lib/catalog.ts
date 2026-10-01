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

export async function loadRemoteCatalog(includeInactive = false): Promise<Catalog | null> {
  const [cats, products, groups, items, links] = await Promise.all([
    supabase.from("catalog_categories").select("id,name,active").order("sort_order"),
    supabase.from("catalog_products").select("id,category_id,name,description,price,unit,image_url,active").order("sort_order"),
    supabase.from("catalog_addon_groups").select("id,name,min_select,max_select,active").order("sort_order"),
    supabase.from("catalog_addon_items").select("id,group_id,name,price,active").order("sort_order"),
    supabase.from("catalog_product_addon_groups").select("product_id,group_id"),
  ]);

  if (cats.error || products.error || groups.error || items.error || links.error) {
    return null;
  }

  const catRows = (cats.data ?? []).filter(c => includeInactive || c.active);
  const productRows = (products.data ?? []).filter(p => includeInactive || p.active);
  const groupRows = (groups.data ?? []).filter(g => includeInactive || g.active);
  const itemRows = (items.data ?? []).filter(i => includeInactive || i.active);
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function newUuid() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "00000000-0000-4000-8000-" + Math.random().toString(16).slice(2).padEnd(12, "0").slice(0, 12);
}

export function normalizeCatalogForRemote(catalog: Catalog): Catalog {
  const categoryMap = new Map<string, string>();
  const groupMap = new Map<string, string>();
  const itemMap = new Map<string, string>();

  const cats = catalog.cats.map(c => {
    const id = isUuid(c.id) ? c.id : newUuid();
    categoryMap.set(c.id, id);
    return { ...c, id };
  });
  const groups = catalog.groups.map(g => {
    const id = isUuid(g.id) ? g.id : newUuid();
    groupMap.set(g.id, id);
    return { ...g, id, items: g.items.map(item => {
      const itemId = isUuid(item.id) ? item.id : newUuid();
      itemMap.set(item.id, itemId);
      return { ...item, id: itemId };
    }) };
  });
  const prods = catalog.prods.map(p => ({
    ...p,
    id: isUuid(p.id) ? p.id : newUuid(),
    c: categoryMap.get(p.c) ?? p.c,
    a: (p.a ?? []).map(id => groupMap.get(id) ?? id),
  }));

  return { cats, groups, prods };
}

export async function saveRemoteCatalog(catalog: Catalog): Promise<{ ok: boolean; error?: string; catalog?: Catalog }> {
  const normalized = normalizeCatalogForRemote(catalog);
  const categoryRows = normalized.cats.map((c, index) => ({ id:c.id, name:c.n, sort_order:index, active:true }));
  const productRows = normalized.prods.map((p, index) => ({ id:p.id, category_id:p.c || null, name:p.n, description:p.d, price:p.p, unit:p.u, image_url:p.i, sort_order:index, active:p.on }));
  const groupRows = normalized.groups.map((g, index) => ({ id:g.id, name:g.n, min_select:g.min ?? 0, max_select:g.max ?? 1, sort_order:index, active:true }));
  const itemRows = normalized.groups.flatMap(g => g.items.map((i,index) => ({ id:i.id, group_id:g.id, name:i.n, price:i.p, sort_order:index, active:i.on })));
  const linkRows = normalized.prods.flatMap(p => p.a.map(group_id => ({ product_id:p.id, group_id })));

  // Respect foreign keys: parents first on insert, children first on deletion.
  for (const result of [
    ...(categoryRows.length ? [await supabase.from("catalog_categories").upsert(categoryRows)] : []),
    ...(groupRows.length ? [await supabase.from("catalog_addon_groups").upsert(groupRows)] : []),
    ...(productRows.length ? [await supabase.from("catalog_products").upsert(productRows)] : []),
    ...(itemRows.length ? [await supabase.from("catalog_addon_items").upsert(itemRows)] : []),
  ]) if (result.error) return { ok: false, error: result.error.message };

  const existing = await Promise.all([
    supabase.from("catalog_product_addon_groups").select("product_id,group_id"),
    supabase.from("catalog_addon_items").select("id"),
    supabase.from("catalog_products").select("id"),
    supabase.from("catalog_addon_groups").select("id"),
    supabase.from("catalog_categories").select("id"),
  ]);
  for (const result of existing) if (result.error) return { ok: false, error: result.error.message };
  const wantedLinks = new Set(linkRows.map(l => `${l.product_id}:${l.group_id}`));
  for (const link of existing[0].data ?? []) {
    if (!wantedLinks.has(`${link.product_id}:${link.group_id}`)) {
      const { error } = await supabase.from("catalog_product_addon_groups").delete().eq("product_id", link.product_id).eq("group_id", link.group_id);
      if (error) return { ok: false, error: error.message };
    }
  }
  if (linkRows.length) {
    const { error } = await supabase.from("catalog_product_addon_groups").upsert(linkRows);
    if (error) return { ok: false, error: error.message };
  }
  const removeMissing = async (table: "catalog_addon_items" | "catalog_products" | "catalog_addon_groups" | "catalog_categories", ids: string[], keep: Set<string>) => {
    for (const id of ids) {
      if (!keep.has(id)) {
        const { error } = await supabase.from(table).delete().eq("id", id);
        if (error) return error.message;
      }
    }
    return null;
  };
  const deletions = [
    await removeMissing("catalog_addon_items", (existing[1]?.data ?? []).map(r => r.id), new Set(itemRows.map(r => r.id))),
    await removeMissing("catalog_products", (existing[2]?.data ?? []).map(r => r.id), new Set(productRows.map(r => r.id))),
    await removeMissing("catalog_addon_groups", (existing[3]?.data ?? []).map(r => r.id), new Set(groupRows.map(r => r.id))),
    await removeMissing("catalog_categories", (existing[4]?.data ?? []).map(r => r.id), new Set(categoryRows.map(r => r.id))),
  ];
  const deletionError = deletions.find(Boolean);
  if (deletionError) return { ok: false, error: deletionError };
  return { ok:true, catalog: normalized };
}
