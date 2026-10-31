import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  CircleUser,
  Home,
  MessageCircle,
  Package,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { authClient, GROK_PROVIDERS, signIn, signOut } from "@/lib/auth/client";
import { authErrorMessage, signUpNeedsVerification } from "@/lib/auth/messages";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { syncLedger } from "@/lib/cobra/functions";
import { adoptAnonInto, loadLedger, readLastUser, saveLedger, writeLastUser } from "@/lib/cobra/local";
import {
  activeCustomers,
  activeProducts,
  addMonths,
  balanceOf,
  chargeMessage,
  commit,
  displayStatus,
  emptyLedger,
  formatBRL,
  formatDateBR,
  formatPhoneBR,
  isValidEmail,
  mergeAfterSync,
  normalizeWhatsApp,
  nowIso,
  parseMoneyToCents,
  splitCents,
  todaySP,
  uid,
  whatsappHref,
  type Customer,
  type Ledger,
  type Product,
  type Snapshot,
  type SyncOp,
} from "@/lib/cobra/logic";

type View =
  | { name: "home" }
  | { name: "customers" }
  | { name: "customer"; id: string }
  | { name: "new-customer" }
  | { name: "edit-customer"; id: string }
  | { name: "products" }
  | { name: "new-product" }
  | { name: "edit-product"; id: string }
  | { name: "sale"; customerId?: string }
  | { name: "charges" }
  | { name: "account" };

type Phase = "offline" | "syncing" | "synced" | "error" | "local";

function navOf(view: View): View["name"] {
  if (view.name === "customer" || view.name === "new-customer" || view.name === "edit-customer") return "customers";
  if (view.name === "new-product" || view.name === "edit-product") return "products";
  if (view.name === "sale") return "home";
  return view.name;
}

export function CobraApp() {
  const { user } = useCurrentUserState();
  const [bucket, setBucket] = useState("anon");
  const [ledger, setLedger] = useState<Ledger>(emptyLedger);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>({ name: "home" });
  const [online, setOnline] = useState(true);
  const [phase, setPhase] = useState<Phase>("local");
  const [notice, setNotice] = useState("");
  const ledgerRef = useRef(ledger);
  const inflight = useRef(false);
  const pullSoon = useRef(true);
  const onlineRef = useRef(typeof navigator === "undefined" ? true : navigator.onLine);
  const seenUser = useRef<string | null>(null);
  const lastPull = useRef(0);
  ledgerRef.current = ledger;

  const persist = useCallback(
    (next: Ledger) => {
      ledgerRef.current = next;
      setLedger(next);
      if (!saveLedger(bucket, next)) setNotice("Não consegui gravar neste aparelho.");
    },
    [bucket],
  );

  const flush = useCallback(async () => {
    if (!user || inflight.current) return;
    if (!onlineRef.current) {
      setOnline(false);
      setPhase("offline");
      return;
    }
    setOnline(true);
    const pending = ledgerRef.current.ops.filter((op) => !op.permanent);
    if (pending.length === 0 && ledgerRef.current.pulled && !pullSoon.current) {
      setPhase("synced");
      return;
    }
    pullSoon.current = false;
    inflight.current = true;
    setPhase("syncing");
    const sent = pending.slice(0, 40);
    let again = false;
    try {
      let cursor: string | null = null;
      let ops = sent;
      const snapshot: Snapshot = { customers: [], products: [], sales: [], installments: [] };
      let acked: string[] = [];
      let failed: { id: string; error: string; permanent: boolean }[] = [];
      for (let page = 0; page < 80; page += 1) {
        const result: {
          acked: string[];
          failed: { id: string; error: string; permanent: boolean }[];
          snapshot: Snapshot;
          nextCursor: string | null;
        } = await syncLedger({ data: { ops, cursor } });
        if (ops.length) {
          acked = result.acked;
          failed = result.failed;
        }
        snapshot.customers.push(...result.snapshot.customers);
        snapshot.products.push(...result.snapshot.products);
        snapshot.sales.push(...result.snapshot.sales);
        snapshot.installments.push(...result.snapshot.installments);
        if (!result.nextCursor) break;
        cursor = result.nextCursor;
        ops = [];
      }
      lastPull.current = Date.now();
      const merged = mergeAfterSync(ledgerRef.current, sent, { acked, failed }, snapshot);
      ledgerRef.current = merged;
      setLedger(merged);
      if (!saveLedger(user.id, merged)) setNotice("Não consegui gravar neste aparelho.");
      const sentIds = new Set(sent.map((op) => op.id));
      const transient = failed.filter((item) => !item.permanent);
      const blocked = failed.find((item) => item.permanent);
      const waiting = merged.ops.some((op) => !op.permanent);
      if (blocked) setNotice(blocked.error);
      else if (transient[0]) setNotice(transient[0].error);
      else if (!waiting) setNotice("");
      if (transient.length) {
        setPhase("error");
        pullSoon.current = true;
      } else if (waiting) {
        pullSoon.current = true;
        again = waiting && merged.ops.some((op) => !op.permanent && !sentIds.has(op.id));
        setPhase(again ? "syncing" : "error");
        if (!again) pullSoon.current = true;
      } else {
        setPhase("synced");
      }
    } catch {
      const offlineNow = !onlineRef.current;
      setPhase(offlineNow ? "offline" : "error");
      pullSoon.current = true;
      if (offlineNow) setNotice("Salvo neste aparelho. Envia quando a internet voltar.");
    } finally {
      inflight.current = false;
    }
    if (again) void flush();
  }, [user]);

  useEffect(() => {
    let id: string;
    if (user?.id) {
      seenUser.current = user.id;
      writeLastUser(user.id);
      adoptAnonInto(user.id);
      id = user.id;
    } else if (seenUser.current && onlineRef.current) {
      writeLastUser(null);
      seenUser.current = null;
      id = "anon";
    } else {
      id = readLastUser() ?? "anon";
    }
    setBucket(id);
    lastPull.current = 0;
    const next = loadLedger(id);
    ledgerRef.current = next;
    setLedger(next);
    setReady(true);
    pullSoon.current = true;
  }, [user?.id]);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    if (!("serviceWorker" in navigator)) return;
    const host = window.location.hostname;
    if (host.endsWith("grok.genai.mil") || host.endsWith("grok.mil") || host.endsWith("grokgsac.com")) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    if (!ready) return;
    onlineRef.current = navigator.onLine;
    const wake = () => {
      onlineRef.current = navigator.onLine;
      setOnline(navigator.onLine);
      if (!navigator.onLine) {
        setPhase("offline");
        return;
      }
      const stale = !ledgerRef.current.pulled || Date.now() - lastPull.current > 10 * 60 * 1000;
      const waiting = ledgerRef.current.ops.some((op) => !op.permanent);
      if (!stale && !waiting) return;
      pullSoon.current = true;
      void authClient.getSession().catch(() => {});
      void flush();
    };
    const on = () => {
      onlineRef.current = true;
      setOnline(true);
      pullSoon.current = true;
      void authClient.getSession().catch(() => {});
      void flush();
    };
    const off = () => {
      onlineRef.current = false;
      setOnline(false);
      setPhase("offline");
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const onVisible = () => {
      if (document.visibilityState === "visible") wake();
    };
    document.addEventListener("visibilitychange", onVisible);
    setOnline(navigator.onLine);
    if (!navigator.onLine) setPhase("offline");
    void flush();
    const timer = window.setInterval(() => {
      onlineRef.current = navigator.onLine;
      setOnline(navigator.onLine);
      if (!navigator.onLine) {
        setPhase("offline");
        return;
      }
      if (pullSoon.current || ledgerRef.current.ops.some((op) => !op.permanent) || Date.now() - lastPull.current > 10 * 60 * 1000) {
        pullSoon.current = true;
        void authClient.getSession().catch(() => {});
        void flush();
      }
    }, 12000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [flush, ready]);

  function push(op: SyncOp) {
    onlineRef.current = typeof navigator === "undefined" ? onlineRef.current : navigator.onLine;
    const next = commit(ledgerRef.current, op);
    persist(next);
    setNotice(!onlineRef.current ? "Salvo neste aparelho. Envia quando a internet voltar." : user ? "Salvo. Enviando para a sua conta." : "Salvo neste aparelho. Entre na conta para enviar.");
    pullSoon.current = true;
    void flush();
  }

  const pendingCount = ledger.ops.filter((op) => !op.permanent).length;
  const today = todaySP();

  return (
    <div className="min-h-screen bg-desk text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-bg sm:my-6 sm:min-h-[calc(100vh-3rem)] sm:overflow-hidden sm:rounded-[2rem] sm:border sm:border-line sm:shadow-xl">
        <div className="flex-1 overflow-y-auto px-5 pt-5 pb-28">
          {!ready ? (
            <p className="pt-16 text-center text-muted">Carregando sua carteira…</p>
          ) : (
            <>
              <StatusBar
                online={online}
                phase={phase}
                pending={pendingCount}
                signedIn={Boolean(user)}
                notice={notice}
                onSync={() => {
                  pullSoon.current = true;
                  void flush();
                }}
              />
              {view.name === "home" && <HomeView ledger={ledger} today={today} onGo={setView} onPay={push} />}
              {view.name === "customers" && <CustomersView ledger={ledger} onGo={setView} />}
              {view.name === "new-customer" && <NewCustomer onBack={() => setView({ name: "customers" })} onSave={push} />}
              {view.name === "edit-customer" && (
                <EditCustomer ledger={ledger} id={view.id} onBack={() => setView({ name: "customer", id: view.id })} onSave={push} />
              )}
              {view.name === "customer" && (
                <CustomerView ledger={ledger} id={view.id} today={today} onGo={setView} onPay={push} />
              )}
              {view.name === "products" && <ProductsView ledger={ledger} onGo={setView} onDelete={push} />}
              {view.name === "new-product" && <NewProduct onBack={() => setView({ name: "products" })} onSave={push} />}
              {view.name === "edit-product" && (
                <EditProduct ledger={ledger} id={view.id} onBack={() => setView({ name: "products" })} onSave={push} />
              )}
              {view.name === "sale" && (
                <SaleView ledger={ledger} customerId={view.customerId} today={today} onBack={() => setView({ name: "home" })} onSave={push} onDone={(id) => setView({ name: "customer", id })} />
              )}
              {view.name === "charges" && <ChargesView ledger={ledger} today={today} onGo={setView} onPay={push} />}
              {view.name === "account" && <AccountView phase={phase} pending={pendingCount} online={online} />}
            </>
          )}
        </div>
        <nav className="grid grid-cols-5 border-t border-line bg-bg/95 px-1 pt-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] backdrop-blur">
          <NavButton active={navOf(view) === "home"} label="Início" onClick={() => setView({ name: "home" })} icon={<Home size={18} />} />
          <NavButton active={navOf(view) === "customers"} label="Clientes" onClick={() => setView({ name: "customers" })} icon={<Users size={18} />} />
          <NavButton active={navOf(view) === "products"} label="Produtos" onClick={() => setView({ name: "products" })} icon={<Package size={18} />} />
          <NavButton active={navOf(view) === "charges"} label="Cobrar" onClick={() => setView({ name: "charges" })} icon={<MessageCircle size={18} />} />
          <NavButton active={navOf(view) === "account"} label="Conta" onClick={() => setView({ name: "account" })} icon={<CircleUser size={18} />} />
        </nav>
      </div>
    </div>
  );
}

function StatusBar({
  online,
  phase,
  pending,
  signedIn,
  notice,
  onSync,
}: {
  online: boolean;
  phase: Phase;
  pending: number;
  signedIn: boolean;
  notice: string;
  onSync: () => void;
}) {
  const label = !online
    ? pending > 0
      ? `Sem internet. ${pending} alteração(ões) salvas neste aparelho.`
      : "Sem internet. Tudo fica neste aparelho."
    : !signedIn
      ? pending > 0
        ? `${pending} alteração(ões) neste aparelho. Entre na conta para enviar.`
        : "Entre na conta para enviar ao banco."
      : phase === "syncing"
        ? "Enviando dados…"
        : phase === "error"
          ? "Não consegui enviar. Tenta de novo."
          : pending > 0
            ? `${pending} alteração(ões) na fila.`
            : "Tudo enviado para a sua conta.";
  return (
    <div className="mb-4 rounded-2xl border border-line bg-soft px-3 py-2">
      <div className="flex items-center gap-2">
        {online ? <Wifi size={16} className="text-primary" /> : <WifiOff size={16} className="text-danger" />}
        <p className="flex-1 text-sm leading-snug">{label}</p>
        <button type="button" onClick={onSync} className="grid h-11 w-11 place-items-center rounded-xl text-primary" aria-label="Enviar agora">
          <RefreshCw size={18} className={phase === "syncing" ? "animate-spin" : ""} />
        </button>
      </div>
      {notice ? <p className="mt-1 text-xs text-muted">{notice}</p> : null}
    </div>
  );
}

function NavButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex min-h-12 flex-col items-center justify-center gap-0.5 text-[0.68rem] font-semibold ${active ? "text-primary" : "text-muted"}`}>
      {icon}
      {label}
    </button>
  );
}

function HomeView({ ledger, today, onGo, onPay }: { ledger: Ledger; today: string; onGo: (view: View) => void; onPay: (op: SyncOp) => void }) {
  const open = ledger.installments.filter((row) => row.status !== "PAGO");
  const due = open.filter((row) => row.dueDate === today).reduce((sum, row) => sum + row.valueCents, 0);
  const late = open.filter((row) => row.dueDate < today).reduce((sum, row) => sum + row.valueCents, 0);
  const receive = open.reduce((sum, row) => sum + row.valueCents, 0);
  const sold = ledger.sales.reduce((sum, row) => sum + row.totalCents, 0);
  const received =
    ledger.sales.reduce((sum, row) => sum + row.downCents, 0) +
    ledger.installments.filter((row) => row.status === "PAGO").reduce((sum, row) => sum + row.valueCents, 0);
  const next = open
    .slice()
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 4);
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">CobraJá</p>
          <h1 className="text-3xl font-bold text-primary">Olá</h1>
        </div>
        <button type="button" onClick={() => onGo({ name: "sale" })} className="inline-flex h-11 items-center gap-1 rounded-xl bg-primary px-3 font-semibold text-primary-fg">
          <Plus size={16} /> Venda
        </button>
      </div>
      <article className="rounded-2xl bg-primary p-4 text-primary-fg">
        <p className="text-sm opacity-90">Total a receber</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">{formatBRL(receive)}</p>
        <p className="mt-2 text-sm opacity-90">Vendido {formatBRL(sold)} · Recebido {formatBRL(received)}</p>
      </article>
      <div className="grid grid-cols-2 gap-3">
        <article className="rounded-2xl bg-soft p-3">
          <p className="text-xs text-primary">Vence hoje</p>
          <p className="text-lg font-semibold tabular-nums">{formatBRL(due)}</p>
        </article>
        <article className="rounded-2xl bg-soft p-3">
          <p className="text-xs text-danger">Atrasado</p>
          <p className="text-lg font-semibold tabular-nums text-danger">{formatBRL(late)}</p>
        </article>
      </div>
      <button type="button" onClick={() => onGo({ name: "customers" })} className="flex h-14 w-full items-center justify-between rounded-2xl border border-line px-4">
        <span>Clientes</span><strong>{activeCustomers(ledger).length}</strong>
      </button>
      <button type="button" onClick={() => onGo({ name: "products" })} className="flex h-14 w-full items-center justify-between rounded-2xl border border-line px-4">
        <span>Produtos</span><strong>{activeProducts(ledger).length}</strong>
      </button>
      {activeCustomers(ledger).length === 0 ? (
        <div className="rounded-2xl border border-line p-4 text-center">
          <p className="text-muted">Nenhum cliente ainda.</p>
          <button type="button" onClick={() => onGo({ name: "new-customer" })} className="mt-3 h-11 rounded-xl bg-primary px-4 font-semibold text-primary-fg">Novo cliente</button>
        </div>
      ) : null}
      {next.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Próximos vencimentos</h2>
            <button type="button" className="text-sm font-semibold text-primary" onClick={() => onGo({ name: "charges" })}>Ver todos</button>
          </div>
          {next.map((row) => {
            const sale = ledger.sales.find((item) => item.id === row.saleId);
            if (!sale) return null;
            return <ChargeCard key={row.id} ledger={ledger} installmentId={row.id} today={today} onOpen={() => onGo({ name: "customer", id: sale.customerId })} onPay={onPay} />;
          })}
        </section>
      ) : null}
    </div>
  );
}

function CustomersView({ ledger, onGo }: { ledger: Ledger; onGo: (view: View) => void }) {
  const [q, setQ] = useState("");
  const list = activeCustomers(ledger).filter((row) => row.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold text-primary">Clientes</h1>
      <button type="button" onClick={() => onGo({ name: "new-customer" })} className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-fg">+ Novo cliente</button>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome" className="h-11 w-full rounded-xl border border-line bg-bg px-3" />
      {list.length === 0 ? <p className="py-6 text-center text-muted">Nenhum cliente encontrado.</p> : null}
      {list.map((row) => (
        <button key={row.id} type="button" onClick={() => onGo({ name: "customer", id: row.id })} className="flex w-full items-center justify-between rounded-2xl border border-line px-4 py-3 text-left">
          <span>
            <strong className="block">{row.name}</strong>
            <span className="text-xs text-muted">{formatPhoneBR(row.whatsapp)}</span>
          </span>
          <span className="text-right">
            <span className="block text-xs text-muted">Saldo</span>
            <strong className="tabular-nums">{formatBRL(balanceOf(ledger, row.id))}</strong>
          </span>
        </button>
      ))}
    </div>
  );
}

function NewCustomer({ existing, onBack, onSave }: { existing?: Customer; onBack: () => void; onSave: (op: SyncOp) => void }) {
  const [name, setName] = useState(existing?.name ?? "");
  const [phone, setPhone] = useState(existing?.whatsapp ?? "");
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const nextName = String(data.get("nome") || name);
        const nextPhone = String(data.get("whatsapp") || phone);
        const whatsapp = normalizeWhatsApp(nextPhone);
        if (!nextName.trim()) return setError("Informe o nome.");
        if (!whatsapp) return setError("WhatsApp inválido. Use só números com DDD. Ex.: 55999999999");
        const at = nowIso();
        const customer: Customer = {
          id: existing?.id ?? uid(),
          name: nextName.trim(),
          whatsapp,
          createdAt: existing?.createdAt ?? at,
          updatedAt: at,
          deletedAt: null,
        };
        onSave({ id: uid(), at, permanent: false, kind: "customer.upsert", customer });
        onBack();
      }}
    >
      <Back title={existing ? "Editar cliente" : "Novo cliente"} onBack={onBack} />
      <label className="block text-sm font-medium">Nome
        <input name="nome" required value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-line px-3" placeholder="João Silva" />
      </label>
      <label className="block text-sm font-medium">WhatsApp
        <input name="whatsapp" required inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))} className="mt-1 h-11 w-full rounded-xl border border-line px-3" placeholder="55999999999" />
        <span className="mt-1 block text-xs text-muted">Somente números, com DDD.</span>
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button type="submit" className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-fg">{existing ? "Salvar alterações" : "Salvar"}</button>
    </form>
  );
}

function EditCustomer({ ledger, id, onBack, onSave }: { ledger: Ledger; id: string; onBack: () => void; onSave: (op: SyncOp) => void }) {
  const customer = ledger.customers.find((row) => row.id === id && !row.deletedAt);
  if (!customer) return <p>Cliente não encontrado. <button type="button" className="text-primary" onClick={onBack}>Voltar</button></p>;
  return <NewCustomer key={customer.id} existing={customer} onBack={onBack} onSave={onSave} />;
}

function CustomerView({
  ledger,
  id,
  today,
  onGo,
  onPay,
}: {
  ledger: Ledger;
  id: string;
  today: string;
  onGo: (view: View) => void;
  onPay: (op: SyncOp) => void;
}) {
  const customer = ledger.customers.find((row) => row.id === id && !row.deletedAt);
  if (!customer) return <p>Cliente não encontrado. <button type="button" className="text-primary" onClick={() => onGo({ name: "customers" })}>Voltar</button></p>;
  const sales = ledger.sales.filter((row) => row.customerId === id);
  return (
    <div className="space-y-3">
      <Back title={customer.name} onBack={() => onGo({ name: "customers" })} />
      <article className="rounded-2xl border border-line p-4">
        <p className="text-xs text-muted">WhatsApp</p>
        <p>{formatPhoneBR(customer.whatsapp)}</p>
        <p className="mt-3 text-xs text-muted">Saldo a receber</p>
        <p className="text-3xl font-bold tabular-nums text-primary">{formatBRL(balanceOf(ledger, id))}</p>
      </article>
      <button type="button" onClick={() => onGo({ name: "edit-customer", id })} className="h-11 w-full rounded-xl border border-line font-semibold">Editar cliente</button>
      <button type="button" onClick={() => onGo({ name: "sale", customerId: id })} className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-fg">Nova venda</button>
      {sales.length === 0 ? <p className="py-4 text-center text-muted">Nenhuma venda ainda.</p> : null}
      {sales.map((sale) => {
        const parts = ledger.installments.filter((row) => row.saleId === sale.id);
        return (
          <article key={sale.id} className="rounded-2xl border border-line p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <strong>{sale.productName}</strong>
                <p className="text-xs text-muted">{formatDateBR(sale.saleDate)}</p>
              </div>
              <strong className="tabular-nums">{formatBRL(sale.totalCents)}</strong>
            </div>
            {parts.length === 0 ? <p className="mt-2 text-sm text-primary">Pago à vista.</p> : (
              <ul className="mt-3 space-y-2">
                {parts.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>Parcela {row.number} · {formatDateBR(row.dueDate)} <Badge status={displayStatus(row.status, row.dueDate, today)} /></span>
                    <span className="tabular-nums">{formatBRL(row.valueCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        );
      })}
      <PayActions ledger={ledger} customerId={id} today={today} onPay={onPay} />
    </div>
  );
}

function ProductsView({ ledger, onGo, onDelete }: { ledger: Ledger; onGo: (view: View) => void; onDelete: (op: SyncOp) => void }) {
  const list = activeProducts(ledger);
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold text-primary">Produtos</h1>
      <button type="button" onClick={() => onGo({ name: "new-product" })} className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-fg">+ Novo produto</button>
      {list.length === 0 ? <p className="py-6 text-center text-muted">Nenhum produto cadastrado.</p> : null}
      {list.map((row) => (
        <article key={row.id} className="flex items-center justify-between rounded-2xl border border-line px-4 py-3">
          <div>
            <strong>{row.name}</strong>
            <p className="text-sm tabular-nums text-muted">{formatBRL(row.priceCents)}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="h-11 rounded-xl border border-line px-3 text-sm font-semibold" onClick={() => onGo({ name: "edit-product", id: row.id })}>Editar</button>
            <button
              type="button"
              className="inline-flex h-11 items-center gap-1 rounded-xl border border-line px-3 text-sm font-semibold"
              onClick={() => {
                if (!confirm("Eliminar este produto?")) return;
                onDelete({ id: uid(), at: nowIso(), permanent: false, kind: "product.delete", productId: row.id });
              }}
            >
              <Trash2 size={16} /> Eliminar
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function moneyInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function NewProduct({ existing, onBack, onSave }: { existing?: Product; onBack: () => void; onSave: (op: SyncOp) => void }) {
  const [name, setName] = useState(existing?.name ?? "");
  const [price, setPrice] = useState(existing ? moneyInput(existing.priceCents) : "");
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const nextName = String(data.get("nome") || name);
        const nextPrice = String(data.get("preco") || price);
        const priceCents = parseMoneyToCents(nextPrice);
        if (!nextName.trim()) return setError("Informe o nome do produto.");
        if (priceCents === null || priceCents <= 0) return setError("Informe um preço válido. Só números. Ex.: 49,90");
        const at = nowIso();
        onSave({
          id: uid(),
          at,
          permanent: false,
          kind: "product.upsert",
          product: {
            id: existing?.id ?? uid(),
            name: nextName.trim(),
            priceCents,
            createdAt: existing?.createdAt ?? at,
            updatedAt: at,
            deletedAt: null,
          },
        });
        onBack();
      }}
    >
      <Back title={existing ? "Editar produto" : "Novo produto"} onBack={onBack} />
      <label className="block text-sm font-medium">Nome
        <input name="nome" required value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-line px-3" placeholder="Camiseta" />
      </label>
      <label className="block text-sm font-medium">Preço
        <input name="preco" required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ""))} className="mt-1 h-11 w-full rounded-xl border border-line px-3" placeholder="49,90" />
        <span className="mt-1 block text-xs text-muted">Somente números. Use vírgula para centavos.</span>
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button type="submit" className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-fg">{existing ? "Salvar alterações" : "Salvar produto"}</button>
    </form>
  );
}

function EditProduct({ ledger, id, onBack, onSave }: { ledger: Ledger; id: string; onBack: () => void; onSave: (op: SyncOp) => void }) {
  const product = ledger.products.find((row) => row.id === id && !row.deletedAt);
  if (!product) return <p>Produto não encontrado. <button type="button" className="text-primary" onClick={onBack}>Voltar</button></p>;
  return <NewProduct key={product.id} existing={product} onBack={onBack} onSave={onSave} />;
}

function SaleView({
  ledger,
  customerId,
  today,
  onBack,
  onSave,
  onDone,
}: {
  ledger: Ledger;
  customerId?: string;
  today: string;
  onBack: () => void;
  onSave: (op: SyncOp) => void;
  onDone: (customerId: string) => void;
}) {
  const customers = activeCustomers(ledger);
  const products = activeProducts(ledger);
  const [clientId, setClientId] = useState(customerId || customers[0]?.id || "");
  const [productName, setProductName] = useState("");
  const [mode, setMode] = useState<"parcelado" | "avista">("parcelado");
  const [total, setTotal] = useState("");
  const [down, setDown] = useState("");
  const [count, setCount] = useState("3");
  const [first, setFirst] = useState(addMonths(today, 1));
  const [error, setError] = useState("");
  const totalCents = parseMoneyToCents(total);
  const downCents = mode === "avista" ? totalCents : parseMoneyToCents(down || "0") ?? 0;
  const parts = mode === "avista" ? 0 : Math.max(1, Math.min(24, Number(count) || 1));
  const financed = totalCents !== null && downCents !== null ? Math.max(0, totalCents - downCents) : 0;
  const preview = financed > 0 && parts > 0 ? splitCents(financed, parts) : [];

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const pickedClient = String(data.get("cliente") || clientId);
        const pickedProduct = String(data.get("produto") || productName);
        const pickedTotal = parseMoneyToCents(String(data.get("valor") || total));
        const pickedDown = mode === "avista" ? pickedTotal : parseMoneyToCents(String(data.get("entrada") || down || "0")) ?? 0;
        const pickedCount = mode === "avista" ? 0 : Math.max(1, Math.min(24, Number(String(data.get("parcelas") || count)) || 1));
        const pickedFirst = String(data.get("primeiro") || first || addMonths(today, 1));
        const customer = customers.find((row) => row.id === pickedClient);
        if (!customer || !pickedProduct.trim() || pickedTotal === null || pickedTotal <= 0 || pickedDown === null) {
          setError("Preencha cliente, produto e um valor válido (somente números).");
          return;
        }
        if (pickedDown > pickedTotal) return setError("A entrada não pode ser maior que o valor.");
        const at = nowIso();
        const saleId = uid();
        const financedNow = Math.max(0, pickedTotal - pickedDown);
        const rows = financedNow > 0 && pickedCount > 0 ? splitCents(financedNow, pickedCount) : [];
        const sale = {
          id: saleId,
          customerId: customer.id,
          customerName: customer.name,
          productName: pickedProduct.trim(),
          totalCents: pickedTotal,
          downCents: pickedDown,
          saleDate: today,
          createdAt: at,
        };
        const installments = rows.map((valueCents, index) => ({
          id: uid(),
          saleId,
          number: index + 1,
          valueCents,
          dueDate: addMonths(pickedFirst, index),
          status: "PENDENTE" as const,
          paidAt: null,
        }));
        onSave({ id: uid(), at, permanent: false, kind: "sale.create", sale, installments });
        onDone(customer.id);
      }}
    >
      <Back title="Nova venda" onBack={onBack} />
      {customers.length === 0 ? <p className="text-sm text-muted">Cadastre um cliente antes de vender.</p> : null}
      <label className="block text-sm font-medium">Cliente
        <select name="cliente" value={clientId} onChange={(e) => setClientId(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-line bg-bg px-3">
          <option value="">Selecione</option>
          {customers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium">Produto
        {products.length > 0 ? (
          <select
            className="mt-1 h-11 w-full rounded-xl border border-line bg-bg px-3"
            defaultValue=""
            onChange={(e) => {
              const product = products.find((row) => row.id === e.target.value);
              if (!product) return;
              setProductName(product.name);
              setTotal((product.priceCents / 100).toFixed(2).replace(".", ","));
            }}
          >
            <option value="">Escolher produto cadastrado</option>
            {products.map((row) => <option key={row.id} value={row.id}>{row.name} — {formatBRL(row.priceCents)}</option>)}
          </select>
        ) : null}
        <input name="produto" required value={productName} maxLength={100} onChange={(e) => setProductName(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-line px-3" placeholder="Ou digite o nome" />
      </label>
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-soft p-1">
        <button type="button" onClick={() => setMode("parcelado")} className={`h-11 rounded-xl font-semibold ${mode === "parcelado" ? "bg-primary text-primary-fg" : "text-muted"}`}>Parcelado</button>
        <button type="button" onClick={() => setMode("avista")} className={`h-11 rounded-xl font-semibold ${mode === "avista" ? "bg-primary text-primary-fg" : "text-muted"}`}>À vista</button>
      </div>
      <label className="block text-sm font-medium">Valor total
        <input name="valor" required inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value.replace(/[^\d.,]/g, ""))} className="mt-1 h-11 w-full rounded-xl border border-line px-3" placeholder="0,00" />
        <span className="mt-1 block text-xs text-muted">Somente números</span>
      </label>
      {mode === "parcelado" ? (
        <>
          <label className="block text-sm font-medium">Entrada
            <input name="entrada" inputMode="decimal" value={down} onChange={(e) => setDown(e.target.value.replace(/[^\d.,]/g, ""))} className="mt-1 h-11 w-full rounded-xl border border-line px-3" placeholder="0,00" />
          </label>
          <label className="block text-sm font-medium">Número de parcelas
            <input name="parcelas" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, "").slice(0, 2))} className="mt-1 h-11 w-full rounded-xl border border-line px-3" />
            <span className="mt-1 block text-xs text-muted">De 1 a 24</span>
          </label>
          <label className="block text-sm font-medium">Primeiro vencimento
            <input name="primeiro" type="date" value={first} onChange={(e) => setFirst(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-line px-3" />
          </label>
          {preview.length > 0 ? (
            <ul className="space-y-1 rounded-2xl border border-line p-3 text-sm">
              {preview.map((value, index) => (
                <li key={index} className="flex justify-between">
                  <span>Parcela {index + 1} · {formatDateBR(addMonths(first || today, index))}</span>
                  <span className="tabular-nums">{formatBRL(value)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : totalCents ? (
        <article className="rounded-2xl bg-soft p-3">
          <p className="font-semibold text-primary">Recebe agora</p>
          <p className="text-xl font-bold tabular-nums">{formatBRL(totalCents)}</p>
          <p className="text-xs text-muted">Sem parcelas.</p>
        </article>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button type="submit" className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-fg">{mode === "avista" ? "Registrar à vista" : "Criar venda"}</button>
    </form>
  );
}

function ChargesView({ ledger, today, onGo, onPay }: { ledger: Ledger; today: string; onGo: (view: View) => void; onPay: (op: SyncOp) => void }) {
  const open = ledger.installments.filter((row) => row.status !== "PAGO").slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold text-primary">Cobranças</h1>
      {open.length === 0 ? <p className="py-6 text-center text-muted">Nenhuma parcela em aberto.</p> : null}
      {open.map((row) => {
        const sale = ledger.sales.find((item) => item.id === row.saleId);
        if (!sale) return null;
        return (
          <ChargeCard
            key={row.id}
            ledger={ledger}
            installmentId={row.id}
            today={today}
            onOpen={() => onGo({ name: "customer", id: sale.customerId })}
            onPay={onPay}
          />
        );
      })}
    </div>
  );
}

function ChargeCard({
  ledger,
  installmentId,
  today,
  onOpen,
  onPay,
}: {
  ledger: Ledger;
  installmentId: string;
  today: string;
  onOpen: () => void;
  onPay?: (op: SyncOp) => void;
}) {
  const row = ledger.installments.find((item) => item.id === installmentId);
  const sale = row ? ledger.sales.find((item) => item.id === row.saleId) : undefined;
  const customer = sale ? ledger.customers.find((item) => item.id === sale.customerId) : undefined;
  if (!row || !sale || !customer) return null;
  const status = displayStatus(row.status, row.dueDate, today);
  return (
    <article className="rounded-2xl border border-line p-3">
      <button type="button" onClick={onOpen} className="w-full text-left">
        <strong>{customer.name}</strong>
        <p className="text-xs text-muted">{sale.productName} · parcela {row.number} · {formatDateBR(row.dueDate)}</p>
      </button>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div>
          <p className="font-semibold tabular-nums">{formatBRL(row.valueCents)}</p>
          <Badge status={status} />
        </div>
        {onPay && row.status !== "PAGO" ? (
          <div className="flex gap-2">
            <button
              type="button"
              className="h-11 rounded-xl border border-line px-3 text-sm font-semibold"
              onClick={() => {
                const href = whatsappHref(customer.whatsapp, chargeMessage({
                  name: customer.name,
                  valueCents: row.valueCents,
                  due: row.dueDate,
                  balanceCents: balanceOf(ledger, customer.id),
                  today,
                }));
                window.open(href, "_blank", "noopener");
              }}
            >Cobrar</button>
            <button
              type="button"
              className="h-11 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-fg"
              onClick={() => onPay({ id: uid(), at: nowIso(), permanent: false, kind: "installment.pay", installmentId: row.id, paidAt: today })}
            >Recebi</button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function PayActions({ ledger, customerId, today, onPay }: { ledger: Ledger; customerId: string; today: string; onPay: (op: SyncOp) => void }) {
  const sales = ledger.sales.filter((row) => row.customerId === customerId);
  const next = ledger.installments
    .filter((row) => sales.some((sale) => sale.id === row.saleId) && row.status !== "PAGO")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  if (!next) return null;
  return <ChargeCard ledger={ledger} installmentId={next.id} today={today} onOpen={() => undefined} onPay={onPay} />;
}

function Badge({ status }: { status: "PAGO" | "ATRASADO" | "HOJE" | "PENDENTE" }) {
  const label = { PAGO: "Pago", ATRASADO: "Atrasado", HOJE: "Vence hoje", PENDENTE: "Pendente" }[status];
  const tone = status === "ATRASADO" ? "text-danger" : status === "PAGO" || status === "HOJE" ? "text-primary" : "text-muted";
  return <span className={`rounded-full bg-soft px-2 py-0.5 text-[0.7rem] font-semibold ${tone}`}>{label}</span>;
}

function Back({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onBack} className="grid h-11 w-11 place-items-center rounded-xl border border-line" aria-label="Voltar">
        <ArrowLeft size={18} />
      </button>
      <h1 className="text-2xl font-bold text-primary">{title}</h1>
    </div>
  );
}

function DeleteAccount({ userId, email, onError }: { userId: string; email: string; onError: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 h-11 w-full rounded-xl border border-line font-semibold text-danger">
        Apagar conta e dados
      </button>
    );
  }

  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (confirm.trim().toUpperCase() !== "APAGAR") {
          onError("Digite APAGAR para confirmar.");
          return;
        }
        setBusy(true);
        onError("");
        const result = await authClient.deleteUser({ password: password || undefined, callbackURL: "/" });
        if (result.error) {
          setBusy(false);
          onError(authErrorMessage(result.error, "Não consegui apagar a conta."));
          return;
        }
        saveLedger(userId, emptyLedger());
        writeLastUser(null);
        try {
          await signOut();
        } catch {
          /* a sessão já foi removida com a conta */
        }
      }}
    >
      <p className="text-sm text-muted">Apaga {email || "esta conta"}, os clientes, os produtos e as vendas. Não tem volta. Conta do Google pode deixar a senha em branco.</p>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha da conta, se tiver" autoComplete="current-password" className="h-11 w-full rounded-xl border border-line px-3" />
      <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Digite APAGAR" className="h-11 w-full rounded-xl border border-line px-3" />
      <button disabled={busy} className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-fg disabled:opacity-50">{busy ? "Apagando…" : "Apagar de vez"}</button>
    </form>
  );
}

function AccountView({ phase, pending, online }: { phase: Phase; pending: number; online: boolean }) {
  const { user, isPending } = useCurrentUserState();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"entrar" | "criar">("entrar");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isValidEmail(email)) return setError("Informe um e-mail válido. Ex.: nome@gmail.com");
    if (password.length < 6) return setError("A senha precisa de pelo menos 6 caracteres.");
    setBusy(true);
    setError("");
    setInfo("");
    try {
      if (mode === "criar") {
        const result = await authClient.signUp.email({
          email: email.trim().toLowerCase(),
          password,
          name: name.trim() || email.split("@")[0],
          callbackURL: "/verificar",
        });
        if (result.error) throw new Error(authErrorMessage(result.error, "Não foi possível criar a conta."));
        if (signUpNeedsVerification(result)) {
          setInfo("Enviamos um link para confirmar o e-mail. Abra a caixa de entrada (e o spam) antes de entrar.");
          setMode("entrar");
          return;
        }
      } else {
        const result = await authClient.signIn.email({ email: email.trim().toLowerCase(), password, callbackURL: "/" });
        if (result.error) throw new Error(authErrorMessage(result.error, "E-mail ou senha inválidos."));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao entrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-primary">Conta</h1>
      <article className="rounded-2xl border border-line p-4 text-sm leading-relaxed">
        <p>Os cadastros, vendas e recebimentos ficam neste aparelho mesmo sem internet.</p>
        <p className="mt-2">Quando a conexão volta, o CobraJá envia a fila para o banco da sua conta. Nada se perde no caminho.</p>
        <p className="mt-2 text-muted">{online ? "Internet disponível." : "Sem internet agora."} {user ? `${pending} pendente(s).` : "Sem conta, o envio espera você entrar."} {phase === "syncing" ? "Enviando…" : ""}</p>
      </article>
      {isPending ? <p className="text-muted">Verificando sessão…</p> : null}
      {user ? (
        <article className="rounded-2xl border border-line p-4">
          <p className="text-xs text-muted">Sessão</p>
          <p className="font-semibold">{user.displayName || "Conta"}</p>
          <p className="text-sm text-muted">{user.primaryEmail}</p>
          {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
          <button
            type="button"
            disabled={busy}
            className="mt-3 h-11 w-full rounded-xl border border-line font-semibold"
            onClick={async () => {
              const previous = readLastUser();
              writeLastUser(null);
              setBusy(true);
              setError("");
              try {
                await signOut();
              } catch (err) {
                if (previous) writeLastUser(previous);
                setBusy(false);
                setError(err instanceof Error ? err.message : "Não saí da conta. Tente de novo.");
              }
            }}
          >
            {busy ? "Saindo…" : "Sair"}
          </button>
          {user.isDevFallback ? null : <DeleteAccount userId={user.id} email={user.primaryEmail || ""} onError={setError} />}
          <Link to="/privacidade" className="mt-3 block text-center text-sm font-semibold text-primary">Privacidade</Link>
        </article>
      ) : (
        <form className="space-y-3" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-soft p-1">
            <button type="button" onClick={() => setMode("entrar")} className={`h-11 rounded-xl font-semibold ${mode === "entrar" ? "bg-primary text-primary-fg" : "text-muted"}`}>Entrar</button>
            <button type="button" onClick={() => setMode("criar")} className={`h-11 rounded-xl font-semibold ${mode === "criar" ? "bg-primary text-primary-fg" : "text-muted"}`}>Criar conta</button>
          </div>
          {mode === "criar" ? (
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" maxLength={60} className="h-11 w-full rounded-xl border border-line px-3" />
          ) : null}
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@gmail.com" autoComplete="username" className="h-11 w-full rounded-xl border border-line px-3" />
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha, mínimo 6" autoComplete={mode === "criar" ? "new-password" : "current-password"} className="h-11 w-full rounded-xl border border-line px-3" />
          {mode === "entrar" ? <Link to="/redefinir" className="block text-center text-sm font-semibold text-primary">Esqueci a senha</Link> : null}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {info ? <p className="text-sm text-muted">{info}</p> : null}
          <button type="submit" disabled={busy} className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-fg disabled:opacity-50">{busy ? "Aguarde…" : mode === "criar" ? "Criar conta" : "Entrar"}</button>
          <div className="space-y-2">
            {GROK_PROVIDERS.map((provider) => (
              <button key={provider.providerId} type="button" onClick={() => signIn(provider.providerId, { callbackURL: "/" })} className="h-11 w-full rounded-xl border border-line font-semibold">
                Continuar com {provider.label}
              </button>
            ))}
          </div>
          <Link to="/privacidade" className="block text-center text-sm font-semibold text-primary">Privacidade</Link>
        </form>
      )}
    </div>
  );
}
