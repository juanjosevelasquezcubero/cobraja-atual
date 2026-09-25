import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/app-shell";
import { Wordmark } from "@/components/logo";
import { ErrorText, Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  GROK_PROVIDERS,
  authClient,
  authEnabled,
  signIn,
} from "@/lib/auth/client";

export function LoginScreen() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"entrar" | "criar">("entrar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "criar") {
        const { error: err } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || email.split("@")[0] || "Vendedor",
        });
        if (err) throw new Error(err.message || "Não foi possível criar a conta.");
      } else {
        const { error: err } = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (err) throw new Error(err.message || "E-mail ou senha inválidos.");
      }
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PhoneFrame>
      <div className="flex flex-1 flex-col px-6 pb-8 pt-[max(2.5rem,env(safe-area-inset-top))]">
        <Wordmark />
        <p className="mt-3 max-w-[16rem] text-sm leading-relaxed text-muted">
          Cadastre vendas, calcule parcelas e cobre pelo WhatsApp.
        </p>

        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
          {mode === "criar" ? (
            <Field label="Seu nome" htmlFor="nome">
              <Input
                id="nome"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Como seus clientes te chamam"
              />
            </Field>
          ) : null}
          <Field label="E-mail" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
            />
          </Field>
          <Field label="Senha" htmlFor="senha">
            <Input
              id="senha"
              type="password"
              autoComplete={mode === "criar" ? "new-password" : "current-password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </Field>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" size="lg" disabled={busy} className="mt-1">
            {busy ? "Aguarde…" : mode === "criar" ? "Criar conta" : "Entrar"}
          </Button>
        </form>

        <button
          type="button"
          className="mt-4 min-h-11 text-sm font-medium text-primary"
          onClick={() => {
            setMode(mode === "entrar" ? "criar" : "entrar");
            setError(null);
          }}
        >
          {mode === "entrar" ? "Criar conta" : "Já tenho conta"}
        </button>

        {authEnabled ? (
          <>
            <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-subtle">
              <span className="h-px flex-1 bg-border" />
              ou
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="flex flex-col gap-2">
              {GROK_PROVIDERS.map((p) => (
                <Button
                  key={p.providerId}
                  type="button"
                  variant="outline"
                  onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                >
                  Continuar com {p.label}
                </Button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </PhoneFrame>
  );
}
