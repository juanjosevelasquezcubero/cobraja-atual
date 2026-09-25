import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Plus, Users } from "lucide-react";
import { AppShell, PhoneFrame } from "@/components/app-shell";
import { CobrancaRow, openWhatsApp } from "@/components/cobranca-row";
import { EmptyState } from "@/components/empty-state";
import { LoginScreen } from "@/components/login-screen";
import { LogoMark } from "@/components/logo";
import { MoneyText } from "@/components/money-text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser, useCurrentUserState } from "@/lib/auth/use-current-user";
import { getDashboard, seedDemo } from "@/lib/cobranca/server";
import { useRegistrarPagamento } from "@/lib/cobranca/use-pagamento";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <PhoneFrame>
        <div className="flex flex-1 flex-col gap-4 px-5 pt-8">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-9" />
            <p className="font-display text-xl font-semibold tracking-tight text-fg">
              CobraJá
            </p>
          </div>
          <p className="text-sm text-muted">Cadastre vendas, calcule parcelas e cobre pelo WhatsApp.</p>
          <Skeleton className="h-36 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        </div>
      </PhoneFrame>
    );
  }
  if (!user) return <LoginScreen />;
  return <Dashboard />;
}

function firstName(display: string | null | undefined, email: string | null | undefined) {
  const fromName = display?.trim().split(/\s+/)[0];
  if (fromName) return fromName;
  const fromEmail = email?.split("@")[0];
  return fromEmail || "vendedor";
}

function Dashboard() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const seed = useMutation({
    mutationFn: () => seedDemo(),
    onSuccess: () => {
      void qc.invalidateQueries();
    },
  });
  const pagar = useRegistrarPagamento();

  const data = dash.data;
  const empty = data && data.clientes === 0;

  return (
    <AppShell>
      <div className="flex items-end justify-between gap-3 pt-3">
        <div>
          <p className="text-sm text-muted">Olá,</p>
          <h1 className="font-display text-[1.85rem] font-semibold leading-tight tracking-tight text-fg">
            {firstName(user?.displayName, user?.primaryEmail)}
          </h1>
        </div>
        <Button asChild size="sm">
          <Link to="/vendas/nova">
            <Plus />
            Nova venda
          </Link>
        </Button>
      </div>

      {dash.isLoading ? (
        <div className="mt-6 flex flex-col gap-3">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        </div>
      ) : dash.error ? (
        <p className="mt-8 text-sm text-danger">Não foi possível carregar o resumo.</p>
      ) : empty ? (
        <EmptyState
          icon={Users}
          title="Comece pelo primeiro cliente"
          body="Cadastre quem compra parcelado. Depois registre a venda e cobre pelo WhatsApp."
          action={
            <div className="flex flex-col gap-2">
              <Button asChild>
                <Link to="/clientes/novo">Novo cliente</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={seed.isPending}
                onClick={() => seed.mutate()}
              >
                {seed.isPending ? "Criando…" : "Preencher exemplo"}
              </Button>
            </div>
          }
        />
      ) : data ? (
        <div className="mt-6 flex flex-col gap-3">
          <Card className="bg-primary p-5 text-primary-fg">
            <p className="text-sm text-primary-fg/80">Total a receber</p>
            <MoneyText value={data.totalAReceber} size="xl" className="mt-2 block text-primary-fg" />
            <div className="mt-4 flex gap-6 text-xs text-primary-fg/80">
              <span>
                Vendido <span className="tabular-nums text-primary-fg">{formatCompact(data.totalVendido)}</span>
              </span>
              <span>
                Recebido <span className="tabular-nums text-primary-fg">{formatCompact(data.totalRecebido)}</span>
              </span>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Vence hoje" value={data.venceHoje} tone="warn" />
            <StatCard label="Atrasado" value={data.atrasado} tone="danger" />
            <StatCard label="Recebido no mês" value={data.recebidoMes} tone="ok" />
            <CountCard label="Inadimplentes" value={data.inadimplentes} />
          </div>

          <Link
            to="/avista"
            className="flex items-center justify-between rounded-2xl bg-cash px-4 py-3.5 text-cash-fg"
          >
            <span className="text-sm">Recebido à vista</span>
            <MoneyText value={data.totalAVista} size="sm" className="text-cash-fg" />
          </Link>

          <Link
            to="/clientes"
            className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3.5"
          >
            <span className="text-sm text-muted">Clientes</span>
            <span className="font-display text-xl font-semibold tabular-nums">{data.clientes}</span>
          </Link>

          {data.devedores.length > 0 ? (
            <section className="mt-2">
              <h2 className="mb-3 text-sm font-medium text-fg">Maiores devedores</h2>
              <div className="flex flex-col gap-2">
                {data.devedores.map((d) => (
                  <div
                    key={d.clienteId}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3"
                  >
                    <Link to="/clientes/$id" params={{ id: String(d.clienteId) }} className="min-w-0">
                      <p className="truncate font-medium text-fg">{d.nome}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {d.diasAtraso > 0
                          ? `Em atraso há ${d.diasAtraso} dia${d.diasAtraso === 1 ? "" : "s"}`
                          : "Com saldo em aberto"}
                        {d.consentimentoWhatsapp ? "" : " · sem autorização"}
                      </p>
                    </Link>
                    <div className="flex flex-col items-end gap-1.5">
                      <MoneyText value={d.saldo} size="sm" className="text-danger" />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          void openWhatsApp({
                            parcelaId: 0,
                            clienteId: d.clienteId,
                            clienteNome: d.nome,
                            whatsapp: d.whatsapp,
                            produto: "sua conta em aberto",
                            numero: 1,
                            valor: d.saldo,
                            dataVencimento: null,
                            status: d.diasAtraso > 0 ? "ATRASADO" : "PENDENTE",
                            saldoDevedor: d.saldo,
                            consentimentoWhatsapp: d.consentimentoWhatsapp,
                          })
                        }
                      >
                        <MessageCircle />
                        Cobrar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {data.proximos.length > 0 ? (
            <section className="mt-4">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-medium text-fg">Próximos vencimentos</h2>
                <Link to="/cobrancas" className="text-xs font-medium text-primary">
                  Ver todos
                </Link>
              </div>
              <div className="flex flex-col gap-2.5">
                {data.proximos.map((item) => (
                  <CobrancaRow
                    key={item.parcelaId}
                    item={item}
                    paying={pagar.isPending && pagar.variables === item.parcelaId}
                    onPagar={(id) => pagar.mutate(id)}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </AppShell>
  );
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "warn" | "danger" | "ok";
}) {
  const toneClass =
    tone === "danger" ? "bg-danger-soft" : tone === "ok" ? "bg-success-soft" : "bg-warn-soft";
  const textClass =
    tone === "danger" ? "text-danger" : tone === "ok" ? "text-success" : "text-warn";
  return (
    <Card className={toneClass}>
      <p className={`text-sm ${textClass}`}>{label}</p>
      <MoneyText value={value} size="lg" className={`mt-2 block ${textClass}`} />
    </Card>
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="bg-surface-2">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-fg">{value}</p>
    </Card>
  );
}
