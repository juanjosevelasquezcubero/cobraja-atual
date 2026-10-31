import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth/client";
import { authErrorMessage } from "@/lib/auth/messages";
import { isValidEmail } from "@/lib/cobra/logic";

export const Route = createFileRoute("/verificar")({
  validateSearch: (search: Record<string, unknown>) => {
    const error = typeof search.error === "string" ? search.error : "";
    return error ? { error } : {};
  },
  component: VerifyPage,
});

function VerifyPage() {
  const { error = "" } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isValidEmail(email)) return setFormError("Informe um e-mail válido. Ex.: nome@gmail.com");
    if (typeof navigator !== "undefined" && !navigator.onLine) return setFormError("Sem internet. A confirmação precisa de conexão.");
    setBusy(true);
    setFormError("");
    const result = await authClient.sendVerificationEmail({
      email: email.trim().toLowerCase(),
      callbackURL: "/verificar",
    });
    setBusy(false);
    if (result.error) return setFormError(authErrorMessage(result.error, "Não foi possível reenviar. Tente de novo."));
    setSent(true);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-desk px-5 py-10 text-ink">
      <div className="w-full max-w-sm space-y-4 rounded-[2rem] border border-line bg-bg p-6">
        <h1 className="text-3xl font-bold text-primary">Confirmar e-mail</h1>
        {error ? (
          <p className="text-sm text-danger">Esse link não vale mais. Peça outro abaixo.</p>
        ) : (
          <p className="text-sm text-muted">
            Se o link do e-mail abriu esta página sem erro, o e-mail está confirmado. Entre com a senha. Sem o envio de e-mail ligado no servidor, a conta entra direto e esta confirmação não é exigida.
          </p>
        )}
        {sent ? (
          <p className="text-sm text-muted">Se a conta existir e ainda não estiver confirmada, o link foi enviado. Olhe a caixa de entrada e o spam.</p>
        ) : (
          <form className="space-y-3" onSubmit={submit}>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@gmail.com" autoComplete="username" className="h-11 w-full rounded-xl border border-line px-3" />
            {formError ? <p className="text-sm text-danger">{formError}</p> : null}
            <button disabled={busy} className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-fg disabled:opacity-50">{busy ? "Enviando…" : "Reenviar link"}</button>
          </form>
        )}
        <Link to="/login" className="block text-center text-sm font-semibold text-primary">Ir para entrar</Link>
      </div>
    </main>
  );
}
