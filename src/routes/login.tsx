import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { PhoneFrame } from "@/components/app-shell";
import { LoginScreen } from "@/components/login-screen";
import { Wordmark } from "@/components/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) void navigate({ to: "/" });
  }, [user, navigate]);

  if (isPending) {
    return (
      <PhoneFrame>
        <div className="flex flex-1 flex-col justify-center gap-4 px-6">
          <Wordmark />
          <p className="text-sm text-muted">Carregando…</p>
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </PhoneFrame>
    );
  }

  if (user) {
    return (
      <PhoneFrame>
        <div className="flex flex-1 items-center justify-center text-sm text-muted">
          Entrando…
        </div>
      </PhoneFrame>
    );
  }

  return <LoginScreen />;
}
