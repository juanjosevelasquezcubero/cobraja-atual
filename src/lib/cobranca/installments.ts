import { addMonths } from "./dates.ts";
import { fromCents, splitCents, toCents } from "./money.ts";

export type ParcelaPreview = {
  numero: number;
  valor: number;
  dataVencimento: string | null;
};

export function buildParcelas(params: {
  valorTotal: number;
  entrada: number;
  numParcelas: number;
  primeiroVencimento: string;
}): ParcelaPreview[] {
  const financed = toCents(params.valorTotal) - toCents(params.entrada);
  if (financed <= 0 || params.numParcelas <= 0) return [];
  return splitCents(financed, params.numParcelas).map((cents, index) => ({
    numero: index + 1,
    valor: fromCents(cents),
    dataVencimento: addMonths(params.primeiroVencimento, index),
  }));
}

/** Fiado: uma conta só. Sem data se o vendedor ainda não combinou o vencimento. */
export function buildFiado(params: {
  valorTotal: number;
  entrada: number;
  vencimento?: string | null;
}): ParcelaPreview[] {
  const financed = toCents(params.valorTotal) - toCents(params.entrada);
  if (financed <= 0) return [];
  const venc = params.vencimento?.trim() ? params.vencimento : null;
  return [{ numero: 1, valor: fromCents(financed), dataVencimento: venc }];
}

export type DisplayStatus = "PAGO" | "PENDENTE" | "ATRASADO" | "HOJE";

export function displayStatus(
  stored: string,
  vencimento: string | null,
  today: string,
): DisplayStatus {
  if (stored === "PAGO") return "PAGO";
  if (!vencimento) return "PENDENTE";
  if (vencimento < today) return "ATRASADO";
  if (vencimento === today) return "HOJE";
  return "PENDENTE";
}
