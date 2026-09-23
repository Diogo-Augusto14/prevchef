/**
 * Sequenciamento da cozinha.
 *
 * A regra que organiza tudo: os pratos de uma mesma mesa têm que ficar
 * prontos JUNTOS. Quem leva mais tempo entra primeiro no posto, e o prato
 * rápido é segurado para sair na hora certa — é assim que a cozinha
 * trabalha de verdade ("puxa a parmegiana, segura a salada").
 *
 * Exemplo: parmegiana leva 22 min e salada leva 5. Na mesma mesa, a
 * parmegiana começa em 0 e a salada em 17; as duas ficam prontas aos 22.
 * Mandar a salada primeiro só faria ela esfriar esperando.
 *
 * Os postos têm capacidade limitada (a fritura toca uma porção por vez),
 * então um pedido pode ser empurrado para frente se o posto estiver cheio.
 * Os pedidos entram na ordem em que foram lançados — a fila é justa.
 *
 * O que já está no fogo vem antes de tudo e não é empurrado por ninguém:
 * o plano dele conta de quando a cozinha tocou "Iniciar", e o tempo que já
 * passou sai da conta. É isso que faz a barra encolher e o "sai às" ficar
 * parado enquanto o prato cozinha.
 *
 * Nada disso passa por IA: é conta de agenda, tem que dar o mesmo resultado
 * sempre e responder na hora.
 */

import { ESTACOES, PRATOS, nomeDaEstacao } from "./restaurante";
import type { Pedido } from "./tipos";

/** Quanto tempo a casa promete entre o pedido e o prato na mesa. */
export const PRAZO_ALVO_MINUTOS = 30;

/** Sobrando até isto entre sair e o prazo, a mesa está no limite. */
export const FOLGA_DE_RISCO = 5;

/** Cada porção extra do mesmo prato custa um pouco mais de posto. */
const MINUTOS_POR_PORCAO_EXTRA = 2;

export type ItemAgendado = {
  pratoId: string;
  pratoNome: string;
  quantidade: number;
  estacao: string;
  estacaoNome: string;
  duracao: number;
  /** Minutos a partir de agora. Negativo: o prato já está no posto há tanto tempo. */
  inicio: number;
  fim: number;
  /**
   * Começa quando o posto vaga, e não por ser segurado para sair junto:
   * é o prato que explica por que a mesa espera.
   */
  esperaPosto: boolean;
};

export type PedidoAgendado = {
  pedido: Pedido;
  itens: ItemAgendado[];
  /** Quando o primeiro item entra no posto, em minutos a partir de agora. */
  comecaEm: number;
  /** Quando o pedido inteiro fica pronto, em minutos a partir de agora. */
  prontoEm: number;
  /** Minutos que a mesa já esperou desde o lançamento. */
  esperando: number;
  /** Minutos até vencer a meta, contada do lançamento. Negativo: já venceu. */
  prazoEm: number;
  /** O que sobra entre sair e o prazo. Negativo: sai tanto além do prazo. */
  folga: number;
  estadoDoPrazo: "folga" | "risco" | "atrasado";
  atrasado: boolean;
  /** Em preparo cujo plano já acabou: minutos além do previsto. */
  passouDoPrevisto: number;
};

const duracaoDoItem = (tempoPreparo: number, quantidade: number) =>
  tempoPreparo + Math.max(0, quantidade - 1) * MINUTOS_POR_PORCAO_EXTRA;

type Atribuicao = {
  indice: number;
  slot: number;
  inicio: number;
  fim: number;
  /** Quando o lugar escolhido no posto vagava. */
  livreDesde: number;
};

/** O lugar do posto que vaga mais cedo. */
const lugarMaisCedo = (livres: number[]) => {
  let slot = 0;
  for (let i = 1; i < livres.length; i++) {
    if (livres[i] < livres[slot]) slot = i;
  }
  return slot;
};

/**
 * Tenta encaixar os itens de um pedido terminando todos em `fim`.
 * Devolve se coube e, se não, o instante mínimo em que caberia.
 */
function tentarEncaixar(
  fimDesejado: number,
  slotsLivres: Map<string, number[]>,
  itens: { estacao: string; duracao: number }[]
): { coube: boolean; minimoNecessario: number; atribuicoes: Atribuicao[] } {
  const copia = new Map([...slotsLivres].map(([id, v]) => [id, [...v]]));
  const atribuicoes: Atribuicao[] = [];
  let minimoNecessario = fimDesejado;
  let coube = true;

  // Os mais demorados escolhem posto primeiro: são eles que amarram o fim.
  const ordem = itens
    .map((item, indice) => ({ ...item, indice }))
    .sort((a, b) => b.duracao - a.duracao);

  for (const item of ordem) {
    const livres = copia.get(item.estacao) ?? [0];
    const slot = lugarMaisCedo(livres);

    const maisCedoQuePode = livres[slot];
    const fimSeComecarJa = maisCedoQuePode + item.duracao;

    if (fimSeComecarJa > fimDesejado) {
      // Este item não fica pronto a tempo: o pedido inteiro precisa atrasar.
      coube = false;
      minimoNecessario = Math.max(minimoNecessario, fimSeComecarJa);
    }

    const inicio = Math.max(maisCedoQuePode, fimDesejado - item.duracao);
    const fim = inicio + item.duracao;
    livres[slot] = fim;

    atribuicoes.push({ indice: item.indice, slot, inicio, fim, livreDesde: maisCedoQuePode });
  }

  return { coube, minimoNecessario, atribuicoes };
}

/**
 * Monta a agenda da cozinha para os pedidos ainda não entregues.
 * `agora` é o instante de referência (injetado para o resultado ser testável).
 */
export function montarAgenda(pedidos: Pedido[], agora: Date): PedidoAgendado[] {
  const slots = new Map<string, number[]>(
    ESTACOES.map((e) => [e.id, new Array(Math.max(1, e.capacidade)).fill(0)])
  );

  const minutosDesde = (iso: string) =>
    Math.max(0, Math.round((agora.getTime() - new Date(iso).getTime()) / 60000));

  const itensDoPedido = (pedido: Pedido) =>
    pedido.itens.flatMap((item) => {
      const prato = PRATOS.find((p) => p.id === item.pratoId);
      if (!prato) return [];
      return [
        {
          pratoId: prato.id,
          pratoNome: prato.nome,
          quantidade: item.quantidade,
          estacao: prato.estacao,
          estacaoNome: nomeDaEstacao(prato.estacao),
          duracao: duracaoDoItem(prato.tempoPreparoMinutos, item.quantidade),
        },
      ];
    });

  const agenda: PedidoAgendado[] = [];

  const anotar = (pedido: Pedido, itens: ItemAgendado[], passouDoPrevisto: number) => {
    const esperando = minutosDesde(pedido.lancadoEm);
    const prontoEm = Math.max(0, ...itens.map((i) => i.fim));
    const prazoEm = PRAZO_ALVO_MINUTOS - esperando;
    const folga = prazoEm - prontoEm;

    agenda.push({
      pedido,
      itens: [...itens].sort((a, b) => a.inicio - b.inicio),
      comecaEm: Math.min(...itens.map((i) => i.inicio)),
      prontoEm,
      esperando,
      prazoEm,
      folga,
      estadoDoPrazo: folga < 0 ? "atrasado" : folga <= FOLGA_DE_RISCO ? "risco" : "folga",
      atrasado: folga < 0,
      passouDoPrevisto,
    });
  };

  // 1. O que já está no fogo. O plano é o de sair junto, contado de quando
  // começou: o tempo que já passou é descontado, e o que ainda falta segura
  // o lugar no posto para quem está na fila.
  const noFogo = pedidos
    .filter((p) => p.situacao === "em-preparo")
    .sort((a, b) =>
      (a.iniciadoEm ?? a.lancadoEm).localeCompare(b.iniciadoEm ?? b.lancadoEm)
    );

  for (const pedido of noFogo) {
    const base = itensDoPedido(pedido);
    if (base.length === 0) continue;

    // Sem a hora de início (gravado antes do campo existir), conta de agora.
    const decorrido = pedido.iniciadoEm ? minutosDesde(pedido.iniciadoEm) : 0;
    const fimDoPlano = Math.max(...base.map((i) => i.duracao)) - decorrido;

    const itens: ItemAgendado[] = base.map((i) => ({
      ...i,
      inicio: fimDoPlano - i.duracao,
      fim: fimDoPlano,
      esperaPosto: false,
    }));

    for (const item of itens) {
      if (item.fim <= 0) continue;
      const livres = slots.get(item.estacao);
      if (!livres) continue;
      const slot = lugarMaisCedo(livres);
      livres[slot] = Math.max(livres[slot], item.fim);
    }

    anotar(pedido, itens, Math.max(0, -fimDoPlano));
  }

  // 2. A fila, na ordem de lançamento, no que sobrou dos postos.
  const naFila = pedidos
    .filter((p) => p.situacao === "na-fila")
    .sort((a, b) => a.lancadoEm.localeCompare(b.lancadoEm));

  for (const pedido of naFila) {
    const base = itensDoPedido(pedido);
    if (base.length === 0) continue;

    // Procura o instante mais cedo em que o pedido inteiro fecha junto.
    let fim = Math.max(...base.map((i) => i.duracao));
    let resultado = tentarEncaixar(fim, slots, base);

    for (let tentativa = 0; tentativa < 12 && !resultado.coube; tentativa++) {
      fim = resultado.minimoNecessario;
      resultado = tentarEncaixar(fim, slots, base);
    }

    // Confirma a reserva dos postos.
    for (const atribuicao of resultado.atribuicoes) {
      const item = base[atribuicao.indice];
      const livres = slots.get(item.estacao);
      if (livres) livres[atribuicao.slot] = atribuicao.fim;
    }

    anotar(
      pedido,
      resultado.atribuicoes.map((a) => ({
        ...base[a.indice],
        inicio: a.inicio,
        fim: a.fim,
        // Começa exatamente quando o posto vaga: é o posto que segura.
        esperaPosto: a.livreDesde > 0 && a.inicio === a.livreDesde,
      })),
      0
    );
  }

  // Na tela, o que entra no posto primeiro aparece primeiro — o que já
  // está no fogo, com início negativo, vem no topo.
  return agenda.sort((a, b) => a.comecaEm - b.comecaEm || a.prontoEm - b.prontoEm);
}

/** Ocupação prevista de cada posto nos próximos minutos. */
export function cargaDasEstacoes(agenda: PedidoAgendado[], janela = 30) {
  return ESTACOES.map((estacao) => {
    const minutos = agenda
      .flatMap((p) => p.itens)
      .filter((i) => i.estacao === estacao.id && i.fim > 0 && i.inicio < janela)
      .reduce((s, i) => s + Math.min(i.fim, janela) - Math.max(i.inicio, 0), 0);

    const capacidadeTotal = estacao.capacidade * janela;

    return {
      ...estacao,
      minutosOcupados: Math.round(minutos),
      ocupacao: capacidadeTotal
        ? Math.min(100, Math.round((minutos / capacidadeTotal) * 100))
        : 0,
    };
  });
}
