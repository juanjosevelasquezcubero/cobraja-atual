import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { authClient, GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { authErrorMessage, signUpNeedsVerification } from "@/lib/auth/messages";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isValidEmail } from "@/lib/cobra/logic";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"entrar" | "criar">("entrar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPending && user) void navigate({ to: "/" });
  }, [isPending, navigate, user]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isValidEmail(email)) return setError("Informe um e-mail válido. Ex.: nome@gmail.com");
    if (password.length < 6) return setError("A senha precisa de pelo menos 6 caracteres.");
    setBusy(true);
    setError("");
    setInfo("");
    try {
      if (mode === "criar") {
        const result = await authClient.signUp.email({
          email: email.trim().toLowerCase(),
          password,
          name: name.trim() || email.split("@")[0],
          callbackURL: "/verificar",
        });
        if (result.error) throw new Error(authErrorMessage(result.error, "Não foi possível criar a conta."));
        if (signUpNeedsVerification(result)) {
          setInfo("Enviamos um link para confirmar o e-mail. Abra a caixa de entrada e o spam antes de entrar.");
          setMode("entrar");
          return;
        }
      } else {
        const result = await authClient.signIn.email({ email: email.trim().toLowerCase(), password, callbackURL: "/" });
        if (result.error) throw new Error(authErrorMessage(result.error, "E-mail ou senha inválidos."));
      }
      void navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao entrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-desk px-5 py-10 text-ink">
      <div className="w-full max-w-sm space-y-4 rounded-[2rem] border border-line bg-bg p-6">
        <h1 className="text-3xl font-bold text-primary">CobraJá</h1>
        <p className="text-sm text-muted">Entre para enviar a carteira ao banco quando a internet voltar. Sem rede, o app continua no aparelho.</p>
        <form className="space-y-3" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-soft p-1">
            <button type="button" onClick={() => setMode("entrar")} className={`h-11 rounded-xl font-semibold ${mode === "entrar" ? "bg-primary text-primary-fg" : "text-muted"}`}>Entrar</button>
            <button type="button" onClick={() => setMode("criar")} className={`h-11 rounded-xl font-semibold ${mode === "criar" ? "bg-primary text-primary-fg" : "text-muted"}`}>Criar conta</button>
          </div>
          {mode === "criar" ? <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" className="h-11 w-full rounded-xl border border-line px-3" /> : null}
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@gmail.com" className="h-11 w-full rounded-xl border border-line px-3" />
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha, mínimo 6" className="h-11 w-full rounded-xl border border-line px-3" />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {info ? <p className="text-sm text-muted">{info}</p> : null}
          <button disabled={busy} className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-fg disabled:opacity-50">{busy ? "Aguarde…" : mode === "criar" ? "Criar conta" : "Entrar"}</button>
          {mode === "entrar" ? <Link to="/redefinir" className="block text-center text-sm font-semibold text-primary">Esqueci a senha</Link> : null}
          <Link to="/verificar" className="block text-center text-sm font-semibold text-primary">Reenviar confirmação</Link>
          <Link to="/privacidade" className="block text-center text-sm font-semibold text-primary">Privacidade</Link>
        </form>
        <div className="space-y-2">
          {GROK_PROVIDERS.map((provider) => (
            <button key={provider.providerId} type="button" onClick={() => signIn(provider.providerId, { callbackURL: "/" })} className="h-11 w-full rounded-xl border border-line font-semibold">
              Continuar com {provider.label}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
