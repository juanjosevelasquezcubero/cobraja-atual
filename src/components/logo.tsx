import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("size-10", className)}
      aria-hidden
    >
      <rect width="40" height="40" rx="12" fill="currentColor" className="text-primary" />
      <path
        d="M12 14h16v2.2H12V14zm0 4.8h16v2.2H12v-2.2zm0 4.8h10.4v2.2H12v-2.2z"
        fill="currentColor"
        className="text-primary-fg"
      />
      <path
        d="M23.2 24.4l2.3 2.3 4.3-4.6 1.5 1.4-5.8 6.2-3.8-3.8 1.5-1.5z"
        fill="currentColor"
        className="text-primary-fg"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="size-9" />
      <span className="font-display text-xl font-semibold tracking-tight text-fg">
        CobraJá
      </span>
    </div>
  );
}
