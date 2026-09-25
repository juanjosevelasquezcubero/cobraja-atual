import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Banknote } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { MoneyText } from "@/components/money-text";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateBR } from "@/lib/cobranca/dates";
import { listVendasAVista } from "@/lib/cobranca/server";
import { formatPhoneBR } from "@/lib/cobranca/whatsapp";

export const Route = createFileRoute("/avista/")({ component: AVistaPage });

function AVistaPage() {
  const list = useQuery({ queryKey: ["avista"], queryFn: () => listVendasAVista() });
  const total = (list.data ?? []).reduce((sum, row) => sum + row.valor, 0);

  return (
    <AppShell title="À vista">
      {list.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : list.error ? (
        <p className="text-sm text-danger">Não foi possível carregar as vendas à vista.</p>
      ) : (list.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Banknote}
          title="Nenhuma venda à vista"
          body="Quando o cliente paga tudo na hora, registre a venda como À vista. Ela aparece aqui, sem parcelas."
          action={
            <Button asChild>
              <Link to="/vendas/nova" search={{ modo: "avista" }}>Nova venda à vista</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl bg-cash p-5 text-cash-fg">
            <p className="text-sm text-cash-fg/80">Recebido na hora</p>
            <MoneyText value={total} size="xl" className="mt-2 block text-cash-fg" />
            <p className="mt-2 text-xs text-cash-fg/80">
              {list.data!.length} {list.data!.length === 1 ? "venda" : "vendas"} sem parcela
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {list.data!.map((venda) => (
              <li key={venda.id}>
                <Link
                  to="/clientes/$id"
                  params={{ id: String(venda.clienteId) }}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-fg">{venda.clienteNome}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {venda.produto} · {formatDateBR(venda.dataVenda)}
                    </p>
                    <p className="text-xs text-muted">{formatPhoneBR(venda.whatsapp)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-medium text-cash">À vista</p>
                    <MoneyText value={venda.valor} size="sm" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AppShell>
  );
}
