/**
 * Estoque como razão de movimentos, não como número parado.
 *
 * O saldo nunca é editado direto: ele é o resultado de replayar tudo que
 * entrou e saiu. Assim o estoque tem história — dá para responder "por que
 * só tem 2 kg de couve?" olhando os lançamentos, e a venda realmente baixa
 * o ingrediente em vez de deixar o número intacto.
 *
 * O controle é por LOTE, porque validade é do lote e não do ingrediente:
 * receber 5 kg de couve hoje não estende a validade da couve que já estava
 * na câmara. A baixa sai sempre do lote que vence primeiro (FEFO), que é
 * como a cozinha trabalha.
 */

import { ESTOQUE, PRATOS } from "./dados";
import type { ItemDePedido, ItemEstoque, Lote, MovimentoDeEstoque } from "./tipos";

export const MOTIVOS_DE_PERDA = [
  "Vencido",
  "Quebra ou avaria",
  "Sobra do serviço",
  "Erro de preparo",
] as const;

const centesimos = (v: number) => Math.round(v * 1000) / 1000;

/** O que veio na carga inicial vira um lote por ingrediente. */
export function lotesIniciais(): Lote[] {
  return ESTOQUE.map((item) => ({
    id: `lote-inicial-${item.id}`,
    ingredienteId: item.id,
    quantidade: item.quantidade,
    validade: item.validade,
    custoUnitario: item.custoUnitario,
    entradaEm: "",
    origem: "inicial" as const,
  }));
}

/**
 * Replaya os movimentos sobre os lotes iniciais.
 * Entrada abre lote novo; baixa e perda consomem do que vence primeiro.
 */
export function calcularLotes(movimentos: MovimentoDeEstoque[]): Lote[] {
  const lotes = lotesIniciais();

  const emOrdem = [...movimentos].sort((a, b) => a.em.localeCompare(b.em));

  for (const mov of emOrdem) {
    if (mov.tipo === "entrada") {
      lotes.push({
        id: mov.id,
        ingredienteId: mov.ingredienteId,
        quantidade: mov.quantidade,
        validade: mov.validade ?? "",
        custoUnitario: mov.custoUnitario ?? 0,
        entradaEm: mov.em,
        origem: "compra",
      });
      continue;
    }

    // Baixa ou perda: tira do lote que vence primeiro.
    let restante = mov.quantidade;
    const doIngrediente = lotes
      .filter((l) => l.ingredienteId === mov.ingredienteId && l.quantidade > 0)
      .sort((a, b) => a.validade.localeCompare(b.validade));

    for (const lote of doIngrediente) {
      if (restante <= 0) break;
      const tirar = Math.min(lote.quantidade, restante);
      lote.quantidade = centesimos(lote.quantidade - tirar);
      restante = centesimos(restante - tirar);
    }
    // Sobrou? O estoque não tinha tanto assim. O saldo para em zero e o
    // movimento fica registrado como foi lançado.
  }

  return lotes.filter((l) => l.quantidade > 0.0001);
}

/** Saldo de um ingrediente, somando os lotes. */
export function saldoDe(lotes: Lote[], ingredienteId: string): number {
  return centesimos(
    lotes
      .filter((l) => l.ingredienteId === ingredienteId)
      .reduce((s, l) => s + l.quantidade, 0)
  );
}

/**
 * Colapsa os lotes de volta ao formato de item de estoque, para as telas e
 * o cálculo de compras continuarem funcionando sem saber de lote.
 * A validade que vale é a do lote que vence primeiro.
 */
export function comoItensDeEstoque(lotes: Lote[]): ItemEstoque[] {
  return ESTOQUE.map((base) => {
    const doIngrediente = lotes
      .filter((l) => l.ingredienteId === base.id)
      .sort((a, b) => a.validade.localeCompare(b.validade));

    const quantidade = centesimos(
      doIngrediente.reduce((s, l) => s + l.quantidade, 0)
    );

    return {
      ...base,
      quantidade,
      validade: doIngrediente[0]?.validade || base.validade,
      custoUnitario: doIngrediente[0]?.custoUnitario ?? base.custoUnitario,
    };
  });
}

/** Ingredientes que um conjunto de itens de pedido consome. */
export function consumoDosItens(itens: ItemDePedido[]): Map<string, number> {
  const consumo = new Map<string, number>();

  for (const item of itens) {
    const prato = PRATOS.find((p) => p.id === item.pratoId);
    if (!prato) continue;

    for (const ing of prato.ingredientes) {
      consumo.set(
        ing.id,
        centesimos(
          (consumo.get(ing.id) ?? 0) + ing.quantidadePorPorcao * item.quantidade
        )
      );
    }
  }

  return consumo;
}

/** Monta os movimentos de baixa de uma conta que fechou. */
export function baixasDaConta(
  itens: ItemDePedido[],
  contaId: string,
  em: string
): MovimentoDeEstoque[] {
  return [...consumoDosItens(itens).entries()]
    .filter(([, quantidade]) => quantidade > 0)
    .map(([ingredienteId, quantidade], i) => ({
      id: `baixa-${contaId}-${i}`,
      tipo: "baixa" as const,
      ingredienteId,
      quantidade,
      em,
      contaId,
    }));
}

/** Movimentos de um ingrediente, do mais recente para o mais antigo. */
export function movimentosDo(
  movimentos: MovimentoDeEstoque[],
  ingredienteId: string
): MovimentoDeEstoque[] {
  return movimentos
    .filter((m) => m.ingredienteId === ingredienteId)
    .sort((a, b) => b.em.localeCompare(a.em));
}

/** Totais do dia para a tela de estoque. */
export function resumoDosMovimentos(
  movimentos: MovimentoDeEstoque[],
  desde: Date
) {
  const corte = desde.toISOString();
  const doPeriodo = movimentos.filter((m) => m.em >= corte);

  const somar = (tipo: MovimentoDeEstoque["tipo"]) =>
    centesimos(
      doPeriodo.filter((m) => m.tipo === tipo).reduce((s, m) => s + m.quantidade, 0)
    );

  const custoDasEntradas = doPeriodo
    .filter((m) => m.tipo === "entrada")
    .reduce((s, m) => s + m.quantidade * (m.custoUnitario ?? 0), 0);

  const custoDasPerdas = doPeriodo
    .filter((m) => m.tipo === "perda")
    .reduce((s, m) => {
      const base = ESTOQUE.find((e) => e.id === m.ingredienteId);
      return s + m.quantidade * (base?.custoUnitario ?? 0);
    }, 0);

  return {
    entradas: doPeriodo.filter((m) => m.tipo === "entrada").length,
    baixas: doPeriodo.filter((m) => m.tipo === "baixa").length,
    perdas: doPeriodo.filter((m) => m.tipo === "perda").length,
    quantidadeBaixada: somar("baixa"),
    custoDasEntradas: Math.round(custoDasEntradas * 100) / 100,
    custoDasPerdas: Math.round(custoDasPerdas * 100) / 100,
  };
}
