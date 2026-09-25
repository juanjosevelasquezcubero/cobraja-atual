import { Badge } from "@/components/ui/badge";
import type { DisplayStatus } from "@/lib/cobranca/installments";

const LABELS: Record<DisplayStatus, string> = {
  PAGO: "Pago",
  PENDENTE: "Pendente",
  ATRASADO: "Atrasado",
  HOJE: "Vence hoje",
};

const VARIANTS: Record<DisplayStatus, "success" | "default" | "danger" | "warn"> = {
  PAGO: "success",
  PENDENTE: "default",
  ATRASADO: "danger",
  HOJE: "warn",
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  return <Badge variant={VARIANTS[status]}>{LABELS[status]}</Badge>;
}
