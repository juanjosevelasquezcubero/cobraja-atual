import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ErrorText, Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCliente } from "@/lib/cobranca/server";
import { formatPhoneBR } from "@/lib/cobranca/whatsapp";

export const Route = createFileRoute("/clientes/novo")({ component: NovoCliente });

function NovoCliente() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [observacao, setObservacao] = useState("");
  const [consentimento, setConsentimento] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      createCliente({
        data: { nome, whatsapp, observacao, consentimentoWhatsapp: consentimento },
      }),
    onSuccess: async (created) => {
      await qc.invalidateQueries();
      await navigate({ to: "/clientes/$id", params: { id: String(created.id) } });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    },
  });

  return (
    <AppShell title="Novo cliente">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <Field label="Nome" htmlFor="nome">
          <Input
            id="nome"
            required
            autoComplete="name"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="João Silva"
          />
        </Field>
        <Field label="WhatsApp" htmlFor="whatsapp" hint="DDD + celular, com ou sem o 55 do Brasil.">
          <Input
            id="whatsapp"
            inputMode="tel"
            required
            value={whatsapp}
            onChange={(e) => setWhatsapp(formatPhoneBR(e.target.value))}
            placeholder="(55) 99999-9999"
          />
        </Field>
        <Field label="Observação" htmlFor="obs" hint="Opcional. Algo que ajude a lembrar da venda.">
          <Input
            id="obs"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Compra no fiado da loja"
          />
        </Field>
        <label className="flex items-start gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-[var(--color-primary)]"
            checked={consentimento}
            onChange={(e) => setConsentimento(e.target.checked)}
          />
          <span>
            <span className="font-medium text-fg">Autoriza cobrança no WhatsApp</span>
            <span className="mt-1 block text-xs text-muted">
              Sem esta autorização o app não abre a cobrança. Peça o ok do cliente (LGPD).
            </span>
          </span>
        </label>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" size="lg" disabled={save.isPending}>
          {save.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </form>
    </AppShell>
  );
}
