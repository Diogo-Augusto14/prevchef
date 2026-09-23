/** Salão e cozinha: mesas, postos e os tempos da casa. */

import restauranteJson from "@/data/restaurante.json";
import type { ArquivoRestaurante } from "./tipos";

const arquivo = restauranteJson as unknown as ArquivoRestaurante;

export const MESAS = arquivo.mesas;
export const ESTACOES = arquivo.estacoes;
export const TEMPO_MEDIO_DE_REFEICAO = arquivo.tempoMedioDeRefeicaoMinutos;

export const LUGARES_TOTAIS = MESAS.reduce((s, m) => s + m.lugares, 0);

/** Maior mesa da casa — o teto de um grupo sem juntar mesas. */
export const MAIOR_MESA = Math.max(...MESAS.map((m) => m.lugares));

export function nomeDaEstacao(id: string): string {
  return ESTACOES.find((e) => e.id === id)?.nome ?? id;
}

export function mesaPorId(id: string) {
  return MESAS.find((m) => m.id === id);
}

export { PRATOS, nomeDoPrato } from "./dados";
