import type { DisplayStatus } from "./installments";
import type { TonKey } from "./whatsapp";

export type TipoVenda = "a_vista" | "parcelado" | "fiado";

export type Cliente = {
  id: number;
  nome: string;
  whatsapp: string;
  createdAt: string;
  saldoDevedor: number;
  atrasado: number;
  consentimentoWhatsapp: boolean;
};

export type Parcela = {
  id: number;
  vendaId: number;
  numero: number;
  valor: number;
  dataVencimento: string | null;
  status: DisplayStatus;
  dataPagamento: string | null;
};

export type VendaDetalhe = {
  id: number;
  produto: string;
  valorTotal: number;
  entrada: number;
  dataVenda: string;
  tipo: TipoVenda;
  pago: number;
  restante: number;
  parcelas: Parcela[];
};

export type ClienteDetalhe = {
  cliente: {
    id: number;
    nome: string;
    whatsapp: string;
    createdAt: string;
    observacao: string;
    consentimentoWhatsapp: boolean;
  };
  saldoDevedor: number;
  totalComprado: number;
  totalPago: number;
  vendas: VendaDetalhe[];
};

export type CobrancaItem = {
  parcelaId: number;
  clienteId: number;
  clienteNome: string;
  whatsapp: string;
  produto: string;
  numero: number;
  valor: number;
  dataVencimento: string | null;
  status: DisplayStatus;
  saldoDevedor: number;
  consentimentoWhatsapp: boolean;
};

export type Devedor = {
  clienteId: number;
  nome: string;
  whatsapp: string;
  saldo: number;
  diasAtraso: number;
  consentimentoWhatsapp: boolean;
};

export type DashboardData = {
  totalAReceber: number;
  venceHoje: number;
  atrasado: number;
  clientes: number;
  totalVendido: number;
  totalRecebido: number;
  totalAVista: number;
  recebidoMes: number;
  inadimplentes: number;
  proximos: CobrancaItem[];
  devedores: Devedor[];
};

export type EmpresaConfig = {
  nome: string;
  pixChave: string;
  pixNome: string;
  tonPadrao: TonKey;
};

export type VendaAVista = {
  id: number;
  clienteId: number;
  clienteNome: string;
  whatsapp: string;
  produto: string;
  valor: number;
  dataVenda: string;
};

export type CobrancaFiltro = "hoje" | "atrasadas" | "proximas" | "todas";
