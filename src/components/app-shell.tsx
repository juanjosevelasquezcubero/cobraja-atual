import { Link, useRouterState } from "@tanstack/react-router";
import { Banknote, Home, UserRound, Users, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";
import { LogoMark } from "./logo";
import { Skeleton } from "./ui/skeleton";

const NAV = [
  { to: "/", label: "Início", icon: Home },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/avista", label: "À vista", icon: Banknote },
  { to: "/cobrancas", label: "Cobrar", icon: Wallet },
  { to: "/perfil", label: "Conta", icon: UserRound },
] as const;

export function PhoneFrame({ children }: { children: ReactNode }) {
  return <div className="phone-frame">{children}</div>;
}

function ShellSkeleton() {
  return (
    <PhoneFrame>
      <div className="flex flex-1 flex-col gap-4 px-5 pt-8">
        <div className="flex items-center gap-2.5">
          <LogoMark className="size-9" />
          <p className="font-display text-xl font-semibold tracking-tight text-fg">
            CobraJá
          </p>
        </div>
        <p className="text-sm text-muted">Carregando sua carteira…</p>
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </PhoneFrame>
  );
}

export function AppShell({
  children,
  title,
  action,
}: {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
}) {
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (isPending) return <ShellSkeleton />;
  if (!user) return <RedirectToSignIn />;

  return (
    <PhoneFrame>
      {title ? (
        <header className="flex items-center justify-between gap-3 px-5 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-fg">
            {title}
          </h1>
          {action}
        </header>
      ) : null}
      <main className="flex-1 overflow-y-auto px-5 pb-28 pt-2">{children}</main>
      <nav
        className="absolute inset-x-0 bottom-0 border-t border-border bg-surface/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-sm"
        aria-label="Principal"
      >
        <ul className="grid grid-cols-5">
          {NAV.map((item) => {
            const active =
              item.to === "/"
                ? pathname === "/"
                : pathname === item.to || pathname.startsWith(`${item.to}/`);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                    active ? "text-primary" : "text-muted",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </PhoneFrame>
  );
}
