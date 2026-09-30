import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { Catalog, CatalogProduct } from "@/lib/catalog";
import { loadRemoteCatalog, readLocalCatalog } from "@/lib/catalog";
import { productMatchesSlug } from "@/lib/product-slug";

const whatsapp = "5547988776543";

export const Route = createFileRoute("/produto/$slug")({
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

  const message = encodeURIComponent(
    `Olá, Ferreira Sourdough! Gostaria de pedir: ${product.n}${product.p !== null ? ` — ${money(product.p)}` : ""}.`,
  );

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#171717]">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        <Link to="/" className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-gray-50">
          ← Voltar ao cardápio
        </Link>

        <section className="mt-5 overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm">
          <div className="grid lg:grid-cols-2">
            <div className="min-h-[300px] bg-gray-100 lg:min-h-[560px]">
              {product.i ? (
                <img src={product.i} alt={product.n} className="h-full min-h-[300px] w-full object-cover lg:min-h-[560px]" />
              ) : (
                <div className="flex h-full min-h-[300px] items-center justify-center text-sm text-gray-400 lg:min-h-[560px]">Sem imagem</div>
              )}
            </div>

            <div className="flex flex-col p-6 sm:p-9 lg:p-12">
              {category && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">{category}</p>}
              <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">{product.n}</h1>
              {product.d && <p className="mt-5 text-base leading-7 text-gray-600">{product.d}</p>}

              <div className="mt-7">
                <span className="text-3xl font-semibold">{money(product.p)}</span>
                {product.p !== null && product.u && <span className="ml-2 text-sm text-gray-500">{product.u}</span>}
              </div>

              {addonGroups.length > 0 && (
                <div className="mt-8 border-t border-black/10 pt-6">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Adicionais disponíveis</h2>
                  <div className="mt-4 space-y-4">
                    {addonGroups.map((group) => (
                      <div key={group.id} className="rounded-2xl bg-gray-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-semibold">{group.n}</h3>
                          {(group.min || group.max) && (
                            <span className="text-xs text-gray-500">
                              {group.min ? `mín. ${group.min}` : ""}
                              {group.min && group.max ? " · " : ""}
                              {group.max ? `máx. ${group.max}` : ""}
                            </span>
                          )}
                        </div>
                        <ul className="mt-3 space-y-2 text-sm text-gray-600">
                          {group.items.filter((item) => item.on !== false).map((item) => (
                            <li key={item.id} className="flex justify-between gap-4">
                              <span>{item.n}</span>
                              {item.p > 0 && <span className="font-medium">+ {money(item.p)}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-auto pt-8">
                <a
                  href={`https://wa.me/${whatsapp}?text=${message}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center rounded-xl bg-[#171717] px-5 py-3.5 text-sm font-semibold text-white hover:bg-black"
                >
                  Pedir este produto pelo WhatsApp
                </a>
                <p className="mt-3 text-center text-xs text-gray-400">Você poderá combinar os detalhes do pedido pelo WhatsApp.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
