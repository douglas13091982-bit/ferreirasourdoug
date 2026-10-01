import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { Catalog, CatalogAddonGroup, CatalogProduct } from "@/lib/catalog";
import { loadRemoteCatalog, readLocalCatalog } from "@/lib/catalog";
import { productMatchesSlug } from "@/lib/product-slug";

export const Route = createFileRoute("/produto/$slug")({
  head: () => ({ meta: [
    { title: "Produto | Ferreira Sourdough" },
    { name: "description", content: "Conheça os produtos artesanais da Ferreira Sourdough em Joinville." },
    { property: "og:title", content: "Produto | Ferreira Sourdough" },
    { property: "og:description", content: "Conheça os produtos artesanais da Ferreira Sourdough em Joinville." },
    { property: "og:type", content: "product" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ProductPage,
});

function money(value: number | null) {
  if (value === null || Number.isNaN(value)) return "Sob consulta";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ProductPage() {
  const { slug } = Route.useParams();
  const [catalog, setCatalog] = useState<Catalog>({ prods: [], cats: [], groups: [] });
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let active = true;
    loadRemoteCatalog().then((remote) => {
      if (active) setCatalog(remote ?? readLocalCatalog());
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const product = useMemo<CatalogProduct | null>(
    () => catalog.prods.find((item) => productMatchesSlug(item.n, item.id, slug)) ?? null,
    [catalog, slug],
  );

  useEffect(() => {
    if (!product) return;
    document.title = `${product.n} | Ferreira Sourdough`;
    const description = product.d || `${product.n} — Ferreira Sourdough`;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", description);
  }, [product]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5] text-sm text-gray-500">Carregando produto...</div>;
  }

  if (!product) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5] px-4">
        <div className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-8 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Ferreira Sourdough</p>
          <h1 className="mt-3 text-2xl font-semibold">Produto não encontrado</h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">Este produto pode ter sido removido ou não está mais disponível no cardápio.</p>
          <Link to="/" className="mt-6 inline-flex rounded-xl bg-[#171717] px-5 py-3 text-sm font-semibold text-white">Voltar ao cardápio</Link>
        </div>
      </div>
    );
  }

  const category = catalog.cats.find((item) => item.id === product.c)?.n;
  const addonGroups = (product.a ?? [])
    .map((id) => catalog.groups.find((group) => group.id === id))
    .filter((group): group is NonNullable<typeof group> => Boolean(group));

  const addonTotal = addonGroups.reduce((total, group) =>
    total + (selected[group.id] ?? []).reduce((sum, itemId) =>
      sum + (group.items.find((item) => item.id === itemId)?.p ?? 0), 0), 0);
  const unitTotal = (product.p ?? 0) + addonTotal;
  const total = unitTotal * quantity;

  function toggleAddon(group: CatalogAddonGroup, itemId: string) {
    setError("");
    setSelected((current) => {
      const currentItems = current[group.id] ?? [];
      if (currentItems.includes(itemId)) return { ...current, [group.id]: currentItems.filter((id) => id !== itemId) };
      if (group.max === 1) return { ...current, [group.id]: [itemId] };
      if (group.max && currentItems.length >= group.max) return current;
      return { ...current, [group.id]: [...currentItems, itemId] };
    });
  }

  function validate() {
    for (const group of addonGroups) {
      const count = (selected[group.id] ?? []).length;
      if (group.min && count < group.min) {
        setError(`Escolha ao menos ${group.min} opção(ões) em "${group.n}".`);
        return false;
      }
      if (group.max && count > group.max) {
        setError(`Escolha no máximo ${group.max} opção(ões) em "${group.n}".`);
        return false;
      }
    }
    return true;
  }

  function addToCart() {
    if (!product || product.p === null || !validate()) return;
    const productId = product.id;
    const extras = addonGroups.flatMap((group) =>
      (selected[group.id] ?? []).map((itemId) => {
        const item = group.items.find((entry) => entry.id === itemId);
        if (!item) return null;
        return { g: group.id, i: item.id, n: item.n, p: item.p || 0 };
      }).filter((item): item is NonNullable<typeof item> => item !== null),
    );
    try {
      const raw = localStorage.getItem("fs_pending_cart_v1");
      const pending = raw ? JSON.parse(raw) : { items: [] };
      const items = Array.isArray(pending.items) ? pending.items : [];
      for (let index = 0; index < quantity; index += 1) items.push({ pid: productId, ex: extras });
      localStorage.setItem("fs_pending_cart_v1", JSON.stringify({ items }));
      setAdded(true);
    } catch {
      setError("Não foi possível preparar o item para o pedido. Tente novamente.");
    }
  }


  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#171717]">
      <div className="mx-auto max-w-6xl px-3 py-3 sm:px-6 sm:py-8">
        <Link to="/" className="mb-1 inline-flex min-h-11 items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-gray-50">
          ← Voltar ao cardápio
        </Link>

        <section className="mt-3 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm sm:mt-5 sm:rounded-3xl">
          <div className="grid lg:grid-cols-2">
            <div className="min-h-0 bg-gray-100 lg:min-h-[560px]">
              {product.i ? (
                <img src={product.i} alt={product.n} className="aspect-[4/3] h-auto w-full object-cover sm:aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[560px]" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center text-sm text-gray-400 sm:aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[560px]">Sem imagem</div>
              )}
            </div>

            <div className="flex flex-col p-4 sm:p-9 lg:p-12">
              {category && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">{category}</p>}
              <h1 className="mt-2 text-2xl font-semibold leading-tight sm:mt-3 sm:text-4xl">{product.n}</h1>
              {product.d && <p className="mt-3 text-sm leading-6 text-gray-600 sm:mt-5 sm:text-base sm:leading-7">{product.d}</p>}

              <div className="mt-5 sm:mt-7">
                <span className="text-2xl font-semibold sm:text-3xl">{money(product.p)}</span>
                {product.p !== null && product.u && <span className="ml-2 text-sm text-gray-500">{product.u}</span>}
              </div>

              {product.p !== null && addonGroups.length > 0 && (
                <div className="mt-6 space-y-3 border-t border-black/10 pt-5 sm:mt-8 sm:space-y-4 sm:pt-6">
                  <div><h2 className="text-lg font-semibold">Personalize seu produto</h2><p className="mt-1 text-sm text-gray-500">Escolha os adicionais que deseja.</p></div>
                  {addonGroups.map((group) => {
                    const selectedItems = selected[group.id] ?? [];
                    return <fieldset key={group.id} className="rounded-2xl border border-black/10 p-3 sm:p-4">
                      <legend className="px-1 text-sm font-semibold">{group.n}</legend>
                      <p className="mb-3 text-xs text-gray-500">
                        {group.min ? `Escolha pelo menos ${group.min}` : "Opcional"}{group.max ? ` · até ${group.max}` : ""}
                      </p>
                      <div className="space-y-2">
                        {group.items.filter((item) => item.on !== false).map((item) => {
                          const checked = selectedItems.includes(item.id);
                          return <label key={item.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm ${checked ? "border-black bg-gray-50" : "border-black/10"}`}>
                            <input type={group.max === 1 ? "radio" : "checkbox"} name={group.id} checked={checked} onChange={() => toggleAddon(group, item.id)} className="h-4 w-4" />
                            <span className="flex-1 text-sm">{item.n}</span>{item.p > 0 && <span className="text-sm font-medium">+ {money(item.p)}</span>}
                          </label>;
                        })}
                      </div>
                    </fieldset>;
                  })}
                </div>
              )}

              {product.p !== null && (
                <div className="mt-auto pt-6 sm:pt-8">
                  <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-gray-50 p-3">
                    <span className="text-sm font-semibold">Quantidade</span>
                    <div className="flex items-center gap-4">
                      <button type="button" aria-label="Diminuir quantidade" onClick={() => setQuantity((v) => Math.max(1, v - 1))} className="h-11 w-11 rounded-xl border border-black/10 bg-white text-lg">−</button>
                      <strong className="w-5 text-center">{quantity}</strong>
                      <button type="button" aria-label="Aumentar quantidade" onClick={() => setQuantity((v) => v + 1)} className="h-11 w-11 rounded-xl border border-black/10 bg-white text-lg">+</button>
                    </div>
                  </div>
                  {error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
                  <div className="mt-4 flex items-end justify-between"><span className="text-sm text-gray-500">Total</span><strong className="text-2xl sm:text-3xl">{money(total)}</strong></div>
                  {added ? (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <Link to="/" className="flex items-center justify-center rounded-xl bg-[#171717] px-5 py-3.5 text-sm font-semibold text-white">Continuar comprando</Link>
                      <button type="button" onClick={() => { localStorage.setItem("fs_open_cart_v1", "1"); window.location.href = "/#cardapio"; }} className="rounded-xl border border-black/15 bg-white px-5 py-3.5 text-sm font-semibold">Ver meu pedido</button>
                    </div>
                  ) : (
                    <button type="button" onClick={addToCart} className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-[#171717] px-5 py-3.5 text-sm font-semibold text-white hover:bg-black sm:mt-5">Adicionar ao pedido · {money(total)}</button>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
