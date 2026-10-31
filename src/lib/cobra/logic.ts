export type Customer = {
  id: string;
  name: string;
  whatsapp: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type Product = {
  id: string;
  name: string;
  priceCents: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type Sale = {
  id: string;
  customerId: string;
  customerName: string;
  productName: string;
  totalCents: number;
  downCents: number;
  saleDate: string;
  createdAt: string;
};

export type Installment = {
  id: string;
  saleId: string;
  number: number;
  valueCents: number;
  dueDate: string;
  status: "PENDENTE" | "PAGO";
  paidAt: string | null;
};

export type SyncOp = {
  id: string;
  at: string;
  permanent: boolean;
  error?: string;
} & (
  | { kind: "customer.upsert"; customer: Customer }
  | { kind: "customer.delete"; customerId: string }
  | { kind: "product.upsert"; product: Product }
  | { kind: "product.delete"; productId: string }
  | { kind: "sale.create"; sale: Sale; installments: Installment[] }
  | { kind: "installment.pay"; installmentId: string; paidAt: string }
);

export type Snapshot = {
  customers: Customer[];
  products: Product[];
  sales: Sale[];
  installments: Installment[];
};

export type Ledger = Snapshot & {
  ops: SyncOp[];
  pulled: boolean;
};

export type SyncFailure = { id: string; error: string; permanent: boolean };

export function emptyLedger(): Ledger {
  return { customers: [], products: [], sales: [], installments: [], ops: [], pulled: false };
}

export function uid(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todaySP(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
}

export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, last);
  const out = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), day));
  return out.toISOString().slice(0, 10);
}

export function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents || 0) / 100);
}

export function parseMoneyToCents(raw: string): number | null {
  const text = raw.trim().replace(/\s/g, "");
  if (!text || !/^[\d.,]+$/.test(text)) return null;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
}

export function normalizeWhatsApp(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  const n = digits.startsWith("55") ? digits.slice(0, 13) : `55${digits}`.slice(0, 13);
  if (n.length !== 12 && n.length !== 13) return null;
  return n;
}

export function formatPhoneBR(value: string): string {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (local.length <= 2) return local ? `(${local}` : "";
  if (local.length <= 6) return `(${local.slice(0, 2)}) ${local.slice(2)}`;
  if (local.length <= 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7, 11)}`;
}

export function splitCents(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const rest = total - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < rest ? 1 : 0));
}

export function displayStatus(stored: Installment["status"], due: string, today: string): "PAGO" | "ATRASADO" | "HOJE" | "PENDENTE" {
  if (stored === "PAGO") return "PAGO";
  if (due < today) return "ATRASADO";
  if (due === today) return "HOJE";
  return "PENDENTE";
}

export function whatsappHref(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function chargeMessage(input: {
  name: string;
  valueCents: number;
  due: string;
  balanceCents: number;
  today: string;
}): string {
  const first = (input.name || "olá").trim().split(/\s+/)[0];
  const when =
    input.due === input.today ? "vence hoje" : input.due < input.today ? `venceu em ${formatDateBR(input.due)}` : `vence em ${formatDateBR(input.due)}`;
  return `Olá, ${first}!\n\nPassando para lembrar que sua parcela de ${formatBRL(input.valueCents)} ${when}.\n\nSeu saldo devedor é ${formatBRL(input.balanceCents)}.\n\nObrigado!`;
}

function upsertById<T extends { id: string }>(list: T[], row: T): T[] {
  const index = list.findIndex((item) => item.id === row.id);
  if (index === -1) return [...list, row];
  const next = list.slice();
  next[index] = row;
  return next;
}

export function reduceOp(ledger: Ledger, op: SyncOp): Ledger {
  switch (op.kind) {
    case "customer.upsert":
      return { ...ledger, customers: upsertById(ledger.customers, op.customer) };
    case "customer.delete":
      return {
        ...ledger,
        customers: ledger.customers.map((row) =>
          row.id === op.customerId ? { ...row, deletedAt: row.deletedAt ?? op.at, updatedAt: op.at } : row,
        ),
      };
    case "product.upsert":
      return { ...ledger, products: upsertById(ledger.products, op.product) };
    case "product.delete":
      return {
        ...ledger,
        products: ledger.products.map((row) =>
          row.id === op.productId ? { ...row, deletedAt: row.deletedAt ?? op.at, updatedAt: op.at } : row,
        ),
      };
    case "sale.create": {
      const sales = ledger.sales.some((row) => row.id === op.sale.id) ? ledger.sales : [...ledger.sales, op.sale];
      const known = new Set(ledger.installments.map((row) => row.id));
      const installments = [...ledger.installments, ...op.installments.filter((row) => !known.has(row.id))];
      return { ...ledger, sales, installments };
    }
    case "installment.pay":
      return {
        ...ledger,
        installments: ledger.installments.map((row) =>
          row.id === op.installmentId && row.status !== "PAGO"
            ? { ...row, status: "PAGO", paidAt: op.paidAt }
            : row,
        ),
      };
    default:
      return ledger;
  }
}

export function commit(ledger: Ledger, op: SyncOp): Ledger {
  const next = reduceOp(ledger, op);
  return { ...next, ops: [...ledger.ops, op] };
}

export function mergeAnonLedger(current: Ledger, anon: Ledger): Ledger {
  const anonHas =
    anon.customers.length + anon.products.length + anon.sales.length + anon.installments.length + anon.ops.length > 0;
  if (!anonHas) return current;
  const currentHas =
    current.pulled ||
    current.customers.length + current.products.length + current.sales.length + current.installments.length + current.ops.length > 0;
  if (!currentHas) {
    return { ...anon, ops: anon.ops.map((op) => ({ ...op, permanent: false, error: undefined })) };
  }
  let next = current;
  const seen = new Set(next.ops.map((op) => op.id));
  for (const op of anon.ops) {
    if (seen.has(op.id)) continue;
    next = commit(next, { ...op, permanent: false, error: undefined });
    seen.add(op.id);
  }
  for (const customer of anon.customers) {
    if (next.customers.some((row) => row.id === customer.id)) continue;
    next = commit(next, {
      id: `adopt-${customer.id}`,
      at: customer.updatedAt,
      permanent: false,
      kind: "customer.upsert",
      customer,
    });
  }
  for (const product of anon.products) {
    if (next.products.some((row) => row.id === product.id)) continue;
    next = commit(next, {
      id: `adopt-${product.id}`,
      at: product.updatedAt,
      permanent: false,
      kind: "product.upsert",
      product,
    });
  }
  for (const sale of anon.sales) {
    if (next.sales.some((row) => row.id === sale.id)) continue;
    next = commit(next, {
      id: `adopt-${sale.id}`,
      at: sale.createdAt,
      permanent: false,
      kind: "sale.create",
      sale,
      installments: anon.installments.filter((row) => row.saleId === sale.id),
    });
  }
  return next;
}

export function ledgerFromSnapshot(snapshot: Snapshot): Ledger {
  return { ...snapshot, ops: [], pulled: true };
}

export function mergeAfterSync(
  local: Ledger,
  sent: SyncOp[],
  result: { acked: string[]; failed: SyncFailure[] },
  snapshot: Snapshot,
): Ledger {
  const sentIds = new Set(sent.map((op) => op.id));
  const acked = new Set(result.acked);
  const failed = new Map(result.failed.map((item) => [item.id, item]));
  const remaining: SyncOp[] = [];
  for (const op of local.ops) {
    if (acked.has(op.id)) continue;
    const fail = failed.get(op.id);
    if (fail) remaining.push({ ...op, permanent: fail.permanent, error: fail.error });
    else remaining.push(op);
  }
  let next = ledgerFromSnapshot(snapshot);
  for (const op of remaining) {
    if (!sentIds.has(op.id) || !op.permanent) next = reduceOp(next, op);
  }
  next.ops = remaining;
  next.pulled = true;
  return next;
}

export function activeCustomers(ledger: Ledger): Customer[] {
  return ledger.customers.filter((row) => !row.deletedAt).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function activeProducts(ledger: Ledger): Product[] {
  return ledger.products.filter((row) => !row.deletedAt).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function balanceOf(ledger: Ledger, customerId: string): number {
  const saleIds = new Set(ledger.sales.filter((sale) => sale.customerId === customerId).map((sale) => sale.id));
  return ledger.installments
    .filter((row) => saleIds.has(row.saleId) && row.status !== "PAGO")
    .reduce((sum, row) => sum + row.valueCents, 0);
}

export function isSyncOp(value: unknown): value is SyncOp {
  if (!value || typeof value !== "object") return false;
  const op = value as SyncOp;
  return typeof op.id === "string" && typeof op.kind === "string" && typeof op.at === "string";
}
