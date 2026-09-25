import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ErrorText, Field, MoneyInput, NativeSelect } from "@/components/field";
import { MoneyText } from "@/components/money-text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { addMonths, formatDateBR, todayInSaoPaulo } from "@/lib/cobranca/dates";
import { buildFiado, buildParcelas } from "@/lib/cobranca/installments";
import { parseMoneyInput } from "@/lib/cobranca/money";
import { createVenda, listClientes } from "@/lib/cobranca/server";
import { cn } from "@/lib/utils";

type Modo = "parcelado" | "avista" | "fiado";
type Search = { clienteId?: number; modo?: Modo };

export const Route = createFileRoute("/vendas/nova")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    clienteId:
      typeof s.clienteId === "string"
        ? Number(s.clienteId)
        : typeof s.clienteId === "number"
          ? s.clienteId
          : undefined,
    modo: s.modo === "avista" || s.modo === "fiado" ? s.modo : undefined,
  }),
  component: NovaVenda,
});

function NovaVenda() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const clientes = useQuery({ queryKey: ["clientes"], queryFn: () => listClientes() });

  const [clienteId, setClienteId] = useState<string>(
    search.clienteId ? String(search.clienteId) : "",
  );
  const [produto, setProduto] = useState("");
  const [modo, setModo] = useState<Modo>(search.modo ?? "parcelado");
  const [valor, setValor] = useState("");
  const [entrada, setEntrada] = useState("");
  const [parcelas, setParcelas] = useState("2");
  const [primeiro, setPrimeiro] = useState(addMonths(todayInSaoPaulo(), 1));
  const [vencimentoFiado, setVencimentoFiado] = useState("");
  const [error, setError] = useState<string | null>(null);

  const valorN = parseMoneyInput(valor);
  const entradaN = modo === "avista" ? valorN : parseMoneyInput(entrada);
  const nParcelas = modo === "avista" ? 0 : Math.max(0, Math.min(24, Number(parcelas) || 0));
  const financiado = Math.max(0, Math.round((valorN - entradaN) * 100) / 100);

  const preview = useMemo(() => {
    if (modo === "fiado") {
      return buildFiado({
        valorTotal: valorN,
        entrada: entradaN,
        vencimento: vencimentoFiado || null,
      });
    }
    return buildParcelas({
      valorTotal: valorN,
      entrada: entradaN,
      numParcelas: nParcelas,
      primeiroVencimento: primeiro,
    });
  }, [modo, valorN, entradaN, nParcelas, primeiro, vencimentoFiado]);

  const save = useMutation({
    mutationFn: () =>
      createVenda({
        data: {
          clienteId: Number(clienteId),
          produto,
          valorTotal: valorN,
          entrada: entradaN,
          numParcelas: modo === "parcelado" ? nParcelas : modo === "fiado" ? 1 : 0,
          primeiroVencimento:
            modo === "fiado" ? vencimentoFiado || undefined : modo === "parcelado" ? primeiro : undefined,
          tipo: modo === "avista" ? "a_vista" : modo === "fiado" ? "fiado" : "parcelado",
        },
      }),
    onSuccess: async (created) => {
      await qc.invalidateQueries();
      await navigate({ to: "/clientes/$id", params: { id: String(created.clienteId) } });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Não foi possível criar a venda.");
    },
  });

  const lista = clientes.data ?? [];

  return (
    <AppShell title="Nova venda">
      {lista.length === 0 && !clientes.isLoading ? (
        <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
          Cadastre um cliente antes de lançar a venda.{" "}
          <Link to="/clientes/novo" className="font-medium text-primary">
            Novo cliente
          </Link>
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            save.mutate();
          }}
        >
          <Field label="Cliente" htmlFor="cliente">
            <NativeSelect
              id="cliente"
              required
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
            >
              <option value="">Selecionar</option>
              {lista.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Produto" htmlFor="produto">
            <Input
              id="produto"
              required
              value={produto}
              onChange={(e) => setProduto(e.target.value)}
              placeholder="Perfume"
            />
          </Field>
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1">
            {(
              [
                ["parcelado", "Parcelado"],
                ["avista", "À vista"],
                ["fiado", "Fiado"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setModo(key)}
                className={cn(
                  "h-11 rounded-xl text-xs font-medium",
                  modo === key
                    ? key === "avista"
                      ? "bg-cash text-cash-fg"
                      : key === "fiado"
                        ? "bg-fg text-surface"
                        : "bg-primary text-primary-fg"
                    : "text-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Field label="Valor" htmlFor="valor">
            <MoneyInput id="valor" value={valor} onChange={setValor} />
          </Field>
          {modo !== "avista" ? (
            <Field label="Entrada" htmlFor="entrada" hint={modo === "fiado" ? "Opcional. O restante fica fiado." : undefined}>
              <MoneyInput id="entrada" value={entrada} onChange={setEntrada} />
            </Field>
          ) : null}
          {modo === "parcelado" && financiado > 0 ? (
            <>
              <Field label="Número de parcelas" htmlFor="n">
                <Input
                  id="n"
                  inputMode="numeric"
                  value={parcelas}
                  onChange={(e) => setParcelas(e.target.value.replace(/\D/g, ""))}
                />
              </Field>
              <Field label="Primeiro vencimento" htmlFor="venc">
                <Input
                  id="venc"
                  type="date"
                  required
                  value={primeiro}
                  onChange={(e) => setPrimeiro(e.target.value)}
                />
              </Field>
            </>
          ) : null}
          {modo === "fiado" ? (
            <Field label="Vencimento" htmlFor="venc-fiado" hint="Deixe vazio se ainda não combinou a data.">
              <Input
                id="venc-fiado"
                type="date"
                value={vencimentoFiado}
                onChange={(e) => setVencimentoFiado(e.target.value)}
              />
            </Field>
          ) : null}

          {valorN > 0 ? (
            <Card className={modo === "avista" ? "bg-cash-soft" : "bg-surface-2"}>
              {modo === "avista" ? (
                <>
                  <p className="text-sm font-medium text-cash">Recebe agora</p>
                  <MoneyText value={valorN} size="lg" className="mt-1 block text-cash" />
                  <p className="mt-2 text-xs text-muted">Sem parcelas. O saldo deste cliente não muda.</p>
                </>
              ) : modo === "fiado" ? (
                <>
                  <p className="text-sm font-medium text-fg">Fiado</p>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-muted">Entrada</span>
                    <MoneyText value={entradaN} size="sm" />
                  </div>
                  <div className="mt-1 flex items-center justify-between border-t border-border pt-2">
                    <span className="text-sm font-medium">A receber depois</span>
                    <MoneyText value={financiado} size="sm" />
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {vencimentoFiado
                      ? `Combinado para ${formatDateBR(vencimentoFiado)}.`
                      : "Sem data marcada. Não entra como atraso até você definir o vencimento."}
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Valor</span>
                    <MoneyText value={valorN} size="sm" />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-muted">Entrada</span>
                    <MoneyText value={entradaN} size="sm" />
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                    <span className="text-sm font-medium">A parcelar</span>
                    <MoneyText value={financiado} size="sm" />
                  </div>
                  {preview.length > 0 ? (
                    <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                      {preview.map((p) => (
                        <li key={p.numero} className="flex justify-between text-muted">
                          <span>
                            Parcela {p.numero} · {formatDateBR(p.dataVencimento)}
                          </span>
                          <MoneyText value={p.valor} size="sm" className="text-fg" />
                        </li>
                      ))}
                    </ul>
                  ) : financiado === 0 ? (
                    <p className="mt-3 text-xs text-success">Venda quitada na entrada.</p>
                  ) : null}
                </>
              )}
            </Card>
          ) : null}

          <ErrorText>{error}</ErrorText>
          <Button
            type="submit"
            size="lg"
            className={modo === "avista" ? "bg-cash text-cash-fg hover:bg-cash/90" : undefined}
            disabled={save.isPending || !clienteId || valorN <= 0}
          >
            {save.isPending
              ? "Salvando…"
              : modo === "avista"
                ? "Registrar à vista"
                : modo === "fiado"
                  ? "Registrar fiado"
                  : "Criar venda"}
          </Button>
        </form>
      )}
    </AppShell>
  );
}
