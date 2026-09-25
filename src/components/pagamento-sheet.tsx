import { useEffect } from "react";
import { createPortal } from "react-dom";
import { MoneyText } from "@/components/money-text";
import { Button } from "@/components/ui/button";

export function PagamentoSheet({
  open,
  clienteNome,
  detalhe,
  valor,
  saldoDevedor,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  clienteNome: string;
  detalhe?: string;
  valor: number;
  saldoDevedor: number;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const novoSaldo = Math.max(0, Math.round((saldoDevedor - valor) * 100) / 100);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const sheet = (
    <div className="absolute inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-desk/55"
        aria-label="Fechar"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pagar-title"
        className="relative w-full rounded-t-3xl bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_40px_-18px_rgb(0_0_0_/_0.35)]"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        <h2 id="pagar-title" className="font-display text-xl font-semibold text-fg">
          Registrar pagamento
        </h2>
        <p className="mt-1 text-sm text-muted">
          {clienteNome} pagou <MoneyText value={valor} size="sm" />
        </p>
        {detalhe ? <p className="mt-0.5 text-xs text-subtle">{detalhe}</p> : null}

        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted">Saldo anterior</dt>
            <dd>
              <MoneyText value={saldoDevedor} size="sm" />
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted">Pagamento</dt>
            <dd>
              <MoneyText value={valor} size="sm" className="text-success" />
            </dd>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2">
            <dt className="font-medium text-fg">Novo saldo</dt>
            <dd>
              <MoneyText value={novoSaldo} size="sm" />
            </dd>
          </div>
        </dl>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
          <Button type="button" onClick={onConfirm} disabled={pending}>
            {pending ? "Salvando…" : "Confirmar"}
          </Button>
        </div>
      </div>
    </div>
  );

  const frame = document.querySelector(".phone-frame");
  return frame ? createPortal(sheet, frame) : sheet;
}
