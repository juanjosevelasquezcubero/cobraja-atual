import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CobrancaRow } from "@/components/cobranca-row";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { listCobrancas } from "@/lib/cobranca/server";
import { useRegistrarPagamento } from "@/lib/cobranca/use-pagamento";
import type { CobrancaFiltro } from "@/lib/cobranca/types";

export const Route = createFileRoute("/cobrancas/")({ component: CobrancasPage });

const FILTROS: { id: CobrancaFiltro; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "hoje", label: "Hoje" },
  { id: "atrasadas", label: "Atrasadas" },
  { id: "proximas", label: "Próximas" },
];

function CobrancasPage() {
  const [filtro, setFiltro] = useState<CobrancaFiltro>("todas");
  const list = useQuery({
    queryKey: ["cobrancas", filtro],
    queryFn: () => listCobrancas({ data: { filtro } }),
  });
  const pagar = useRegistrarPagamento();

  return (
    <AppShell title="Cobranças">
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            className={cn(
              "h-9 shrink-0 rounded-full px-3.5 text-sm font-medium",
              filtro === f.id
                ? "bg-primary text-primary-fg"
                : "bg-surface-2 text-muted",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      ) : list.error ? (
        <p className="text-sm text-danger">Não foi possível carregar as cobranças.</p>
      ) : (list.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nada nesta lista"
          body="Quando houver parcelas pendentes, elas aparecem aqui para cobrar no WhatsApp."
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {list.data!.map((item) => (
            <CobrancaRow
              key={item.parcelaId}
              item={item}
              paying={pagar.isPending && pagar.variables === item.parcelaId}
              onPagar={(id) => pagar.mutate(id)}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
