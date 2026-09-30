import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "fs_catalog_v1";

type Product = {
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

type Category = { id: string; n: string };
type AddonItem = { id: string; n: string; p: number; on: boolean };
type AddonGroup = {
  id: string;
  n: string;
  min?: number;
  max?: number;
  items: AddonItem[];
};

type Catalog = {
  prods: Product[];
  cats: Category[];
  groups: AddonGroup[];
};

const emptyCatalog: Catalog = { prods: [], cats: [], groups: [] };

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administração | Ferreira Sourdough" },
      { name: "description", content: "Painel administrativo do catálogo Ferreira Sourdough." },
    ],
  }),
  component: AdminPage,
});

function readCatalog(): Catalog {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyCatalog;
    const parsed = JSON.parse(raw);
    return {
      prods: Array.isArray(parsed.prods) ? parsed.prods : [],
      cats: Array.isArray(parsed.cats) ? parsed.cats : [],
      groups: Array.isArray(parsed.groups) ? parsed.groups : [],
    };
  } catch {
    return emptyCatalog;
  }
}

function saveCatalog(catalog: Catalog) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
}

function makeId(prefix: string) {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

function money(value: number | null) {
  if (value === null || Number.isNaN(value)) return "Sob consulta";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function AdminPage() {
  const [catalog, setCatalog] = useState<Catalog>(emptyCatalog);
  const [section, setSection] = useState<"produtos" | "categorias" | "adicionais">("produtos");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setCatalog(readCatalog());
  }, []);

  function commit(next: Catalog, message = "Alterações salvas.") {
    setCatalog(next);
    saveCatalog(next);
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  }

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog.prods;
    return catalog.prods.filter((p) => {
      const category = catalog.cats.find((c) => c.id === p.c)?.n ?? "";
      return [p.n, p.d, category].some((value) => value.toLowerCase().includes(q));
    });
  }, [catalog, query]);

  function updateProduct(next: Product) {
    const exists = catalog.prods.some((p) => p.id === next.id);
    const prods = exists
      ? catalog.prods.map((p) => (p.id === next.id ? next : p))
      : [...catalog.prods, next];
    commit({ ...catalog, prods });
    setEditing(null);
  }

  function deleteProduct(id: string) {
    if (!window.confirm("Excluir este produto?")) return;
    commit({ ...catalog, prods: catalog.prods.filter((p) => p.id !== id) }, "Produto excluído.");
  }

  function toggleProduct(id: string) {
    commit({
      ...catalog,
      prods: catalog.prods.map((p) => (p.id === id ? { ...p, on: !p.on } : p)),
    });
  }

  function newProduct() {
    setSection("produtos");
    setEditing({
      id: makeId("p"),
      c: catalog.cats[0]?.id ?? "",
      n: "",
      d: "",
      p: 0,
      u: "",
      i: "",
      a: [],
      on: true,
    });
  }

  function exportCatalog() {
    const blob = new Blob([JSON.stringify(catalog, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ferreira-sourdough-catalogo.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importCatalog(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result)) as Catalog;
        if (!Array.isArray(imported.prods) || !Array.isArray(imported.cats) || !Array.isArray(imported.groups)) {
          throw new Error("Formato inválido");
        }
        commit(imported, "Catálogo importado.");
      } catch {
        setNotice("Arquivo de catálogo inválido.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-[#171717]">
      <header className="sticky top-0 z-30 border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#777]">Ferreira Sourdough</p>
            <h1 className="text-xl font-semibold tracking-tight">Administração do catálogo</h1>
          </div>
          <div className="flex items-center gap-2">
            {notice && <span className="hidden rounded-full bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 sm:block">{notice}</span>}
            <Link to="/" className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50">
              Ver site
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr]">
        <aside className="h-fit rounded-2xl border border-black/10 bg-white p-2 shadow-sm">
          <NavButton active={section === "produtos"} onClick={() => setSection("produtos")}>Produtos <Badge>{catalog.prods.length}</Badge></NavButton>
          <NavButton active={section === "categorias"} onClick={() => setSection("categorias")}>Categorias <Badge>{catalog.cats.length}</Badge></NavButton>
          <NavButton active={section === "adicionais"} onClick={() => setSection("adicionais")}>Adicionais <Badge>{catalog.groups.length}</Badge></NavButton>
          <div className="my-2 border-t border-black/5" />
          <button onClick={exportCatalog} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-gray-50">Exportar catálogo</button>
          <label className="block cursor-pointer rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-gray-50">
            Importar catálogo
            <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importCatalog(e.target.files[0])} />
          </label>
        </aside>

        <section className="min-w-0">
          {section === "produtos" && (
            <>
              <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-2xl font-semibold">Produtos</h2>
                  <p className="mt-1 text-sm text-gray-500">Cadastre e altere os itens exibidos no cardápio.</p>
                </div>
                <button onClick={newProduct} className="rounded-xl bg-[#171717] px-4 py-2.5 text-sm font-semibold text-white hover:bg-black">+ Novo produto</button>
              </div>

              <div className="mb-4 rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar produto, descrição ou categoria..." className="w-full rounded-xl border border-black/10 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-black/30" />
              </div>

              <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
                <div className="hidden grid-cols-[1fr_150px_120px_90px] gap-4 border-b border-black/10 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 md:grid">
                  <span>Produto</span><span>Categoria</span><span>Preço</span><span>Status</span>
                </div>
                {filteredProducts.length === 0 ? (
                  <div className="p-10 text-center text-sm text-gray-500">Nenhum produto encontrado.</div>
                ) : filteredProducts.map((p) => (
                  <div key={p.id} className="grid gap-3 border-b border-black/5 px-5 py-4 last:border-0 md:grid-cols-[1fr_150px_120px_90px] md:items-center md:gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                        {p.i ? <img src={p.i} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-gray-400">Sem foto</div>}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{p.n || "Sem nome"}</p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{p.d}</p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">{catalog.cats.find((c) => c.id === p.c)?.n ?? "Sem categoria"}</div>
                    <div className="font-semibold">{money(p.p)}</div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleProduct(p.id)} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${p.on ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>{p.on ? "Ativo" : "Oculto"}</button>
                      <button onClick={() => setEditing(p)} className="rounded-lg border border-black/10 px-2.5 py-1 text-xs font-medium hover:bg-gray-50">Editar</button>
                      <button onClick={() => deleteProduct(p.id)} className="rounded-lg border border-red-100 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Excluir</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {section === "categorias" && <CategoryManager catalog={catalog} commit={commit} />}
          {section === "adicionais" && <AddonManager catalog={catalog} commit={commit} />}
        </section>
      </main>

      {editing && <ProductEditor product={editing} catalog={catalog} onCancel={() => setEditing(null)} onSave={updateProduct} />}
    </div>
  );
}

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium ${active ? "bg-[#171717] text-white" : "hover:bg-gray-50"}`}>{children}</button>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs">{children}</span>;
}

function ProductEditor({ product, catalog, onCancel, onSave }: { product: Product; catalog: Catalog; onCancel: () => void; onSave: (product: Product) => void }) {
  const [form, setForm] = useState(product);
  const [preview, setPreview] = useState(product.i);

  function set<K extends keyof Product>(key: K, value: Product[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function readImage(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result);
      set("i", value);
      setPreview(value);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
      <div className="mx-auto my-6 max-w-2xl rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div><h2 className="text-xl font-semibold">{catalog.prods.some((p) => p.id === product.id) ? "Editar produto" : "Novo produto"}</h2><p className="mt-1 text-sm text-gray-500">As alterações serão refletidas no catálogo atual.</p></div>
          <button onClick={onCancel} className="rounded-full px-3 py-1 text-lg text-gray-400 hover:bg-gray-100">×</button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome"><input value={form.n} onChange={(e) => set("n", e.target.value)} className={inputClass} /></Field>
          <Field label="Categoria"><select value={form.c} onChange={(e) => set("c", e.target.value)} className={input}><option value="">Sem categoria</option>{catalog.cats.map((c) => <option key={c.id} value={c.id}>{c.n}</option>)}</select></Field>
          <Field label="Preço"><input type="number" step="0.01" value={form.p ?? ""} onChange={(e) => set("p", e.target.value === "" ? null : Number(e.target.value))} className={input} /></Field>
          <Field label="Unidade"><input value={form.u} onChange={(e) => set("u", e.target.value)} placeholder="/un, /100g..." className={input} /></Field>
          <div className="sm:col-span-2"><Field label="Descrição"><textarea value={form.d} onChange={(e) => set("d", e.target.value)} rows={4} className={input} /></Field></div>
          <div className="sm:col-span-2"><Field label="Imagem"><input type="file" accept="image/*" onChange={(e) => readImage(e.target.files?.[0])} className="block w-full rounded-xl border border-black/10 p-3 text-sm" />{preview && <img src={preview} alt="" className="mt-3 h-32 w-32 rounded-2xl object-cover" />}</Field></div>
          <label className="flex items-center gap-3 text-sm font-medium sm:col-span-2"><input type="checkbox" checked={form.on} onChange={(e) => set("on", e.target.checked)} className="h-4 w-4" /> Produto visível no cardápio</label>
        </div>
        <div className="mt-7 flex justify-end gap-2 border-t border-black/10 pt-5"><button onClick={onCancel} className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-medium">Cancelar</button><button onClick={() => onSave(form)} className="rounded-xl bg-[#171717] px-5 py-2.5 text-sm font-semibold text-white">Salvar produto</button></div>
      </div>
    </div>
  );
}

const inputClass = "mt-1 w-full rounded-xl border border-black/10 bg-gray-50 px-3.5 py-3 text-sm outline-none focus:border-black/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium">{label}{children}</label>;
}

function CategoryManager({ catalog, commit }: { catalog: Catalog; commit: (next: Catalog, message?: string) => void }) {
  const [name, setName] = useState("");
  function add() {
    const value = name.trim();
    if (!value) return;
    commit({ ...catalog, cats: [...catalog.cats, { id: makeId("cat"), n: value }] }, "Categoria criada.");
    setName("");
  }
  function remove(id: string) {
    if (catalog.prods.some((p) => p.c === id)) return window.alert("Não é possível excluir uma categoria que possui produtos.");
    commit({ ...catalog, cats: catalog.cats.filter((c) => c.id !== id) }, "Categoria excluída.");
  }
  return <Manager title="Categorias" description="Organize os produtos do cardápio." inputValue={name} setInput={setName} onAdd={add} addLabel="Nova categoria">{catalog.cats.map((c) => <div key={c.id} className="flex items-center justify-between border-b border-black/5 px-5 py-4 last:border-0"><span className="font-medium">{c.n}</span><button onClick={() => remove(c.id)} className="text-sm text-red-600">Excluir</button></div>)}</Manager>;
}

function AddonManager({ catalog, commit }: { catalog: Catalog; commit: (next: Catalog, message?: string) => void }) {
  const [name, setName] = useState("");
  function add() {
    const value = name.trim();
    if (!value) return;
    commit({ ...catalog, groups: [...catalog.groups, { id: makeId("grp"), n: value, min: 0, max: 1, items: [] }] }, "Grupo de adicionais criado.");
    setName("");
  }
  function remove(id: string) {
    const prods = catalog.prods.map((p) => ({ ...p, a: p.a.filter((groupId) => groupId !== id) }));
    commit({ ...catalog, prods, groups: catalog.groups.filter((g) => g.id !== id) }, "Grupo excluído.");
  }
  return <Manager title="Adicionais" description="Gerencie grupos de complementos usados pelos produtos." input={name} setInput={setName} onAdd={add} addLabel="Novo grupo">{catalog.groups.map((g) => <div key={g.id} className="flex items-center justify-between border-b border-black/5 px-5 py-4 last:border-0"><div><p className="font-medium">{g.n}</p><p className="text-xs text-gray-500">{g.items.length} opções</p></div><button onClick={() => remove(g.id)} className="text-sm text-red-600">Excluir</button></div>)}</Manager>;
}

function Manager({ title, description, inputValue, setInput, onAdd, addLabel, children }: { title: string; description: string; inputValue: string; setInput: (value: string) => void; onAdd: () => void; addLabel: string; children: React.ReactNode }) {
  return <><div className="mb-5"><h2 className="text-2xl font-semibold">{title}</h2><p className="mt-1 text-sm text-gray-500">{description}</p></div><div className="mb-4 flex gap-2"><input value={inputValue} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onAdd()} placeholder={`Nome de ${title.toLowerCase()}...`} className={`flex-1 ${inputClass}`} /><button onClick={onAdd} className="rounded-xl bg-[#171717] px-4 py-2.5 text-sm font-semibold text-white">{addLabel}</button></div><div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">{children}</div></>;
}
