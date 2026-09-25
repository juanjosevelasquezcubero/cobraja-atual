import { formatBRL } from "./money.ts";
import { formatDateBR } from "./dates.ts";

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Normalize to country-code form (55 + DDD + number).
 * DDD 55 (interior do RS) must NOT be treated as the country code:
 * 11 digits starting with 55 are a local mobile, so we still prepend 55.
 */
export function toWhatsAppNumber(value: string): string {
  const digits = digitsOnly(value);
  if (!digits) return "";
  if (digits.length >= 12 && digits.startsWith("55")) {
    return digits.slice(0, 13);
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  if (digits.length < 12 && !digits.startsWith("55")) {
    return `55${digits}`;
  }
  return digits;
}

export function isValidWhatsApp(value: string): boolean {
  const digits = digitsOnly(toWhatsAppNumber(value));
  return digits.length === 12 || digits.length === 13;
}

export function formatPhoneBR(value: string): string {
  const digits = digitsOnly(value);
  let local = digits;
  if (digits.startsWith("55") && digits.length >= 12) {
    local = digits.slice(2);
  }
  if (local.length === 0) return "";
  if (local.length <= 2) return `(${local}`;
  if (local.length <= 6) return `(${local.slice(0, 2)}) ${local.slice(2)}`;
  if (local.length <= 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7, 11)}`;
}

export function whatsappHref(phone: string, message: string): string {
  const number = toWhatsAppNumber(phone);
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function cobrancaMessage(opts: {
  nome: string;
  valorParcela: number;
  dataVencimento: string | null;
  saldoDevedor: number;
  today: string;
}): string {
  const first = opts.nome.trim().split(/\s+/)[0] || "olá";
  const venc = opts.dataVencimento ? formatDateBR(opts.dataVencimento) : "";
  let quando: string;
  if (!opts.dataVencimento) {
    quando = "está em aberto (fiado)";
  } else if (opts.dataVencimento === opts.today) {
    quando = "vence hoje";
  } else if (opts.dataVencimento < opts.today) {
    quando = `venceu em ${venc}`;
  } else {
    quando = `vence em ${venc}`;
  }
  return [
    `Olá, ${first}!`,
    "",
    `Passando para lembrar que sua parcela de ${formatBRL(opts.valorParcela)} ${quando}.`,
    "",
    `Seu saldo devedor é ${formatBRL(opts.saldoDevedor)}.`,
    "",
    "Obrigado!",
  ].join("\n");
}

export type TonKey = "amigavel" | "firme" | "formal";

export const TON_LABEL: Record<TonKey, string> = {
  amigavel: "Amigável",
  firme: "Firme",
  formal: "Formal",
};

/** Textos do CobraFirme. {variáveis} são trocadas na hora de cobrar. */
export const DEFAULT_TONS: Record<TonKey, string> = {
  amigavel:
    "Olá {nome}, aqui é {empresa}. Ref: {descricao}. Valor em aberto {saldo}. Vencimento {vencimento}. PIX {pix_chave} ({pix_nome}). Qualquer dúvida, responda esta mensagem.",
  firme:
    "Prezado(a) {nome}, a {empresa} ainda registra {saldo} em aberto, referente a {descricao}, vencimento {vencimento}. Pedimos providência imediata via PIX {pix_chave} ({pix_nome}).",
  formal:
    "Prezado(a) {nome}, conforme os registros de {empresa}, encontra-se pendente o valor de {saldo} relativo a {descricao}, com vencimento em {vencimento}. O pagamento pode ser efetuado via PIX {pix_chave} ({pix_nome}).",
};

export function buildMensagem(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => (key in vars ? vars[key]! : ""));
}

export function mensagemCobranca(opts: {
  ton: TonKey;
  nome: string;
  empresa: string;
  descricao: string;
  saldo: number;
  vencimento: string | null;
  pixChave: string;
  pixNome: string;
}): string {
  return buildMensagem(DEFAULT_TONS[opts.ton] ?? DEFAULT_TONS.amigavel, {
    nome: opts.nome.trim() || "cliente",
    empresa: opts.empresa.trim() || "a loja",
    descricao: opts.descricao.trim() || "sua conta",
    saldo: formatBRL(opts.saldo),
    vencimento: opts.vencimento ? formatDateBR(opts.vencimento) : "a combinar",
    pix_chave: opts.pixChave.trim() || "não cadastrada",
    pix_nome: opts.pixNome.trim(),
  });
}

