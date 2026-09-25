export function todayInSaoPaulo(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}

export function formatDateBR(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

export function daysLate(vencimento: string | null, today: string): number {
  if (!vencimento || vencimento >= today) return 0;
  const [fy, fm, fd] = vencimento.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  if (!fy || !fm || !fd || !ty || !tm || !td) return 0;
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export function addMonths(isoDate: string, months: number): string {
  const [ys, ms, ds] = isoDate.split("-");
  const year = Number(ys);
  const month = Number(ms);
  const day = Number(ds);
  if (!year || !month || !day) return isoDate;
  const targetMonthIndex = month - 1 + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDay);
  const mm = String(normalizedMonth + 1).padStart(2, "0");
  const dd = String(clampedDay).padStart(2, "0");
  return `${targetYear}-${mm}-${dd}`;
}

export function dateFromDb(value: unknown): string {
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return "";
}
