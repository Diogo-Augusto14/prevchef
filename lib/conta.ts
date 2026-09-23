/**
 * Conta da mesa.
 *
 * Soma o que foi pedido pela ficha de preços, aplica a taxa de serviço e
 * divide por pessoa. Conta de dinheiro: sem IA, sem arredondamento criativo —
 * o subtotal é a soma exata dos itens e a taxa incide sobre ele.
 */

import { PRATOS } from "./dados";
import type { ItemDaConta, Ocupacao, Pedido } from "./tipos";

/** Taxa de serviço da casa, opcional na hora de fechar. */
export const TAXA_DE_SERVICO = 0.1;

export type Conta = {
  itens: ItemDaConta[];
  subtotal: number;
  servico: number;
  total: number;
  porPessoa: number;
  pessoas: number;
  /** Minutos desde que a mesa sentou. */
  minutosNaMesa: number;
  /** Pedidos que ainda não saíram da cozinha. */
  pendentes: number;
};

const centavos = (v: number) => Math.round(v * 100) / 100;

/**
 * Monta a conta de uma mesa a partir dos pedidos dela.
 * `comServico` deixa a taxa de fora quando o cliente não quer pagar.
 */
export function calcularConta(
  pedidosDaMesa: Pedido[],
  ocupacao: Ocupacao | null,
  agora: Date,
  comServico = true
): Conta {
  const porPrato = new Map<string, number>();

  for (const pedido of pedidosDaMesa) {
    for (const item of pedido.itens) {
      porPrato.set(
        item.pratoId,
        (porPrato.get(item.pratoId) ?? 0) + item.quantidade
      );
    }
  }

  const itens: ItemDaConta[] = [...porPrato.entries()].flatMap(
    ([pratoId, quantidade]) => {
      const prato = PRATOS.find((p) => p.id === pratoId);
      if (!prato) return [];
      return [
        {
          pratoId,
          nome: prato.nome,
          quantidade,
          precoUnitario: prato.precoVenda,
          total: centavos(prato.precoVenda * quantidade),
        },
      ];
    }
  );

  itens.sort((a, b) => b.total - a.total);

  const subtotal = centavos(itens.reduce((s, i) => s + i.total, 0));
  const servico = comServico ? centavos(subtotal * TAXA_DE_SERVICO) : 0;
  const total = centavos(subtotal + servico);
  const pessoas = ocupacao?.pessoas ?? 1;

  return {
    itens,
    subtotal,
    servico,
    total,
    pessoas,
    porPessoa: centavos(total / Math.max(1, pessoas)),
    minutosNaMesa: ocupacao
      ? Math.max(
          0,
          Math.round((agora.getTime() - new Date(ocupacao.desde).getTime()) / 60000)
        )
      : 0,
    pendentes: pedidosDaMesa.filter(
      (p) => p.situacao === "na-fila" || p.situacao === "em-preparo"
    ).length,
  };
}

/** Totais do serviço do dia, somando o que já foi fechado. */
export function resumoDoCaixa(contas: { total: number; pessoas: number }[]) {
  const faturamento = centavos(contas.reduce((s, c) => s + c.total, 0));
  const pessoas = contas.reduce((s, c) => s + c.pessoas, 0);

  return {
    contas: contas.length,
    faturamento,
    pessoas,
    /** Ticket médio por pessoa — o número que o gerente olha primeiro. */
    ticketMedio: pessoas ? centavos(faturamento / pessoas) : 0,
  };
}
