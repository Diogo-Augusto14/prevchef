/**
 * Cardápio do dia: a ficha do arquivo mais o que o gerente mudou na operação.
 *
 * O `data/pratos.json` continua sendo a ficha de referência — receita,
 * estação, tempo de preparo, preço de tabela. O que muda ao longo do serviço
 * (preço novo, prato pausado) vive no estado da operação e vale dali em
 * diante: pedido já lançado guarda o preço da hora do lançamento e não é
 * reescrito.
 */

import { PRATOS } from "./dados";
import type { AjustesDoCardapio, Prato } from "./tipos";

/** Preço de venda válido AGORA para um prato. */
export function precoDe(ajustes: AjustesDoCardapio, pratoId: string): number {
  const base = PRATOS.find((p) => p.id === pratoId)?.precoVenda ?? 0;
  const preco = ajustes[pratoId]?.preco;
  return preco !== undefined && preco > 0 ? preco : base;
}

export function estaPausado(ajustes: AjustesDoCardapio, pratoId: string): boolean {
  return Boolean(ajustes[pratoId]?.pausado);
}

/** Todos os preços do dia, no formato que a previsão espera. */
export function precosDoDia(ajustes: AjustesDoCardapio): Record<string, number> {
  const precos: Record<string, number> = {};
  for (const prato of PRATOS) precos[prato.id] = precoDe(ajustes, prato.id);
  return precos;
}

/** Um prato como a tela de cardápio lista: ficha + situação de hoje. */
export type PratoDoCardapio = Prato & {
  precoDeHoje: number;
  pausado: boolean;
};

export function cardapioDoDia(ajustes: AjustesDoCardapio): PratoDoCardapio[] {
  return PRATOS.map((prato) => ({
    ...prato,
    precoDeHoje: precoDe(ajustes, prato.id),
    pausado: estaPausado(ajustes, prato.id),
  }));
}
