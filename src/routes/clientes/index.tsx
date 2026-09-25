import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { MoneyText } from "@/components/money-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { listClientes } from "@/lib/cobranca/server";
import { formatPhoneBR } from "@/lib/cobranca/whatsapp";

export const Route = createFileRoute("/clientes/")({ component: ClientesPage });

function ClientesPage() {
  const list = useQuery({ queryKey: ["clientes"], queryFn: () => listClientes() });
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = list.data ?? [];
    if (!term) return rows;
    return rows.filter(
      (c) =>
        c.nome.toLowerCase().includes(term) ||
        c.whatsapp.includes(term.replace(/\D/g, "")),
    );
  }, [list.data, q]);

  return (
    <AppShell
      title="Clientes"
      action={
        <Button asChild size="icon" aria-label="Novo cliente">
          <Link to="/clientes/novo">
            <Plus />
          </Link>
        </Button>
      }
    >
      {list.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : list.error ? (
        <p className="text-sm text-danger">Não foi possível carregar os clientes.</p>
      ) : (list.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum cliente ainda"
          body="Cadastre nome e WhatsApp. Depois a venda e as parcelas saem daqui."
          action={
            <Button asChild>
              <Link to="/clientes/novo">Novo cliente</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome ou WhatsApp"
              className="pl-10"
            />
          </div>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Nenhum resultado.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {filtered.map((c) => (
                <li key={c.id}>
                  <Link
                    to="/clientes/$id"
                    params={{ id: String(c.id) }}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-fg">{c.nome}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {formatPhoneBR(c.whatsapp)}
                        {!c.consentimentoWhatsapp && c.saldoDevedor > 0 ? " · sem autorização" : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      {c.atrasado > 0 ? (
                        <p className="text-[11px] font-medium text-danger">Atrasado</p>
                      ) : c.saldoDevedor > 0 ? (
                        <p className="text-[11px] text-muted">A receber</p>
                      ) : (
                        <p className="text-[11px] text-success">Em dia</p>
                      )}
                      <MoneyText value={c.saldoDevedor} size="sm" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </AppShell>
  );
}
