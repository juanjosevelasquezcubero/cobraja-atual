import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/cobranca/money";

export function MoneyText({
  value,
  className,
  size = "md",
}: {
  value: number;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const sizeClass = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-2xl",
    xl: "text-[2.15rem] leading-none",
  }[size];

  return (
    <span
      className={cn(
        "font-display font-semibold tabular-nums tracking-tight",
        sizeClass,
        className,
      )}
    >
      {formatBRL(value)}
    </span>
  );
}
