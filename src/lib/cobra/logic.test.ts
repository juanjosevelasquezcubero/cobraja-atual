import assert from "node:assert/strict";
import test from "node:test";
import { commit, emptyLedger, mergeAfterSync, mergeAnonLedger, type SyncOp } from "./logic.ts";

function customerOp(id: string): SyncOp {
  return {
    id: `op-${id}`,
    at: "2026-10-31T12:00:00.000Z",
    permanent: false,
    kind: "customer.upsert",
    customer: {
      id,
      name: "Maria",
      whatsapp: "5551999999999",
      createdAt: "2026-10-31T12:00:00.000Z",
      updatedAt: "2026-10-31T12:00:00.000Z",
      deletedAt: null,
    },
  };
}

test("guest ledger is copied into an empty account", () => {
  const anon = commit(emptyLedger(), customerOp("c1"));
  const merged = mergeAnonLedger(emptyLedger(), anon);
  assert.equal(merged.customers.length, 1);
  assert.equal(merged.ops.length, 1);
  assert.equal(merged.customers[0]?.name, "Maria");
});

test("guest edits join an account that already has data", () => {
  const account = commit(emptyLedger(), customerOp("old"));
  const anon = commit(emptyLedger(), customerOp("new"));
  const merged = mergeAnonLedger({ ...account, pulled: true, ops: [] }, anon);
  assert.deepEqual(
    merged.customers.map((row) => row.id).sort(),
    ["new", "old"],
  );
  assert.equal(merged.ops.length, 1);
  assert.equal(merged.ops[0]?.kind, "customer.upsert");
});

test("sync keeps edits made while the upload was in flight", () => {
  const sent = customerOp("c1");
  const extra = customerOp("c2");
  const local = commit(commit(emptyLedger(), sent), extra);
  assert.equal(sent.kind, "customer.upsert");
  if (sent.kind !== "customer.upsert") return;
  const snapshot = {
    customers: [sent.customer],
    products: [],
    sales: [],
    installments: [],
  };
  const merged = mergeAfterSync(local, [sent], { acked: [sent.id], failed: [] }, snapshot);
  assert.equal(merged.ops.length, 1);
  assert.equal(merged.ops[0]?.id, extra.id);
  assert.equal(merged.customers.some((row) => row.id === "c2"), true);
  assert.equal(merged.customers.some((row) => row.id === "c1"), true);
});
