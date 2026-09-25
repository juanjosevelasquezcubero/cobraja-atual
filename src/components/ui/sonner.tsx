import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            "bg-surface text-fg border border-border shadow-md font-sans",
          title: "text-fg",
          description: "text-muted",
          success: "border-success/30",
          error: "border-danger/30",
        },
      }}
    />
  );
}
