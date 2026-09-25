import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ErrorText, Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { getEmpresa, saveEmpresa } from "@/lib/cobranca/server";
import { TON_LABEL, type TonKey } from "@/lib/cobranca/whatsapp";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/perfil")({ component: PerfilPage });

const TONS: TonKey[] = ["amigavel", "firme", "formal"];

function PerfilPage() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  const empresa = useQuery({ queryKey: ["empresa"], queryFn: () => getEmpresa() });
  const [nome, setNome] = useState("");
  const [pixChave, setPixChave] = useState("");
  const [pixNome, setPixNome] = useState("");
  const [ton, setTon] = useState<TonKey>("amigavel");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!empresa.data) return;
    setNome(empresa.data.nome);
    setPixChave(empresa.data.pixChave);
    setPixNome(empresa.data.pixNome);
    setTon(empresa.data.tonPadrao);
  }, [empresa.data]);

  const save = useMutation({
    mutationFn: () => saveEmpresa({ data: { nome, pixChave, pixNome, tonPadrao: ton } }),
    onSuccess: async () => {
      setSaved(true);
      setError(null);
      await qc.invalidateQueries({ queryKey: ["empresa"] });
    },
    onError: (err) => {
      setSaved(false);
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    },
  });

  return (
    <AppShell title="Conta">
      <Card className="flex flex-col gap-3 p-5">
        <p className="text-sm text-muted">Vendedor</p>
        <p className="font-display text-xl font-semibold text-fg">
          {user?.displayName || "Sua conta"}
        </p>
        {user?.primaryEmail ? <p className="text-sm text-muted">{user.primaryEmail}</p> : null}
        <div className="mt-2 border-t border-border pt-3">
          <UserButton />
        </div>
      </Card>

      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(false);
          save.mutate();
        }}
      >
        <p className="text-sm font-medium text-fg">Empresa e PIX</p>
        <Field label="Nome da empresa" htmlFor="empresa" hint="Aparece na mensagem de cobrança.">
          <Input id="empresa" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Loja da Maria" />
        </Field>
        <Field label="Chave PIX" htmlFor="pix">
          <Input id="pix" value={pixChave} onChange={(e) => setPixChave(e.target.value)} placeholder="seu@email.com" />
        </Field>
        <Field label="Nome no PIX" htmlFor="pix-nome">
          <Input id="pix-nome" value={pixNome} onChange={(e) => setPixNome(e.target.value)} placeholder="Maria Souza" />
        </Field>
        <div>
          <p className="mb-2 text-sm font-medium text-fg">Tom da cobrança</p>
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1">
            {TONS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTon(key)}
                className={cn(
                  "h-11 rounded-xl text-xs font-medium",
                  ton === key ? "bg-primary text-primary-fg" : "text-muted",
                )}
              >
                {TON_LABEL[key]}
              </button>
            ))}
          </div>
        </div>
        <ErrorText>{error}</ErrorText>
        {saved ? <p className="text-sm text-success">Salvo. A próxima cobrança já usa estes dados.</p> : null}
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Salvando…" : "Salvar ajustes"}
        </Button>
      </form>

      <div className="mt-6 space-y-2 text-sm leading-relaxed text-muted">
        <p>
          A cobrança só abre o WhatsApp de quem autorizou. Você envia a mensagem — o app não dispara sozinho.
        </p>
      </div>
    </AppShell>
  );
}
