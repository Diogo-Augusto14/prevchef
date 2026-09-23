/**
 * Quantas porções de cada prato AINDA dá para fazer.
 *
 * Conta pura, sem IA: para cada prato, o ingrediente que acaba primeiro
 * define o teto. Isso precisa ser exato e instantâneo — é o que impede o
 * salão de vender um prato que a cozinha não tem como entregar.
 *
 * O estoque considerado é o inicial menos o que os pedidos em aberto já
 * comprometeram. Um pedido "entregue" já consumiu; um pedido na fila ainda
 * vai consumir. Os dois descontam.
 *
 * O gerente também pode pausar um prato na mão. Pausado não é falta de
 * estoque — é decisão da casa — mas bloqueia a venda do mesmo jeito.
 */

import { estaPausado } from "./cardapio";
import { PRATOS, diasEntre } from "./dados";
import type { AjustesDoCardapio, ItemEstoque, Pedido } from "./tipos";

export type SituacaoDoPrato =
  | "disponivel"
  | "acabando"
  | "ultimas"
  | "esgotado"
  | "pausado";

export type DisponibilidadeDoPrato = {
  pratoId: string;
  nome: string;
  /** Porções que ainda cabem no estoque restante. */
  porcoes: number;
  situacao: SituacaoDoPrato;
  /** Ingrediente que impõe o teto. */
  limitante: { id: string; nome: string; restante: number; unidade: string } | null;
  /** Porções já comprometidas por pedidos em aberto. */
  comprometidas: number;
};

/** A partir de quantas porções restantes cada aviso acende. */
export const LIMIAR_ULTIMAS = 3;
export const LIMIAR_ACABANDO = 8;

/** Soma, por ingrediente, o que os pedidos informados consomem. */
export function consumoDosPedidos(pedidos: Pedido[]): Map<string, number> {
  const consumo = new Map<string, number>();

  for (const pedido of pedidos) {
    for (const item of pedido.itens) {
      const prato = PRATOS.find((p) => p.id === item.pratoId);
      if (!prato) continue;

      for (const ing of prato.ingredientes) {
        consumo.set(
          ing.id,
          (consumo.get(ing.id) ?? 0) + ing.quantidadePorPorcao * item.quantidade
        );
      }
    }
  }

  return consumo;
}

/** Porções de um prato já comprometidas pelos pedidos em aberto. */
function porcoesComprometidas(pedidos: Pedido[], pratoId: string): number {
  return pedidos.reduce(
    (total, pedido) =>
      total +
      pedido.itens
        .filter((i) => i.pratoId === pratoId)
        .reduce((s, i) => s + i.quantidade, 0),
    0
  );
}

/**
 * Estoque que sobra depois de descontar os pedidos, por ingrediente.
 * Ingrediente vencido na data conta como zero.
 */
export function estoqueRestante(
  pedidos: Pedido[],
  dataAlvo: string,
  estoque: ItemEstoque[]
): Map<string, number> {
  const consumo = consumoDosPedidos(pedidos);
  const restante = new Map<string, number>();

  for (const item of estoque) {
    const vencido = diasEntre(dataAlvo, item.validade) < 0;
    const disponivel = vencido ? 0 : item.quantidade;
    restante.set(item.id, Math.max(0, disponivel - (consumo.get(item.id) ?? 0)));
  }

  return restante;
}

function classificar(porcoes: number): SituacaoDoPrato {
  if (porcoes <= 0) return "esgotado";
  if (porcoes <= LIMIAR_ULTIMAS) return "ultimas";
  if (porcoes <= LIMIAR_ACABANDO) return "acabando";
  return "disponivel";
}

/** Disponibilidade de todos os pratos do cardápio. */
export function calcularDisponibilidade(
  pedidos: Pedido[],
  dataAlvo: string,
  estoque: ItemEstoque[],
  ajustes: AjustesDoCardapio = {}
): DisponibilidadeDoPrato[] {
  const restante = estoqueRestante(pedidos, dataAlvo, estoque);

  return PRATOS.map((prato) => {
    // Pausado vence qualquer conta de estoque: a casa decidiu não vender.
    if (estaPausado(ajustes, prato.id)) {
      return {
        pratoId: prato.id,
        nome: prato.nome,
        porcoes: 0,
        situacao: "pausado" as const,
        limitante: null,
        comprometidas: porcoesComprometidas(pedidos, prato.id),
      };
    }

    let teto = Infinity;
    let limitante: DisponibilidadeDoPrato["limitante"] = null;

    for (const ing of prato.ingredientes) {
      if (ing.quantidadePorPorcao <= 0) continue;

      const sobra = restante.get(ing.id) ?? 0;
      const cabem = Math.floor(sobra / ing.quantidadePorPorcao);

      if (cabem < teto) {
        teto = cabem;
        limitante = {
          id: ing.id,
          nome: ing.nome,
          restante: Math.round(sobra * 100) / 100,
          unidade: ing.unidade,
        };
      }
    }

    const porcoes = Number.isFinite(teto) ? Math.max(0, teto) : 0;

    return {
      pratoId: prato.id,
      nome: prato.nome,
      porcoes,
      situacao: classificar(porcoes),
      limitante,
      comprometidas: porcoesComprometidas(pedidos, prato.id),
    };
  }).sort((a, b) => a.porcoes - b.porcoes);
}

/**
 * Pode lançar esta quantidade deste prato agora?
 * É a pergunta que o salão faz antes de aceitar o pedido.
 */
export function podeLancar(
  disponibilidade: DisponibilidadeDoPrato[],
  pratoId: string,
  quantidade: number
): { pode: boolean; motivo?: string } {
  const item = disponibilidade.find((d) => d.pratoId === pratoId);
  if (!item) return { pode: false, motivo: "Prato fora do cardápio." };

  if (item.situacao === "pausado") {
    return { pode: false, motivo: "Pausado no cardápio de hoje." };
  }

  if (item.porcoes <= 0) {
    return {
      pode: false,
      motivo: item.limitante
        ? `Sem ${item.limitante.nome.toLowerCase()} em estoque.`
        : "Sem ingredientes em estoque.",
    };
  }

  if (quantidade > item.porcoes) {
    return {
      pode: false,
      motivo: `Só dá para fazer ${item.porcoes} porç${item.porcoes === 1 ? "ão" : "ões"}.`,
    };
  }

  return { pode: true };
}
