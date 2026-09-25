import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-surface-2 text-muted">
        <Icon className="size-6" />
      </div>
      <h2 className="font-display text-lg font-semibold text-fg">{title}</h2>
      <p className="mt-1 max-w-[16rem] text-sm leading-relaxed text-muted">{body}</p>
      {action ? <div className="mt-5 w-full">{action}</div> : null}
    </div>
  );
}
