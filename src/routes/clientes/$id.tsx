import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { openWhatsApp } from "@/components/cobranca-row";
import { ErrorText, Field } from "@/components/field";
import { MoneyText } from "@/components/money-text";
import { PagamentoSheet } from "@/components/pagamento-sheet";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateBR } from "@/lib/cobranca/dates";
import { getCliente, updateCliente } from "@/lib/cobranca/server";
import { formatPhoneBR } from "@/lib/cobranca/whatsapp";
import { useRegistrarPagamento } from "@/lib/cobranca/use-pagamento";
import type { CobrancaItem, Parcela } from "@/lib/cobranca/types";

export const Route = createFileRoute("/clientes/$id")({ component: ClienteDetalhePage });

function ClienteDetalhePage() {
  const { id } = Route.useParams();
  const clienteId = Number(id);
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [observacao, setObservacao] = useState("");
  const [consentimento, setConsentimento] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ["cliente", clienteId],
    queryFn: () => getCliente({ data: { id: clienteId } }),
    enabled: Number.isFinite(clienteId),
  });

  const pagar = useRegistrarPagamento();

  const save = useMutation({
    mutationFn: () =>
      updateCliente({
        data: {
          id: clienteId,
          nome,
          whatsapp,
          observacao,
          consentimentoWhatsapp: consentimento,
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries();
      setEditing(false);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    },
  });

  const data = detail.data;
  const nextCobranca: CobrancaItem | null = useMemo(() => {
    if (!data) return null;
    const pending = data.vendas
      .flatMap((v) =>
        v.parcelas
          .filter((p) => p.status !== "PAGO")
          .map((p) => ({ p, produto: v.produto })),
      )
      .sort((a, b) => (a.p.dataVencimento ?? "9999-12-31").localeCompare(b.p.dataVencimento ?? "9999-12-31"));
    const first = pending[0];
    if (!first) return null;
    return {
      parcelaId: first.p.id,
      clienteId: data.cliente.id,
      clienteNome: data.cliente.nome,
      whatsapp: data.cliente.whatsapp,
      produto: first.produto,
      numero: first.p.numero,
      valor: first.p.valor,
      dataVencimento: first.p.dataVencimento,
      status: first.p.status,
      saldoDevedor: data.saldoDevedor,
      consentimentoWhatsapp: data.cliente.consentimentoWhatsapp,
    };
  }, [data]);

  if (detail.isLoading) {
    return (
      <AppShell title="Cliente">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="mt-3 h-40 w-full rounded-2xl" />
      </AppShell>
    );
  }

  if (detail.error || !data) {
    return (
      <AppShell title="Cliente">
        <p className="text-sm text-danger">Cliente não encontrado.</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={data.cliente.nome}
      action={
        <button
          type="button"
          className="grid size-11 place-items-center rounded-lg text-muted hover:bg-surface-2"
          aria-label="Editar cliente"
          onClick={() => {
            setNome(data.cliente.nome);
            setWhatsapp(formatPhoneBR(data.cliente.whatsapp));
            setObservacao(data.cliente.observacao);
            setConsentimento(data.cliente.consentimentoWhatsapp);
            setEditing((v) => !v);
            setError(null);
          }}
        >
          <Pencil className="size-4" />
        </button>
      }
    >
      {editing ? (
        <form
          className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field label="Nome" htmlFor="edit-nome">
            <Input id="edit-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </Field>
          <Field label="WhatsApp" htmlFor="edit-wa">
            <Input
              id="edit-wa"
              value={whatsapp}
              onChange={(e) => setWhatsapp(formatPhoneBR(e.target.value))}
            />
          </Field>
          <Field label="Observação" htmlFor="edit-obs">
            <Input id="edit-obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </Field>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[var(--color-primary)]"
              checked={consentimento}
              onChange={(e) => setConsentimento(e.target.checked)}
            />
            <span>Autoriza cobrança no WhatsApp</span>
          </label>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </form>
      ) : null}

      <p className="text-sm text-muted">WhatsApp: {formatPhoneBR(data.cliente.whatsapp)}</p>
      <p className={`mt-1 text-xs ${data.cliente.consentimentoWhatsapp ? "text-success" : "text-warn"}`}>
        {data.cliente.consentimentoWhatsapp
          ? "Autorizou cobrança no WhatsApp"
          : "Ainda não autorizou cobrança no WhatsApp"}
      </p>
      {data.cliente.observacao ? (
        <p className="mt-2 text-sm text-muted">{data.cliente.observacao}</p>
      ) : null}

      <Card className="mt-4">
        <p className="text-sm text-muted">Saldo devedor</p>
        <MoneyText value={data.saldoDevedor} size="xl" className="mt-1 block" />
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted">Comprado</p>
            <MoneyText value={data.totalComprado} size="sm" />
          </div>
          <div>
            <p className="text-xs text-muted">Pago</p>
            <MoneyText value={data.totalPago} size="sm" className="text-success" />
          </div>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button asChild variant={nextCobranca ? "outline" : "default"}>
          <Link to="/vendas/nova" search={{ clienteId }}>
            <Plus />
            Nova venda
          </Link>
        </Button>
        <Button
          type="button"
          variant={nextCobranca ? "default" : "outline"}
          disabled={!nextCobranca}
          onClick={() => nextCobranca && void openWhatsApp(nextCobranca)}
        >
          <MessageCircle />
          Cobrar
        </Button>
      </div>

      <h2 className="mt-7 text-sm font-medium text-fg">Compras</h2>
      {data.vendas.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nenhuma venda neste cliente. Lance a primeira acima.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {data.vendas.map((venda) => (
            <Card key={venda.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-fg">{venda.produto}</p>
                  <p className="text-xs text-muted">{formatDateBR(venda.dataVenda)}</p>
                </div>
                <div className="text-right">
                  {venda.tipo === "a_vista" || venda.parcelas.length === 0 ? (
                    <p className="text-[11px] font-medium text-cash">À vista</p>
                  ) : venda.tipo === "fiado" ? (
                    <p className="text-[11px] font-medium text-fg">Fiado</p>
                  ) : null}
                  <MoneyText value={venda.valorTotal} size="sm" />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted">
                <div>
                  Pago
                  <MoneyText value={venda.pago} size="sm" className="mt-0.5 block text-fg" />
                </div>
                <div>
                  Restante
                  <MoneyText value={venda.restante} size="sm" className="mt-0.5 block text-fg" />
                </div>
                <div>
                  Entrada
                  <MoneyText value={venda.entrada} size="sm" className="mt-0.5 block text-fg" />
                </div>
              </div>
              {venda.parcelas.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                  {venda.parcelas.map((p) => (
                    <ParcelaLinha
                      key={p.id}
                      parcela={p}
                      clienteNome={data.cliente.nome}
                      produto={venda.produto}
                      saldoDevedor={data.saldoDevedor}
                      paying={pagar.isPending && pagar.variables === p.id}
                      onPagar={() => pagar.mutate(p.id)}
                      onCobrar={() => {
                        void openWhatsApp({
                          parcelaId: p.id,
                          clienteId: data.cliente.id,
                          clienteNome: data.cliente.nome,
                          whatsapp: data.cliente.whatsapp,
                          produto: venda.produto,
                          numero: p.numero,
                          valor: p.valor,
                          dataVencimento: p.dataVencimento,
                          status: p.status,
                          saldoDevedor: data.saldoDevedor,
                          consentimentoWhatsapp: data.cliente.consentimentoWhatsapp,
                        });
                      }}
                    />
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs font-medium text-cash">
                  {venda.tipo === "a_vista" ? "Pago à vista. Sem parcelas." : "Quitado na entrada."}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function ParcelaLinha({
  parcela,
  clienteNome,
  produto,
  saldoDevedor,
  onPagar,
  onCobrar,
  paying,
}: {
  parcela: Parcela;
  clienteNome: string;
  produto: string;
  saldoDevedor: number;
  onPagar: () => void;
  onCobrar: () => void;
  paying: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm text-fg">
          {parcela.dataVencimento ? formatDateBR(parcela.dataVencimento) : "Sem data"} ·{" "}
          <MoneyText value={parcela.valor} size="sm" />
        </p>
        <StatusBadge status={parcela.status} />
      </div>
      {parcela.status !== "PAGO" ? (
        <div className="flex shrink-0 gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={onCobrar}>
            Cobrar
          </Button>
          <Button type="button" size="sm" disabled={paying} onClick={() => setConfirming(true)}>
            {paying ? "…" : "Recebi"}
          </Button>
        </div>
      ) : null}
      <PagamentoSheet
        open={confirming}
        clienteNome={clienteNome}
        detalhe={`${produto} · parcela ${parcela.numero}`}
        valor={parcela.valor}
        saldoDevedor={saldoDevedor}
        pending={paying}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          onPagar();
          setConfirming(false);
        }}
      />
    </li>
  );
}
