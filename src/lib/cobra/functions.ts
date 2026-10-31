import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  isSyncOp,
  normalizeWhatsApp,
  type Customer,
  type Installment,
  type Product,
  type Sale,
  type Snapshot,
  type SyncFailure,
  type SyncOp,
} from "./logic";

type OpResult = { id: string; ok: true } | ({ id: string; ok: false } & SyncFailure);

function text(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function cents(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 100_000_000_00) return null;
  return n;
}

function day(value: unknown): string | null {
  const s = String(value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

const PAGE = 400;
const MAX_CUSTOMERS = 20_000;
const MAX_PRODUCTS = 20_000;
const MAX_SALES = 50_000;
const OPS_KEEP_MS = 14 * 24 * 60 * 60 * 1000;

let lastPrune = 0;

function emptySnapshot(): Snapshot {
  return { customers: [], products: [], sales: [], installments: [] };
}

async function overCap(userId: string, kind: "customer" | "product" | "sale"): Promise<boolean> {
  const sql = await getSql();
  const rows =
    kind === "customer"
      ? await sql<{ n: number }>`select count(*)::int as n from cobra_customers where user_id = ${userId}`
      : kind === "product"
        ? await sql<{ n: number }>`select count(*)::int as n from cobra_products where user_id = ${userId}`
        : await sql<{ n: number }>`select count(*)::int as n from cobra_sales where user_id = ${userId}`;
  const cap = kind === "customer" ? MAX_CUSTOMERS : kind === "product" ? MAX_PRODUCTS : MAX_SALES;
  return Number(rows[0]?.n ?? 0) >= cap;
}

async function pruneOps(): Promise<void> {
  const now = Date.now();
  if (now - lastPrune < 60 * 60 * 1000) return;
  lastPrune = now;
  const cutoff = new Date(now - OPS_KEEP_MS).toISOString();
  try {
    const sql = await getSql();
    await sql`delete from cobra_ops where applied_at < ${cutoff}`;
  } catch {
    lastPrune = 0;
  }
}

type PageKind = "c" | "p" | "s" | "i";

function parseCursor(cursor: string | null): { kind: PageKind; offset: number } {
  const match = /^(c|p|s|i):(\d{1,8})$/.exec(cursor ?? "c:0");
  if (!match) return { kind: "c", offset: 0 };
  return { kind: match[1] as PageKind, offset: Number(match[2]) };
}

function nextKind(kind: PageKind): PageKind | null {
  if (kind === "c") return "p";
  if (kind === "p") return "s";
  if (kind === "s") return "i";
  return null;
}

async function snapshotPage(userId: string, cursor: string | null): Promise<{ snapshot: Snapshot; nextCursor: string | null }> {
  const sql = await getSql();
  const start = parseCursor(cursor);
  let kind: PageKind | null = start.kind;
  let offset = start.offset;
  let room = PAGE;
  const snapshot = emptySnapshot();

  while (kind && room > 0) {
    const take = room + 1;
    if (kind === "c") {
      const rows = await sql<{
        id: string;
        name: string;
        whatsapp: string;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>`select id, name, whatsapp, created_at, updated_at, deleted_at from cobra_customers where user_id = ${userId} order by id limit ${take} offset ${offset}`;
      const slice = rows.slice(0, room);
      snapshot.customers.push(
        ...slice.map(
          (row): Customer => ({
            id: row.id,
            name: row.name,
            whatsapp: row.whatsapp,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            deletedAt: row.deleted_at,
          }),
        ),
      );
      if (rows.length > room) return { snapshot, nextCursor: `c:${offset + room}` };
      room -= slice.length;
    } else if (kind === "p") {
      const rows = await sql<{
        id: string;
        name: string;
        price_cents: number;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>`select id, name, price_cents, created_at, updated_at, deleted_at from cobra_products where user_id = ${userId} order by id limit ${take} offset ${offset}`;
      const slice = rows.slice(0, room);
      snapshot.products.push(
        ...slice.map(
          (row): Product => ({
            id: row.id,
            name: row.name,
            priceCents: Number(row.price_cents),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            deletedAt: row.deleted_at,
          }),
        ),
      );
      if (rows.length > room) return { snapshot, nextCursor: `p:${offset + room}` };
      room -= slice.length;
    } else if (kind === "s") {
      const rows = await sql<{
        id: string;
        customer_id: string;
        customer_name: string;
        product_name: string;
        total_cents: number;
        down_cents: number;
        sale_date: string;
        created_at: string;
      }>`select id, customer_id, customer_name, product_name, total_cents, down_cents, sale_date, created_at from cobra_sales where user_id = ${userId} order by id limit ${take} offset ${offset}`;
      const slice = rows.slice(0, room);
      snapshot.sales.push(
        ...slice.map(
          (row): Sale => ({
            id: row.id,
            customerId: row.customer_id,
            customerName: row.customer_name,
            productName: row.product_name,
            totalCents: Number(row.total_cents),
            downCents: Number(row.down_cents),
            saleDate: String(row.sale_date).slice(0, 10),
            createdAt: row.created_at,
          }),
        ),
      );
      if (rows.length > room) return { snapshot, nextCursor: `s:${offset + room}` };
      room -= slice.length;
    } else {
      const rows = await sql<{
        id: string;
        sale_id: string;
        number: number;
        value_cents: number;
        due_date: string;
        status: string;
        paid_at: string | null;
      }>`select id, sale_id, number, value_cents, due_date, status, paid_at from cobra_installments where user_id = ${userId} order by id limit ${take} offset ${offset}`;
      const slice = rows.slice(0, room);
      snapshot.installments.push(
        ...slice.map(
          (row): Installment => ({
            id: row.id,
            saleId: row.sale_id,
            number: Number(row.number),
            valueCents: Number(row.value_cents),
            dueDate: String(row.due_date).slice(0, 10),
            status: row.status === "PAGO" ? "PAGO" : "PENDENTE",
            paidAt: row.paid_at ? String(row.paid_at).slice(0, 10) : null,
          }),
        ),
      );
      if (rows.length > room) return { snapshot, nextCursor: `i:${offset + room}` };
      room -= slice.length;
    }
    const nxt = nextKind(kind);
    if (!nxt) return { snapshot, nextCursor: null };
    if (room === 0) return { snapshot, nextCursor: `${nxt}:0` };
    kind = nxt;
    offset = 0;
  }
  return { snapshot, nextCursor: null };
}

async function alreadyApplied(userId: string, opId: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ id: string }>`select id from cobra_ops where id = ${opId} and user_id = ${userId}`;
  return rows.length > 0;
}

async function markApplied(userId: string, opId: string, at: string): Promise<void> {
  const sql = await getSql();
  await sql`insert into cobra_ops (id, user_id, applied_at) values (${opId}, ${userId}, ${at})`;
}

async function applyOp(userId: string, op: SyncOp): Promise<OpResult> {
  if (await alreadyApplied(userId, op.id)) return { id: op.id, ok: true };
  const sql = await getSql();
  try {
    if (op.kind === "customer.upsert") {
      const name = text(op.customer?.name, 80);
      const phone = normalizeWhatsApp(String(op.customer?.whatsapp ?? ""));
      const id = text(op.customer?.id, 80);
      if (!id || !name || !phone) return { id: op.id, ok: false, error: "Cliente inválido.", permanent: true };
      const owner = await sql<{ user_id: string }>`select user_id from cobra_customers where id = ${id}`;
      if (owner[0] && owner[0].user_id !== userId) return { id: op.id, ok: false, error: "Cliente de outra conta.", permanent: true };
      if (!owner[0] && (await overCap(userId, "customer"))) {
        return { id: op.id, ok: false, error: "Limite de clientes desta conta atingido.", permanent: true };
      }
      const createdAt = text(op.customer.createdAt, 40) || op.at;
      const updatedAt = text(op.customer.updatedAt, 40) || op.at;
      const deletedAt = op.customer.deletedAt ? text(op.customer.deletedAt, 40) : null;
      await sql`
        insert into cobra_customers (id, user_id, name, whatsapp, created_at, updated_at, deleted_at)
        values (${id}, ${userId}, ${name}, ${phone}, ${createdAt}, ${updatedAt}, ${deletedAt})
        on conflict (id) do update set
          name = excluded.name,
          whatsapp = excluded.whatsapp,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at
      `;
    } else if (op.kind === "customer.delete") {
      const id = text(op.customerId, 80);
      if (!id) return { id: op.id, ok: false, error: "Cliente inválido.", permanent: true };
      await sql`update cobra_customers set deleted_at = ${op.at}, updated_at = ${op.at} where id = ${id} and user_id = ${userId}`;
    } else if (op.kind === "product.upsert") {
      const id = text(op.product?.id, 80);
      const name = text(op.product?.name, 80);
      const price = cents(op.product?.priceCents);
      if (!id || !name || price === null || price <= 0) return { id: op.id, ok: false, error: "Produto inválido.", permanent: true };
      const owner = await sql<{ user_id: string }>`select user_id from cobra_products where id = ${id}`;
      if (owner[0] && owner[0].user_id !== userId) return { id: op.id, ok: false, error: "Produto de outra conta.", permanent: true };
      if (!owner[0] && (await overCap(userId, "product"))) {
        return { id: op.id, ok: false, error: "Limite de produtos desta conta atingido.", permanent: true };
      }
      const createdAt = text(op.product.createdAt, 40) || op.at;
      const updatedAt = text(op.product.updatedAt, 40) || op.at;
      const deletedAt = op.product.deletedAt ? text(op.product.deletedAt, 40) : null;
      await sql`
        insert into cobra_products (id, user_id, name, price_cents, created_at, updated_at, deleted_at)
        values (${id}, ${userId}, ${name}, ${price}, ${createdAt}, ${updatedAt}, ${deletedAt})
        on conflict (id) do update set
          name = excluded.name,
          price_cents = excluded.price_cents,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at
      `;
    } else if (op.kind === "product.delete") {
      const id = text(op.productId, 80);
      if (!id) return { id: op.id, ok: false, error: "Produto inválido.", permanent: true };
      await sql`update cobra_products set deleted_at = ${op.at}, updated_at = ${op.at} where id = ${id} and user_id = ${userId}`;
    } else if (op.kind === "sale.create") {
      const sale = op.sale;
      const id = text(sale?.id, 80);
      const customerId = text(sale?.customerId, 80);
      const productName = text(sale?.productName, 100);
      const total = cents(sale?.totalCents);
      const down = cents(sale?.downCents);
      const saleDate = day(sale?.saleDate);
      if (!id || !customerId || !productName || total === null || total <= 0 || down === null || down > total || !saleDate) {
        return { id: op.id, ok: false, error: "Venda inválida.", permanent: true };
      }
      const customer = await sql<{ id: string }>`select id from cobra_customers where id = ${customerId} and user_id = ${userId} and deleted_at is null`;
      if (!customer[0]) return { id: op.id, ok: false, error: "Cliente não encontrado.", permanent: true };
      const owner = await sql<{ user_id: string }>`select user_id from cobra_sales where id = ${id}`;
      if (owner[0] && owner[0].user_id !== userId) return { id: op.id, ok: false, error: "Venda de outra conta.", permanent: true };
      if (!owner[0] && (await overCap(userId, "sale"))) {
        return { id: op.id, ok: false, error: "Limite de vendas desta conta atingido.", permanent: true };
      }
      const parts = Array.isArray(op.installments) ? op.installments : [];
      if (parts.length > 24) return { id: op.id, ok: false, error: "Máximo de 24 parcelas.", permanent: true };
      const parsed = parts.map((row) => ({
        id: text(row.id, 80),
        value: cents(row.valueCents),
        due: day(row.dueDate),
        number: Number(row.number),
        status: row.status === "PAGO" ? "PAGO" as const : "PENDENTE" as const,
        paidAt: row.paidAt ? day(row.paidAt) : null,
      }));
      if (parsed.some((row) => !row.id || row.value === null || row.value <= 0 || !row.due || !Number.isInteger(row.number))) {
        return { id: op.id, ok: false, error: "Parcela inválida.", permanent: true };
      }
      const sum = parsed.reduce((acc, row) => acc + (row.value ?? 0), 0);
      if (sum !== total - down) return { id: op.id, ok: false, error: "Parcelas não fecham com o valor.", permanent: true };
      await sql`
        insert into cobra_sales (id, user_id, customer_id, customer_name, product_name, total_cents, down_cents, sale_date, created_at)
        values (${id}, ${userId}, ${customerId}, ${text(sale.customerName, 80)}, ${productName}, ${total}, ${down}, ${saleDate}, ${text(sale.createdAt, 40) || op.at})
        on conflict (id) do nothing
      `;
      for (const row of parsed) {
        await sql`
          insert into cobra_installments (id, user_id, sale_id, number, value_cents, due_date, status, paid_at)
          values (${row.id}, ${userId}, ${id}, ${row.number}, ${row.value}, ${row.due}, ${row.status}, ${row.paidAt})
          on conflict (id) do nothing
        `;
      }
    } else if (op.kind === "installment.pay") {
      const id = text(op.installmentId, 80);
      const paidAt = day(op.paidAt);
      if (!id || !paidAt) return { id: op.id, ok: false, error: "Pagamento inválido.", permanent: true };
      const rows = await sql<{ id: string }>`select id from cobra_installments where id = ${id} and user_id = ${userId}`;
      if (!rows[0]) return { id: op.id, ok: false, error: "Parcela não encontrada.", permanent: true };
      await sql`update cobra_installments set status = 'PAGO', paid_at = ${paidAt} where id = ${id} and user_id = ${userId} and status <> 'PAGO'`;
    }
    await markApplied(userId, op.id, op.at);
    return { id: op.id, ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao gravar.";
    return { id: op.id, ok: false, error: message, permanent: false };
  }
}

export const syncLedger = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => {
    const body = raw && typeof raw === "object" ? (raw as { ops?: unknown; cursor?: unknown }) : {};
    const ops = Array.isArray(body.ops) ? body.ops : null;
    if (!ops || ops.length > 40) throw new Error("Fila de envio inválida.");
    if (!ops.every(isSyncOp)) throw new Error("Operação inválida na fila.");
    const cursor = typeof body.cursor === "string" && body.cursor ? body.cursor : null;
    if (cursor && !/^[cpsi]:\d{1,8}$/.test(cursor)) throw new Error("Página inválida.");
    return { ops: ops as SyncOp[], cursor };
  })
  .handler(async ({ context, data }) => {
    if (!data.cursor) await pruneOps();
    const acked: string[] = [];
    const failed: SyncFailure[] = [];
    if (!data.cursor) {
      for (const op of data.ops) {
        if (op.permanent) {
          failed.push({ id: op.id, error: op.error || "Não enviado.", permanent: true });
          continue;
        }
        const result = await applyOp(context.userId, op);
        if (result.ok) acked.push(op.id);
        else failed.push({ id: result.id, error: result.error, permanent: result.permanent });
      }
    }
    const { snapshot, nextCursor } = await snapshotPage(context.userId, data.cursor);
    return { acked, failed, snapshot, nextCursor };
  });
