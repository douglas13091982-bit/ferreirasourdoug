export function slugifyProductName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "produto";
}

export function productPath(name: string, id: string) {
  return `/produto/${slugifyProductName(name)}-${id.slice(0, 8)}`;
}

export function productMatchesSlug(name: string, id: string, slug: string) {
  return productPath(name, id).replace(/^\/produto\//, "") === slug;
}
