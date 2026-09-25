import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MoneyText } from "@/components/money-text";
import { PagamentoSheet } from "@/components/pagamento-sheet";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatDateBR, todayInSaoPaulo } from "@/lib/cobranca/dates";
import { getEmpresa } from "@/lib/cobranca/server";
import { cobrancaMessage, mensagemCobranca, whatsappHref } from "@/lib/cobranca/whatsapp";
import type { CobrancaItem } from "@/lib/cobranca/types";

export async function openWhatsApp(item: CobrancaItem) {
  if (!item.consentimentoWhatsapp) {
    toast.error("Sem autorização", {
      description: "Este cliente ainda não autorizou cobrança no WhatsApp. Marque na ficha dele.",
    });
    return;
  }
  const empresa = await getEmpresa().catch(() => null);
  const message = empresa
    ? mensagemCobranca({
        ton: empresa.tonPadrao,
        nome: item.clienteNome,
        empresa: empresa.nome,
        descricao: item.produto,
        saldo: item.saldoDevedor,
        vencimento: item.dataVencimento,
        pixChave: empresa.pixChave,
        pixNome: empresa.pixNome,
      })
    : cobrancaMessage({
        nome: item.clienteNome,
        valorParcela: item.valor,
        dataVencimento: item.dataVencimento,
        saldoDevedor: item.saldoDevedor,
        today: todayInSaoPaulo(),
      });
  const href = whatsappHref(item.whatsapp, message);
  let copied = false;
  try {
    await navigator.clipboard.writeText(message);
    copied = true;
  } catch {
    /* clipboard may be blocked in the preview */
  }
  const popup = window.open(href, "_blank", "noopener,noreferrer");
  if (!popup && copied) {
    toast.message("Mensagem copiada", {
      description: "Cole no WhatsApp se a janela não abrir.",
    });
  }
}

export function CobrancaRow({
  item,
  onPagar,
  paying,
}: {
  item: CobrancaItem;
  onPagar?: (id: number) => void;
  paying?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface p-3.5 ring-1 ring-border">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/clientes/$id"
            params={{ id: String(item.clienteId) }}
            className="block truncate font-medium text-fg"
          >
            {item.clienteNome}
          </Link>
          <p className="mt-0.5 text-xs text-muted">
            {item.produto} · {item.dataVencimento ? `parcela ${item.numero} · ${formatDateBR(item.dataVencimento)}` : "fiado · sem data"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <MoneyText value={item.valor} size="sm" />
          <StatusBadge status={item.status} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => void openWhatsApp(item)}
        >
          <MessageCircle />
          Cobrar
        </Button>
        {onPagar ? (
          <Button
            type="button"
            size="sm"
            className="flex-1"
            disabled={paying}
            onClick={() => setConfirming(true)}
          >
            {paying ? "Salvando…" : "Recebi"}
          </Button>
        ) : null}
      </div>
      <PagamentoSheet
        open={confirming}
        clienteNome={item.clienteNome}
        detalhe={`${item.produto} · parcela ${item.numero}`}
        valor={item.valor}
        saldoDevedor={item.saldoDevedor}
        pending={paying}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          onPagar?.(item.parcelaId);
          setConfirming(false);
        }}
      />
    </div>
  );
}
