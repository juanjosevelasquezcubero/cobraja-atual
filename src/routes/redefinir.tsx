import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { confirmPasswordReset, requestPasswordReset } from "@/lib/auth/password-client";
import { isValidEmail } from "@/lib/cobra/logic";

export const Route = createFileRoute("/redefinir")({
  validateSearch: (search: Record<string, unknown>) => {
    const token = typeof search.token === "string" ? search.token : "";
    const error = typeof search.error === "string" ? search.error : "";
    return {
      ...(token ? { token } : {}),
      ...(error ? { error } : {}),
    };
  },
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token = "", error = "" } = Route.useSearch();
  if (error) {
    return (
      <Shell title="Link vencido">
        <p className="text-sm text-muted">Esse link não vale mais. Peça outro com o e-mail da conta.</p>
        <RequestForm />
      </Shell>
    );
  }
  if (token) return <ChoosePassword token={token} />;
  return (
    <Shell title="Esqueci a senha">
      <p className="text-sm text-muted">
        Informe o e-mail da conta. Se ele existir, preparamos um link para criar uma nova senha. O link vale 1 hora e chega na caixa de entrada quando o envio de e-mail está ligado.
      </p>
      <RequestForm />
    </Shell>
  );
}

function ChoosePassword({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 6) return setError("A senha precisa de pelo menos 6 caracteres.");
    if (password !== again) return setError("As senhas não são iguais.");
    setBusy(true);
    setError("");
    const result = await confirmPasswordReset(token, password);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setDone(true);
  }

  return (
    <Shell title="Nova senha">
      {done ? (
        <>
          <p className="text-sm text-muted">Senha atualizada. Entre de novo com a nova senha.</p>
          <Link to="/" className="grid h-11 place-items-center rounded-xl bg-primary font-semibold text-primary-fg">Ir para o CobraJá</Link>
        </>
      ) : (
        <form className="space-y-3" onSubmit={submit}>
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nova senha, mínimo 6" autoComplete="new-password" className="h-11 w-full rounded-xl border border-line px-3" />
          <input type="password" required minLength={6} value={again} onChange={(e) => setAgain(e.target.value)} placeholder="Repita a senha" autoComplete="new-password" className="h-11 w-full rounded-xl border border-line px-3" />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button disabled={busy} className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-fg disabled:opacity-50">{busy ? "Salvando…" : "Salvar senha"}</button>
        </form>
      )}
    </Shell>
  );
}

function RequestForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isValidEmail(email)) return setError("Informe um e-mail válido. Ex.: nome@gmail.com");
    setBusy(true);
    setError("");
    const result = await requestPasswordReset(email.trim().toLowerCase());
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setSent(true);
  }

  if (sent) {
    return <p className="text-sm text-muted">Se este e-mail tiver uma conta, o link foi preparado. Confira a caixa de entrada e o spam.</p>;
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@gmail.com" autoComplete="username" className="h-11 w-full rounded-xl border border-line px-3" />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button disabled={busy} className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-fg disabled:opacity-50">{busy ? "Enviando…" : "Enviar link"}</button>
    </form>
  );
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-desk px-5 py-10 text-ink">
      <div className="w-full max-w-sm space-y-4 rounded-[2rem] border border-line bg-bg p-6">
        <h1 className="text-3xl font-bold text-primary">{title}</h1>
        {children}
        <Link to="/" className="block text-center text-sm font-semibold text-primary">Voltar ao CobraJá</Link>
      </div>
    </main>
  );
}
