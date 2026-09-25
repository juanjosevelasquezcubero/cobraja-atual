import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface p-4 shadow-[0_1px_0_rgba(28,25,21,0.04)]",
        className,
      )}
      {...props}
    />
  );
}
