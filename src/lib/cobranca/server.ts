import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { addMonths, dateFromDb, daysLate, todayInSaoPaulo } from "./dates";
import { buildFiado, buildParcelas, displayStatus } from "./installments";
import { moneyFromDb, toCents } from "./money";
import { isValidWhatsApp, toWhatsAppNumber } from "./whatsapp";
import type {
  Cliente,
  ClienteDetalhe,
  CobrancaFiltro,
  CobrancaItem,
  DashboardData,
  Devedor,
  EmpresaConfig,
  Parcela,
  TipoVenda,
  VendaAVista,
  VendaDetalhe,
} from "./types";
import type { TonKey } from "./whatsapp";

function intFromDb(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  if (typeof value === "bigint") return Number(value);
  return 0;
}

type ClienteRow = {
  id: number;
  nome: string;
  whatsapp: string;
  created_at: unknown;
  observacao?: string | null;
  consentimento_whatsapp?: boolean | null;
};

type VendaRow = {
  id: number;
  cliente_id: number;
  produto: string;
  valor_total: unknown;
  entrada: unknown;
  data_venda: unknown;
  tipo?: string | null;
};

type ParcelaRow = {
  id: number;
  venda_id: number;
  numero: number;
  valor: unknown;
  data_vencimento: unknown;
  status: string;
  data_pagamento: unknown;
};

function mapParcela(row: ParcelaRow, today: string): Parcela {
  const vencimento = row.data_vencimento == null ? null : dateFromDb(row.data_vencimento) || null;
  return {
    id: intFromDb(row.id),
    vendaId: intFromDb(row.venda_id),
    numero: intFromDb(row.numero),
    valor: moneyFromDb(row.valor),
    dataVencimento: vencimento,
    status: displayStatus(row.status, vencimento, today),
    dataPagamento: row.data_pagamento ? dateFromDb(row.data_pagamento) : null,
  };
}

function asTipo(value: string | null | undefined): TipoVenda {
  if (value === "a_vista" || value === "fiado" || value === "parcelado") return value;
  return "parcelado";
}

function asTon(value: string | null | undefined): TonKey {
  if (value === "firme" || value === "formal" || value === "amigavel") return value;
  return "amigavel";
}

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<DashboardData> => {
    const sql = await getSql();
    const today = todayInSaoPaulo();
    const userId = context.userId;

    const [stats] = await sql<{
      clientes: unknown;
      total_vendido: unknown;
      total_recebido: unknown;
      total_a_receber: unknown;
      vence_hoje: unknown;
      atrasado: unknown;
      total_avista: unknown;
      recebido_mes: unknown;
      inadimplentes: unknown;
    }>`
      select
        (select count(*) from clientes where user_id = ${userId}) as clientes,
        coalesce((select sum(valor_total) from vendas where user_id = ${userId}), 0) as total_vendido,
        coalesce((select sum(entrada) from vendas where user_id = ${userId}), 0)
          + coalesce((select sum(valor) from parcelas where user_id = ${userId} and status = 'PAGO'), 0) as total_recebido,
        coalesce((select sum(valor) from parcelas where user_id = ${userId} and status = 'PENDENTE'), 0) as total_a_receber,
        coalesce((select sum(valor) from parcelas where user_id = ${userId} and status = 'PENDENTE' and data_vencimento = ${today}::date), 0) as vence_hoje,
        coalesce((select sum(valor) from parcelas where user_id = ${userId} and status = 'PENDENTE' and data_vencimento < ${today}::date), 0) as atrasado,
        coalesce((select sum(valor_total) from vendas where user_id = ${userId} and (tipo = 'a_vista' or entrada = valor_total)), 0) as total_avista,
        coalesce((select sum(entrada) from vendas where user_id = ${userId} and data_venda >= date_trunc('month', ${today}::date)::date and data_venda < (date_trunc('month', ${today}::date) + interval '1 month')::date), 0)
          + coalesce((select sum(valor) from parcelas where user_id = ${userId} and status = 'PAGO' and data_pagamento >= date_trunc('month', ${today}::date)::date and data_pagamento < (date_trunc('month', ${today}::date) + interval '1 month')::date), 0) as recebido_mes,
        (select count(distinct v.cliente_id) from parcelas p join vendas v on v.id = p.venda_id where p.user_id = ${userId} and p.status = 'PENDENTE' and p.data_vencimento is not null and p.data_vencimento < ${today}::date) as inadimplentes
    `;

    const proximoRows = await sql<
      ParcelaRow & {
        cliente_id: number;
        cliente_nome: string;
        whatsapp: string;
        consentimento_whatsapp: boolean | null;
        produto: string;
        saldo: unknown;
      }
    >`
      select
        p.id, p.venda_id, p.numero, p.valor, p.data_vencimento, p.status, p.data_pagamento,
        c.id as cliente_id, c.nome as cliente_nome, c.whatsapp, c.consentimento_whatsapp, v.produto,
        coalesce((
          select sum(p2.valor) from parcelas p2
          join vendas v2 on v2.id = p2.venda_id
          where v2.cliente_id = c.id and p2.status = 'PENDENTE' and p2.user_id = ${userId}
        ), 0) as saldo
      from parcelas p
      join vendas v on v.id = p.venda_id
      join clientes c on c.id = v.cliente_id
      where p.user_id = ${userId} and p.status = 'PENDENTE'
      order by p.data_vencimento asc, p.id asc
      limit 8
    `;

    const devedorRows = await sql<{
      id: number;
      nome: string;
      whatsapp: string;
      consentimento_whatsapp: boolean | null;
      saldo: unknown;
      mais_antiga: unknown;
    }>`
      select
        c.id, c.nome, c.whatsapp, c.consentimento_whatsapp,
        coalesce(sum(p.valor), 0) as saldo,
        min(p.data_vencimento) filter (where p.data_vencimento is not null and p.data_vencimento < ${today}::date) as mais_antiga
      from clientes c
      join vendas v on v.cliente_id = c.id and v.user_id = ${userId}
      join parcelas p on p.venda_id = v.id and p.status = 'PENDENTE' and p.user_id = ${userId}
      where c.user_id = ${userId}
      group by c.id, c.nome, c.whatsapp, c.consentimento_whatsapp
      order by saldo desc
      limit 5
    `;

    const devedores: Devedor[] = devedorRows.map((row) => {
      const maisAntiga = row.mais_antiga == null ? null : dateFromDb(row.mais_antiga) || null;
      return {
        clienteId: intFromDb(row.id),
        nome: row.nome,
        whatsapp: row.whatsapp,
        saldo: moneyFromDb(row.saldo),
        diasAtraso: daysLate(maisAntiga, today),
        consentimentoWhatsapp: Boolean(row.consentimento_whatsapp),
      };
    });

    return {
      clientes: intFromDb(stats?.clientes),
      totalVendido: moneyFromDb(stats?.total_vendido),
      totalRecebido: moneyFromDb(stats?.total_recebido),
      totalAReceber: moneyFromDb(stats?.total_a_receber),
      venceHoje: moneyFromDb(stats?.vence_hoje),
      atrasado: moneyFromDb(stats?.atrasado),
      totalAVista: moneyFromDb(stats?.total_avista),
      recebidoMes: moneyFromDb(stats?.recebido_mes),
      inadimplentes: intFromDb(stats?.inadimplentes),
      devedores,
      proximos: proximoRows.map((row) => ({
        parcelaId: intFromDb(row.id),
        clienteId: intFromDb(row.cliente_id),
        clienteNome: row.cliente_nome,
        whatsapp: row.whatsapp,
        produto: row.produto,
        numero: intFromDb(row.numero),
        valor: moneyFromDb(row.valor),
        dataVencimento: row.data_vencimento == null ? null : dateFromDb(row.data_vencimento) || null,
        status: displayStatus(
          row.status,
          row.data_vencimento == null ? null : dateFromDb(row.data_vencimento) || null,
          today,
        ),
        saldoDevedor: moneyFromDb(row.saldo),
        consentimentoWhatsapp: Boolean(row.consentimento_whatsapp),
      })),
    };
  });

export const listClientes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Cliente[]> => {
    const sql = await getSql();
    const today = todayInSaoPaulo();
    const rows = await sql<{
      id: number;
      nome: string;
      whatsapp: string;
      created_at: unknown;
      saldo: unknown;
      atrasado: unknown;
      consentimento_whatsapp: boolean | null;
    }>`
      select
        c.id, c.nome, c.whatsapp, c.created_at, c.consentimento_whatsapp,
        coalesce((
          select sum(p.valor) from parcelas p
          join vendas v on v.id = p.venda_id
          where v.cliente_id = c.id and p.status = 'PENDENTE' and p.user_id = ${context.userId}
        ), 0) as saldo,
        coalesce((
          select sum(p.valor) from parcelas p
          join vendas v on v.id = p.venda_id
          where v.cliente_id = c.id and p.status = 'PENDENTE'
            and p.data_vencimento < ${today}::date and p.user_id = ${context.userId}
        ), 0) as atrasado
      from clientes c
      where c.user_id = ${context.userId}
      order by c.nome asc
    `;
    return rows.map((row) => ({
      id: intFromDb(row.id),
      nome: row.nome,
      whatsapp: row.whatsapp,
      createdAt: dateFromDb(row.created_at),
      saldoDevedor: moneyFromDb(row.saldo),
      atrasado: moneyFromDb(row.atrasado),
      consentimentoWhatsapp: Boolean(row.consentimento_whatsapp),
    }));
  });

export const createCliente = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      nome: z.string().trim().min(2, "Informe o nome").max(80),
      whatsapp: z.string().trim().min(8, "Informe o WhatsApp"),
      observacao: z.string().trim().max(240).optional(),
      consentimentoWhatsapp: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const nome = data.nome.replace(/\s+/g, " ");
    const whatsapp = toWhatsAppNumber(data.whatsapp);
    if (!isValidWhatsApp(data.whatsapp)) {
      throw new Error("WhatsApp incompleto. Use DDD + número.");
    }
    const sql = await getSql();
    const [row] = await sql<ClienteRow>`
      insert into clientes (user_id, nome, whatsapp, observacao, consentimento_whatsapp)
      values (
        ${context.userId},
        ${nome},
        ${whatsapp},
        ${data.observacao?.replace(/\s+/g, " ").trim() ?? ""},
        ${data.consentimentoWhatsapp}
      )
      returning id, nome, whatsapp, created_at
    `;
    return {
      id: intFromDb(row.id),
      nome: row.nome,
      whatsapp: row.whatsapp,
    };
  });

export const updateCliente = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number().int(),
      nome: z.string().trim().min(2).max(80),
      whatsapp: z.string().trim().min(8),
      observacao: z.string().trim().max(240).optional(),
      consentimentoWhatsapp: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const whatsapp = toWhatsAppNumber(data.whatsapp);
    if (!isValidWhatsApp(data.whatsapp)) {
      throw new Error("WhatsApp incompleto. Use DDD + número.");
    }
    const sql = await getSql();
    const rows = await sql`
      update clientes
      set nome = ${data.nome.replace(/\s+/g, " ")},
          whatsapp = ${whatsapp},
          observacao = ${data.observacao?.replace(/\s+/g, " ").trim() ?? ""},
          consentimento_whatsapp = ${data.consentimentoWhatsapp}
      where id = ${data.id} and user_id = ${context.userId}
      returning id
    `;
    if (rows.length === 0) throw new Error("Cliente não encontrado.");
    return { ok: true };
  });

export const getCliente = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ context, data }): Promise<ClienteDetalhe> => {
    const sql = await getSql();
    const today = todayInSaoPaulo();
    const [cliente] = await sql<ClienteRow>`
      select id, nome, whatsapp, created_at, observacao, consentimento_whatsapp
      from clientes
      where id = ${data.id} and user_id = ${context.userId}
    `;
    if (!cliente) throw new Error("Cliente não encontrado.");

    const vendas = await sql<VendaRow>`
      select id, cliente_id, produto, valor_total, entrada, data_venda, tipo
      from vendas
      where cliente_id = ${data.id} and user_id = ${context.userId}
      order by data_venda desc, id desc
    `;

    const parcelas = await sql<ParcelaRow>`
      select p.id, p.venda_id, p.numero, p.valor, p.data_vencimento, p.status, p.data_pagamento
      from parcelas p
      join vendas v on v.id = p.venda_id
      where v.cliente_id = ${data.id} and p.user_id = ${context.userId}
      order by p.numero asc, p.id asc
    `;

    const byVenda = new Map<number, Parcela[]>();
    for (const row of parcelas) {
      const mapped = mapParcela(row, today);
      const list = byVenda.get(mapped.vendaId) ?? [];
      list.push(mapped);
      byVenda.set(mapped.vendaId, list);
    }

    const detalheVendas: VendaDetalhe[] = vendas.map((venda) => {
      const ps = byVenda.get(intFromDb(venda.id)) ?? [];
      const valorTotal = moneyFromDb(venda.valor_total);
      const entrada = moneyFromDb(venda.entrada);
      const pagoParcelas = ps
        .filter((p) => p.status === "PAGO")
        .reduce((sum, p) => sum + p.valor, 0);
      const pago = entrada + pagoParcelas;
      return {
        id: intFromDb(venda.id),
        produto: venda.produto,
        valorTotal,
        entrada,
        dataVenda: dateFromDb(venda.data_venda),
        tipo: asTipo(venda.tipo),
        pago,
        restante: Math.max(0, Math.round((valorTotal - pago) * 100) / 100),
        parcelas: ps,
      };
    });

    const totalComprado = detalheVendas.reduce((s, v) => s + v.valorTotal, 0);
    const totalPago = detalheVendas.reduce((s, v) => s + v.pago, 0);

    return {
      cliente: {
        id: intFromDb(cliente.id),
        nome: cliente.nome,
        whatsapp: cliente.whatsapp,
        createdAt: dateFromDb(cliente.created_at),
        observacao: cliente.observacao ?? "",
        consentimentoWhatsapp: Boolean(cliente.consentimento_whatsapp),
      },
      saldoDevedor: Math.max(0, Math.round((totalComprado - totalPago) * 100) / 100),
      totalComprado,
      totalPago,
      vendas: detalheVendas,
    };
  });

const createVendaSchema = z.object({
  clienteId: z.number().int(),
  produto: z.string().trim().min(2, "Informe o produto").max(80),
  valorTotal: z.number().positive("Valor deve ser maior que zero"),
  entrada: z.number().min(0),
  numParcelas: z.number().int().min(0).max(24),
  primeiroVencimento: z.string().optional(),
  tipo: z.enum(["a_vista", "parcelado", "fiado"]).optional(),
});

export const createVenda = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(createVendaSchema)
  .handler(async ({ context, data }) => {
    if (toCents(data.entrada) > toCents(data.valorTotal)) {
      throw new Error("A entrada não pode ser maior que o valor.");
    }
    const tipo: TipoVenda =
      data.tipo ??
      (toCents(data.entrada) >= toCents(data.valorTotal) || data.numParcelas === 0
        ? "a_vista"
        : "parcelado");
    const entradaCents = tipo === "a_vista" ? toCents(data.valorTotal) : toCents(data.entrada);
    const entrada = entradaCents / 100;
    const financed = toCents(data.valorTotal) - entradaCents;
    if (tipo === "parcelado" && financed > 0) {
      if (data.numParcelas < 1) {
        throw new Error("Informe o número de parcelas.");
      }
      if (!data.primeiroVencimento) {
        throw new Error("Informe o primeiro vencimento.");
      }
    }

    const sql = await getSql();
    const [cliente] = await sql<{ id: number }>`
      select id from clientes where id = ${data.clienteId} and user_id = ${context.userId}
    `;
    if (!cliente) throw new Error("Cliente não encontrado.");

    const today = todayInSaoPaulo();
    const status = financed <= 0 ? "quitada" : entradaCents > 0 ? "parcial" : "aberta";
    const [venda] = await sql<{ id: number }>`
      insert into vendas (user_id, cliente_id, produto, valor_total, entrada, data_venda, tipo, status)
      values (
        ${context.userId},
        ${data.clienteId},
        ${data.produto.replace(/\s+/g, " ")},
        ${data.valorTotal.toFixed(2)},
        ${entrada.toFixed(2)},
        ${today}::date,
        ${tipo},
        ${status}
      )
      returning id
    `;

    const parcelas =
      tipo === "fiado"
        ? buildFiado({
            valorTotal: data.valorTotal,
            entrada,
            vencimento: data.primeiroVencimento || null,
          })
        : tipo === "parcelado" && financed > 0
          ? buildParcelas({
              valorTotal: data.valorTotal,
              entrada,
              numParcelas: data.numParcelas,
              primeiroVencimento: data.primeiroVencimento!,
            })
          : [];

    for (const parcela of parcelas) {
      await sql`
        insert into parcelas (user_id, venda_id, numero, valor, data_vencimento, status)
        values (
          ${context.userId},
          ${venda.id},
          ${parcela.numero},
          ${parcela.valor.toFixed(2)},
          ${parcela.dataVencimento}::date,
          'PENDENTE'
        )
      `;
    }

    return { id: intFromDb(venda.id), clienteId: data.clienteId };
  });

export const registrarPagamento = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ parcelaId: z.number().int() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const today = todayInSaoPaulo();
    const rows = await sql<{ id: number; status: string }>`
      update parcelas
      set status = 'PAGO', data_pagamento = ${today}::date
      where id = ${data.parcelaId} and user_id = ${context.userId} and status = 'PENDENTE'
      returning id, status
    `;
    if (rows.length === 0) throw new Error("Parcela não encontrada ou já paga.");
    return { ok: true };
  });

export const listCobrancas = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ filtro: z.enum(["hoje", "atrasadas", "proximas", "todas"]) }))
  .handler(async ({ context, data }): Promise<CobrancaItem[]> => {
    const sql = await getSql();
    const today = todayInSaoPaulo();
    const filtro: CobrancaFiltro = data.filtro;

    const rows = await sql<
      ParcelaRow & {
        cliente_id: number;
        cliente_nome: string;
        whatsapp: string;
        consentimento_whatsapp: boolean | null;
        produto: string;
        saldo: unknown;
      }
    >`
      select
        p.id, p.venda_id, p.numero, p.valor, p.data_vencimento, p.status, p.data_pagamento,
        c.id as cliente_id, c.nome as cliente_nome, c.whatsapp, c.consentimento_whatsapp, v.produto,
        coalesce((
          select sum(p2.valor) from parcelas p2
          join vendas v2 on v2.id = p2.venda_id
          where v2.cliente_id = c.id and p2.status = 'PENDENTE' and p2.user_id = ${context.userId}
        ), 0) as saldo
      from parcelas p
      join vendas v on v.id = p.venda_id
      join clientes c on c.id = v.cliente_id
      where p.user_id = ${context.userId} and p.status = 'PENDENTE'
      order by p.data_vencimento asc nulls last, p.id asc
    `;

    return rows
      .map((row) => ({
        parcelaId: intFromDb(row.id),
        clienteId: intFromDb(row.cliente_id),
        clienteNome: row.cliente_nome,
        whatsapp: row.whatsapp,
        produto: row.produto,
        numero: intFromDb(row.numero),
        valor: moneyFromDb(row.valor),
        dataVencimento: row.data_vencimento == null ? null : dateFromDb(row.data_vencimento) || null,
        status: displayStatus(
          row.status,
          row.data_vencimento == null ? null : dateFromDb(row.data_vencimento) || null,
          today,
        ),
        saldoDevedor: moneyFromDb(row.saldo),
        consentimentoWhatsapp: Boolean(row.consentimento_whatsapp),
      }))
      .filter((item) => {
        if (filtro === "hoje") return item.status === "HOJE";
        if (filtro === "atrasadas") return item.status === "ATRASADO";
        if (filtro === "proximas") return item.status === "PENDENTE";
        return true;
      });
  });

export const seedDemo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const existing = await sql<{ n: unknown }>`
      select count(*) as n from clientes where user_id = ${context.userId}
    `;
    if (intFromDb(existing[0]?.n) > 0) {
      return { ok: true, seeded: false };
    }

    const today = todayInSaoPaulo();
    const [joao] = await sql<{ id: number }>`
      insert into clientes (user_id, nome, whatsapp, consentimento_whatsapp)
      values (${context.userId}, ${"João Silva"}, ${"5551999999999"}, ${true})
      returning id
    `;
    const [maria] = await sql<{ id: number }>`
      insert into clientes (user_id, nome, whatsapp, consentimento_whatsapp)
      values (${context.userId}, ${"Maria Santos"}, ${"5551988888888"}, ${true})
      returning id
    `;

    const [vendaJoao] = await sql<{ id: number }>`
      insert into vendas (user_id, cliente_id, produto, valor_total, entrada, data_venda, tipo, status)
      values (${context.userId}, ${joao.id}, ${"Perfume"}, ${"300.00"}, ${"100.00"}, ${today}::date, ${"parcelado"}, ${"parcial"})
      returning id
    `;
    const joaoParcelas = buildParcelas({
      valorTotal: 300,
      entrada: 100,
      numParcelas: 2,
      primeiroVencimento: today,
    });
    for (const parcela of joaoParcelas) {
      await sql`
        insert into parcelas (user_id, venda_id, numero, valor, data_vencimento, status)
        values (
          ${context.userId}, ${vendaJoao.id}, ${parcela.numero},
          ${parcela.valor.toFixed(2)}, ${parcela.dataVencimento}::date, 'PENDENTE'
        )
      `;
    }

    const [vendaMaria] = await sql<{ id: number }>`
      insert into vendas (user_id, cliente_id, produto, valor_total, entrada, data_venda, tipo, status)
      values (${context.userId}, ${maria.id}, ${"Kit cosméticos"}, ${"450.00"}, ${"50.00"}, ${today}::date, ${"parcelado"}, ${"parcial"})
      returning id
    `;
    const mariaFirst = addMonths(today, -1);
    const mariaParcelas = buildParcelas({
      valorTotal: 450,
      entrada: 50,
      numParcelas: 4,
      primeiroVencimento: mariaFirst,
    });
    for (const parcela of mariaParcelas) {
      await sql`
        insert into parcelas (user_id, venda_id, numero, valor, data_vencimento, status)
        values (
          ${context.userId}, ${vendaMaria.id}, ${parcela.numero},
          ${parcela.valor.toFixed(2)}, ${parcela.dataVencimento}::date, 'PENDENTE'
        )
      `;
    }

    const [ana] = await sql<{ id: number }>`
      insert into clientes (user_id, nome, whatsapp, consentimento_whatsapp)
      values (${context.userId}, ${"Ana Costa"}, ${"5555999999999"}, ${true})
      returning id
    `;
    await sql`
      insert into vendas (user_id, cliente_id, produto, valor_total, entrada, data_venda, tipo, status)
      values (${context.userId}, ${ana.id}, ${"Creme facial"}, ${"180.00"}, ${"180.00"}, ${today}::date, ${"a_vista"}, ${"quitada"})
    `;

    return { ok: true, seeded: true };
  });

export const listVendasAVista = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<VendaAVista[]> => {
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      cliente_id: number;
      cliente_nome: string;
      whatsapp: string;
      produto: string;
      valor_total: unknown;
      data_venda: unknown;
    }>`
      select
        v.id, v.produto, v.valor_total, v.data_venda,
        c.id as cliente_id, c.nome as cliente_nome, c.whatsapp
      from vendas v
      join clientes c on c.id = v.cliente_id
      where v.user_id = ${context.userId}
        and c.user_id = ${context.userId}
        and (v.tipo = 'a_vista' or v.entrada = v.valor_total)
      order by v.data_venda desc, v.id desc
    `;
    return rows.map((row) => ({
      id: intFromDb(row.id),
      clienteId: intFromDb(row.cliente_id),
      clienteNome: row.cliente_nome,
      whatsapp: row.whatsapp,
      produto: row.produto,
      valor: moneyFromDb(row.valor_total),
      dataVenda: dateFromDb(row.data_venda),
    }));
  });

export const getEmpresa = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<EmpresaConfig> => {
    const sql = await getSql();
    const [row] = await sql<{
      nome: string;
      pix_chave: string;
      pix_nome: string;
      ton_padrao: string;
    }>`
      select nome, pix_chave, pix_nome, ton_padrao
      from empresa
      where user_id = ${context.userId}
    `;
    return {
      nome: row?.nome ?? "",
      pixChave: row?.pix_chave ?? "",
      pixNome: row?.pix_nome ?? "",
      tonPadrao: asTon(row?.ton_padrao),
    };
  });

export const saveEmpresa = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      nome: z.string().trim().max(80),
      pixChave: z.string().trim().max(120),
      pixNome: z.string().trim().max(80),
      tonPadrao: z.enum(["amigavel", "firme", "formal"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into empresa (user_id, nome, pix_chave, pix_nome, ton_padrao)
      values (${context.userId}, ${data.nome}, ${data.pixChave}, ${data.pixNome}, ${data.tonPadrao})
      on conflict (user_id) do update set
        nome = excluded.nome,
        pix_chave = excluded.pix_chave,
        pix_nome = excluded.pix_nome,
        ton_padrao = excluded.ton_padrao
    `;
    return { ok: true as const };
  });

