export function toCents(value: number): number {
  return Math.round(value * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

export function parseMoneyInput(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) return 0;
  const hasComma = trimmed.includes(",");
  const normalized = hasComma
    ? trimmed.replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".")
    : trimmed.replace(/[^\d.-]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function moneyFromDb(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function splitCents(totalCents: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(totalCents / parts);
  const rem = totalCents - base * parts;
  return Array.from({ length: parts }, (_, i) =>
    i === parts - 1 ? base + rem : base,
  );
}
