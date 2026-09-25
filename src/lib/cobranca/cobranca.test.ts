import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { addMonths } from "./dates.ts";
import { buildFiado, buildParcelas, displayStatus } from "./installments.ts";
import { parseMoneyInput, splitCents, fromCents } from "./money.ts";
import {
  buildMensagem,
  cobrancaMessage,
  formatPhoneBR,
  isValidWhatsApp,
  mensagemCobranca,
  toWhatsAppNumber,
} from "./whatsapp.ts";

describe("buildParcelas", () => {
  it("splits 300 with 100 down payment into two 100 installments", () => {
    const rows = buildParcelas({
      valorTotal: 300,
      entrada: 100,
      numParcelas: 2,
      primeiroVencimento: "2026-10-20",
    });
    assert.deepEqual(rows, [
      { numero: 1, valor: 100, dataVencimento: "2026-10-20" },
      { numero: 2, valor: 100, dataVencimento: "2026-11-20" },
    ]);
  });

  it("puts leftover cents on the last installment", () => {
    const cents = splitCents(10000, 3);
    assert.deepEqual(cents, [3333, 3333, 3334]);
    assert.equal(fromCents(cents[0]!), 33.33);
  });

  it("returns empty when fully paid on down payment", () => {
    assert.deepEqual(
      buildParcelas({
        valorTotal: 150,
        entrada: 150,
        numParcelas: 3,
        primeiroVencimento: "2026-10-20",
      }),
      [],
    );
  });

  it("fiado is one open amount, with no date when none was set", () => {
    assert.deepEqual(
      buildFiado({ valorTotal: 80, entrada: 20, vencimento: "" }),
      [{ numero: 1, valor: 60, dataVencimento: null }],
    );
  });
});

describe("addMonths", () => {
  it("clamps 31 Jan onto February", () => {
    assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  });
});

describe("displayStatus", () => {
  it("keeps paid, flags overdue and due today", () => {
    assert.equal(displayStatus("PAGO", "2020-01-01", "2026-09-20"), "PAGO");
    assert.equal(displayStatus("PENDENTE", "2026-09-19", "2026-09-20"), "ATRASADO");
    assert.equal(displayStatus("PENDENTE", "2026-09-20", "2026-09-20"), "HOJE");
    assert.equal(displayStatus("PENDENTE", "2026-09-21", "2026-09-20"), "PENDENTE");
    assert.equal(displayStatus("PENDENTE", null, "2026-09-20"), "PENDENTE");
  });
});

describe("whatsapp DDD 55", () => {
  it("treats 11-digit numbers starting with 55 as DDD, not country code", () => {
    assert.equal(toWhatsAppNumber("(55) 99999-9999"), "5555999999999");
    assert.equal(toWhatsAppNumber("55999999999"), "5555999999999");
    assert.equal(isValidWhatsApp("(55) 99999-9999"), true);
  });

  it("keeps a number that already has the Brazil country code", () => {
    assert.equal(toWhatsAppNumber("5551999999999"), "5551999999999");
    assert.equal(toWhatsAppNumber("51 99999-9999"), "5551999999999");
  });

  it("rejects a number without DDD", () => {
    assert.equal(isValidWhatsApp("99999-9999"), false);
  });

  it("formats DDD 55 locally without eating the DDD", () => {
    assert.equal(formatPhoneBR("5555999999999"), "(55) 99999-9999");
    assert.equal(formatPhoneBR("55999999999"), "(55) 99999-9999");
  });
});

describe("parseMoneyInput", () => {
  it("accepts Brazilian and plain decimals", () => {
    assert.equal(parseMoneyInput("1.200,50"), 1200.5);
    assert.equal(parseMoneyInput("300"), 300);
    assert.equal(parseMoneyInput("100,00"), 100);
  });
});

describe("cobrancaMessage", () => {
  it("builds the seller reminder", () => {
    const msg = cobrancaMessage({
      nome: "João Silva",
      valorParcela: 100,
      dataVencimento: "2026-09-20",
      saldoDevedor: 200,
      today: "2026-09-20",
    });
    assert.match(msg, /Olá, João!/);
    assert.match(msg, /R\$\s?100/);
    assert.match(msg, /vence hoje/);
    assert.match(msg, /R\$\s?200/);
  });
});

describe("mensagemCobranca", () => {
  it("fills the CobraFirme template, including PIX", () => {
    const msg = mensagemCobranca({
      ton: "amigavel",
      nome: "João Silva",
      empresa: "Loja da Ana",
      descricao: "Perfume",
      saldo: 200,
      vencimento: "2026-09-20",
      pixChave: "ana@loja.com",
      pixNome: "Ana",
    });
    assert.match(msg, /João Silva/);
    assert.match(msg, /Loja da Ana/);
    assert.match(msg, /Perfume/);
    assert.match(msg, /20\/09\/2026/);
    assert.match(msg, /ana@loja.com/);
    assert.equal(buildMensagem("Oi {nome}", { nome: "Maria" }), "Oi Maria");
  });
});
