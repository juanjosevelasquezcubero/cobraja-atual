import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-lg border border-border bg-surface px-3.5 text-base text-fg outline-none transition-colors duration-150 placeholder:text-subtle focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
