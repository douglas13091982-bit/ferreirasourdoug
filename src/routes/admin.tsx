import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { loadRemoteCatalog, readLocalCatalog, saveLocalCatalog, saveRemoteCatalog } from "@/lib/catalog";
import { supabase } from "@/lib/supabase";

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

function makeId(prefix: string) {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

function money(value: number | null) {
  if (value === null || Number.isNaN(value)) return "Sob consulta";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function AdminPage() {
  return <AdminAuthGate><CatalogAdminPage /></AdminAuthGate>;
}

function CatalogAdminPage() {
  const [catalog, setCatalog] = useState<Catalog>({ prods: [], cats: [], groups: [] });
  const [section, setSection] = useState<"produtos" | "categorias" | "adicionais">("produtos");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [notice, setNotice] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const remote = await loadRemoteCatalog();
      if (!cancelled && remote && (remote.prods.length || remote.cats.length || remote.groups.length)) setCatalog(remote);
      else if (!cancelled) setCatalog(readLocalCatalog());
    })();
    return () => { cancelled = true; };
  }, []);

  function commit(next: Catalog, message = "Alterações salvas.") {
    setCatalog(next);
    saveLocalCatalog(next);
    void saveRemoteCatalog(next);
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

  async function migrateInitialCatalog() {
    if (!supabase || !session) {
      setNotice("Entre no painel com uma conta administrativa antes de migrar.");
      return;
    }
    if (!window.confirm("Migrar o catálogo original para o Supabase? Os dados atuais do banco serão complementados/atualizados pelos itens do catálogo original.")) return;
    const { INITIAL_CATALOG } = await import("@/lib/catalog-seed");
    const result = await saveRemoteCatalog(INITIAL_CATALOG);
    if (!result.ok || !result.catalog) { setNotice(result.error ?? "Falha na migração."); return; }
    setCatalog(result.catalog);
    saveLocalCatalog(result.catalog);
    setNotice("Catálogo original migrado para o Supabase.");
    window.setTimeout(() => setNotice(""), 3500);
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
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-black/10 bg-white lg:flex lg:flex-col">
        <div className="border-b border-black/10 px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Ferreira Sourdough</p>
          <h1 className="mt-1 text-lg font-semibold">Administração</h1>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <NavButton active={section === "produtos"} onClick={() => setSection("produtos")}>Produtos <Badge>{catalog.prods.length}</Badge></NavButton>
          <NavButton active={section === "categorias"} onClick={() => setSection("categorias")}>Categorias <Badge>{catalog.cats.length}</Badge></NavButton>
          <NavButton active={section === "adicionais"} onClick={() => setSection("adicionais")}>Adicionais <Badge>{catalog.groups.length}</Badge></NavButton>
          <div className="my-3 border-t border-black/5" />
          <button onClick={exportCatalog} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-gray-50">Exportar catálogo</button>
          <label className="block cursor-pointer rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-gray-50">Importar catálogo<input type="file" accept=".json,application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importCatalog(e.target.files[0])} /></label>
        </nav>
        <div className="border-t border-black/10 p-3">
          <Link to="/" className="block rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-gray-50">← Voltar ao site</Link>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-black/10 bg-white/95 backdrop-blur lg:ml-64">
        <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 lg:hidden">Ferreira Sourdough</p>
            <h1 className="text-lg font-semibold lg:text-xl">Administração do catálogo</h1>
          </div>
          <div className="flex items-center gap-2">
            {notice && <span className="hidden rounded-full bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 sm:block">{notice}</span>}
            <Link to="/" className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50">Ver site</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:ml-64">
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

      <div className="border-t border-black/10 bg-white px-4 py-3 lg:hidden">
        <div className="flex gap-2 overflow-x-auto">
          <NavButton active={section === "produtos"} onClick={() => setSection("produtos")}>Produtos <Badge>{catalog.prods.length}</Badge></NavButton>
          <NavButton active={section === "categorias"} onClick={() => setSection("categorias")}>Categorias <Badge>{catalog.cats.length}</Badge></NavButton>
          <NavButton active={section === "adicionais"} onClick={() => setSection("adicionais")}>Adicionais <Badge>{catalog.groups.length}</Badge></NavButton>
        </div>
      </div>

      {editing && <ProductEditor product={editing} catalog={catalog} onCancel={() => setEditing(null)} onSave={updateProduct} />}
    </div>
  );
}

function AdminAuthGate({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [canClaim, setCanClaim] = useState(false);

  async function checkAccess(next: Session | null) {
    setSession(next);
    if (!next) { setAuthorized(false); setCanClaim(false); return; }
    const { data: admin } = await supabase.from("catalog_admins").select("user_id").eq("user_id", next.user.id).maybeSingle();
    if (admin) { setAuthorized(true); setCanClaim(false); return; }
    setAuthorized(false);
    const { data: exists } = await supabase.rpc("catalog_admin_exists");
    setCanClaim(exists === false);
  }

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      void checkAccess(data.session).finally(() => { if (active) setLoading(false); });
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") setTimeout(() => { if (active) void checkAccess(next); }, 0);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setInfo("");
    if (mode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin + "/admin" } });
      if (signUpError) setError(signUpError.message);
      else { setInfo("Conta criada! Abra o e-mail de confirmação que enviamos e clique no link. Depois volte aqui e entre."); setMode("login"); setPassword(""); }
      setBusy(false); return;
    }
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError || !data.session) setError(signInError?.message === "Email not confirmed" ? "Confirme seu e-mail antes de entrar." : "E-mail ou senha incorretos.");
    else await checkAccess(data.session);
    setBusy(false);
  }

  async function claim() {
    setBusy(true); setError("");
    const { data, error: claimError } = await supabase.rpc("claim_catalog_admin");
    if (claimError) setError("Não foi possível ativar. Confirme seu e-mail e tente novamente.");
    else if (!data) { setError("Já existe um administrador. Esta conta não foi autorizada."); setCanClaim(false); }
    else await checkAccess(session);
    setBusy(false);
  }

  async function logout() { await supabase.auth.signOut(); }

  const card = "w-full max-w-md rounded-3xl border border-black/10 bg-white p-7 shadow-xl sm:p-9";
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] text-sm text-gray-500">Carregando acesso seguro...</div>;

  if (session && !authorized) return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] px-4 py-10">
      <div className={card}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Ferreira Sourdough</p>
        <h1 className="mt-2 text-2xl font-semibold">{canClaim ? "Ativar administrador" : "Acesso não autorizado"}</h1>
        <p className="mt-2 text-sm text-gray-500">Conectado como <strong>{session.user.email}</strong>.</p>
        <p className="mt-3 text-sm text-gray-600">{canClaim ? "Ainda não existe nenhum administrador. Ative esta conta como a administradora do painel. Isso só pode ser feito uma única vez." : "Esta conta não tem permissão para acessar o painel."}</p>
        {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
        {canClaim && <button onClick={claim} disabled={busy} className="mt-6 w-full rounded-xl bg-[#171717] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Ativando..." : "Ativar minha conta de administrador"}</button>}
        <button onClick={logout} className="mt-3 w-full rounded-xl border border-black/10 px-4 py-3 text-sm font-medium">Sair</button>
      </div>
    </div>
  );

  if (!session) return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] px-4 py-10">
      <form onSubmit={submit} className={card}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Ferreira Sourdough</p>
        <h1 className="mt-2 text-2xl font-semibold">{mode === "login" ? "Acesso administrativo" : "Criar conta"}</h1>
        <p className="mt-2 text-sm text-gray-500">{mode === "login" ? "Entre com sua conta de administrador para gerenciar o catálogo." : "Crie sua conta. Você vai receber um e-mail para confirmar."}</p>
        <div className="mt-7 space-y-4">
          <Field label="E-mail"><input required type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} /></Field>
          <Field label="Senha"><input required minLength={8} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} className={inputClass} /></Field>
        </div>
        {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
        {info && <p className="mt-4 rounded-xl bg-green-50 px-3 py-2.5 text-sm text-green-800">{info}</p>}
        <button disabled={busy} className="mt-6 w-full rounded-xl bg-[#171717] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}</button>
        <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setInfo(""); }} className="mt-3 w-full text-center text-sm text-gray-600 hover:text-gray-900">{mode === "login" ? "Primeiro acesso? Criar conta" : "Já tenho conta. Entrar"}</button>
        <Link to="/" className="mt-4 block text-center text-sm text-gray-500 hover:text-gray-900">Voltar ao site</Link>
      </form>
    </div>
  );
  return <div>{children}<button onClick={logout} className="fixed bottom-4 right-4 z-40 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold shadow-lg hover:bg-gray-50">Sair</button></div>;
}

function AuthMessage({ title, message }: { title: string; message: string }) {
  return <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] px-4"><div className="max-w-md rounded-3xl border border-black/10 bg-white p-8 text-center shadow-xl"><h1 className="text-xl font-semibold">{title}</h1><p className="mt-3 text-sm leading-6 text-gray-600">{message}</p><Link to="/" className="mt-6 inline-block rounded-xl bg-[#171717] px-4 py-2.5 text-sm font-semibold text-white">Voltar ao site</Link></div></div>;
}

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium ${active ? "bg-[#171717] text-white" : "hover:bg-gray-50"}`}>{children}</button>;
}

function Badge({ children }: { children: ReactNode }) {
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
          <Field label="Categoria"><select value={form.c} onChange={(e) => set("c", e.target.value)} className={inputClass}><option value="">Sem categoria</option>{catalog.cats.map((c) => <option key={c.id} value={c.id}>{c.n}</option>)}</select></Field>
          <Field label="Preço"><input type="number" step="0.01" value={form.p ?? ""} onChange={(e) => set("p", e.target.value === "" ? null : Number(e.target.value))} className={inputClass} /></Field>
          <Field label="Unidade"><input value={form.u} onChange={(e) => set("u", e.target.value)} placeholder="/un, /100g..." className={inputClass} /></Field>
          <div className="sm:col-span-2"><Field label="Descrição"><textarea value={form.d} onChange={(e) => set("d", e.target.value)} rows={4} className={inputClass} /></Field></div>
          <div className="sm:col-span-2"><Field label="Imagem"><input type="file" accept="image/*" onChange={(e) => readImage(e.target.files?.[0])} className="block w-full rounded-xl border border-black/10 p-3 text-sm" />{preview && <img src={preview} alt="" className="mt-3 h-32 w-32 rounded-2xl object-cover" />}</Field></div>
          <label className="flex items-center gap-3 text-sm font-medium sm:col-span-2"><input type="checkbox" checked={form.on} onChange={(e) => set("on", e.target.checked)} className="h-4 w-4" /> Produto visível no cardápio</label>
        </div>
        <div className="mt-7 flex justify-end gap-2 border-t border-black/10 pt-5"><button onClick={onCancel} className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-medium">Cancelar</button><button onClick={() => onSave(form)} className="rounded-xl bg-[#171717] px-5 py-2.5 text-sm font-semibold text-white">Salvar produto</button></div>
      </div>
    </div>
  );
}

const inputClass = "mt-1 w-full rounded-xl border border-black/10 bg-gray-50 px-3.5 py-3 text-sm outline-none focus:border-black/30";

function Field({ label, children }: { label: string; children: ReactNode }) {
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
  return <Manager title="Adicionais" description="Gerencie grupos de complementos usados pelos produtos." inputValue={name} setInput={setName} onAdd={add} addLabel="Novo grupo">{catalog.groups.map((g) => <div key={g.id} className="flex items-center justify-between border-b border-black/5 px-5 py-4 last:border-0"><div><p className="font-medium">{g.n}</p><p className="text-xs text-gray-500">{g.items.length} opções</p></div><button onClick={() => remove(g.id)} className="text-sm text-red-600">Excluir</button></div>)}</Manager>;
}

function Manager({ title, description, inputValue, setInput, onAdd, addLabel, children }: { title: string; description: string; inputValue: string; setInput: (value: string) => void; onAdd: () => void; addLabel: string; children: ReactNode }) {
  return <><div className="mb-5"><h2 className="text-2xl font-semibold">{title}</h2><p className="mt-1 text-sm text-gray-500">{description}</p></div><div className="mb-4 flex gap-2"><input value={inputValue} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onAdd()} placeholder={`Nome de ${title.toLowerCase()}...`} className={`flex-1 ${inputClass}`} /><button onClick={onAdd} className="rounded-xl bg-[#171717] px-4 py-2.5 text-sm font-semibold text-white">{addLabel}</button></div><div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">{children}</div></>;
}
