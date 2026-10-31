import { emptyLedger, mergeAnonLedger, type Ledger } from "./logic";

const PREFIX = "cobraja.ledger.v1:";
const LAST_USER = "cobraja.lastUser.v1";

export function loadLedger(bucket: string): Ledger {
  if (typeof localStorage === "undefined") return emptyLedger();
  try {
    const raw = localStorage.getItem(PREFIX + bucket);
    if (!raw) return emptyLedger();
    const parsed = JSON.parse(raw) as Ledger;
    if (!parsed || !Array.isArray(parsed.customers) || !Array.isArray(parsed.ops)) return emptyLedger();
    return {
      customers: parsed.customers ?? [],
      products: parsed.products ?? [],
      sales: parsed.sales ?? [],
      installments: parsed.installments ?? [],
      ops: parsed.ops ?? [],
      pulled: Boolean(parsed.pulled),
    };
  } catch {
    return emptyLedger();
  }
}

export function saveLedger(bucket: string, ledger: Ledger): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    localStorage.setItem(PREFIX + bucket, JSON.stringify(ledger));
    return true;
  } catch {
    return false;
  }
}

export function readLastUser(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const id = localStorage.getItem(LAST_USER);
    return id && id !== "anon" ? id : null;
  } catch {
    return null;
  }
}

export function writeLastUser(id: string | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (id && id !== "anon") localStorage.setItem(LAST_USER, id);
    else localStorage.removeItem(LAST_USER);
  } catch {
    /* storage blocked */
  }
}

/** Pull guest edits into the signed-in bucket, even if that bucket already has data. */
export function adoptAnonInto(userId: string): void {
  const anon = loadLedger("anon");
  const current = loadLedger(userId);
  const merged = mergeAnonLedger(current, anon);
  if (merged === current) return;
  saveLedger(userId, merged);
  saveLedger("anon", emptyLedger());
}
