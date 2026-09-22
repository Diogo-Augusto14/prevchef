/**
 * KNN de regressão — roda inteiramente no navegador.
 *
 * Ideia: para prever quantas porções de um prato saem amanhã, procuramos no
 * histórico os K dias mais parecidos com o dia que queremos prever e tiramos a
 * média do que foi vendido neles.
 *
 * Atributos usados na distância:
 *   - temperatura  -> normalizada de 0 a 1 pelo mínimo/máximo do histórico
 *   - chuva        -> 0 ou 1
 *   - feriado      -> 0 ou 1
 *   - início do mês-> 0 ou 1
 *   - dia da semana-> tratado como igual/diferente (0 se é o mesmo dia, 1 se não)
 *
 * A distância é a euclidiana sobre esses valores. Como tudo fica entre 0 e 1,
 * nenhum atributo domina os outros por causa da escala.
 */

import type { Cenario, RegistroVenda } from "./tipos";

export const K_PADRAO = 5;

/** Peso de cada atributo na distância. Todos valem o mesmo por padrão. */
export const PESOS = {
  temperatura: 1,
  chuva: 1,
  feriado: 1,
  inicioMes: 1,
  diaSemana: 1,
} as const;

export type Escala = { temperaturaMin: number; temperaturaMax: number };

export type Vizinho = {
  registro: RegistroVenda;
  /** Distância até o dia consultado (quanto menor, mais parecido). */
  distancia: number;
  /** Porções vendidas do prato consultado naquele dia. */
  venda: number;
};

export type ResultadoPrevisao = {
  pratoId: string;
  /** Média das vendas dos K vizinhos, arredondada a uma casa. */
  previsao: number;
  /** Menor venda entre os vizinhos. */
  minimo: number;
  /** Maior venda entre os vizinhos. */
  maximo: number;
  /** Os K dias parecidos que geraram a previsão. */
  vizinhos: Vizinho[];
};

/** Calcula a escala de normalização da temperatura a partir do histórico. */
export function calcularEscala(historico: RegistroVenda[]): Escala {
  let min = Infinity;
  let max = -Infinity;
  for (const r of historico) {
    if (r.temperatura < min) min = r.temperatura;
    if (r.temperatura > max) max = r.temperatura;
  }
  // Histórico vazio ou com uma única temperatura: evita divisão por zero.
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return { temperaturaMin: 0, temperaturaMax: 1 };
  }
  return { temperaturaMin: min, temperaturaMax: max };
}

/** Leva um valor para a faixa 0–1 e corta o que estiver fora dela. */
function normalizar(valor: number, min: number, max: number): number {
  const n = (valor - min) / (max - min);
  return Math.min(1, Math.max(0, n));
}

const binario = (b: boolean) => (b ? 1 : 0);

/**
 * Distância entre um dia do histórico e o cenário consultado.
 * O dia da semana entra como 0 (mesmo dia) ou 1 (dia diferente).
 */
export function distancia(
  registro: RegistroVenda,
  cenario: Cenario,
  escala: Escala
): number {
  const { temperaturaMin: min, temperaturaMax: max } = escala;

  const dTemp =
    normalizar(registro.temperatura, min, max) -
    normalizar(cenario.temperatura, min, max);
  const dChuva = binario(registro.chuva) - binario(cenario.chuva);
  const dFeriado = binario(registro.feriado) - binario(cenario.feriado);
  const dInicio = binario(registro.inicioMes) - binario(cenario.inicioMes);
  const dSemana = registro.diaSemana === cenario.diaSemana ? 0 : 1;

  return Math.sqrt(
    PESOS.temperatura * dTemp * dTemp +
      PESOS.chuva * dChuva * dChuva +
      PESOS.feriado * dFeriado * dFeriado +
      PESOS.inicioMes * dInicio * dInicio +
      PESOS.diaSemana * dSemana * dSemana
  );
}

/** Ordena o histórico pela distância até o cenário e devolve os K primeiros. */
export function buscarVizinhos(
  historico: RegistroVenda[],
  cenario: Cenario,
  pratoId: string,
  k: number,
  escala: Escala
): Vizinho[] {
  return historico
    .map((registro) => ({
      registro,
      distancia: distancia(registro, cenario, escala),
      venda: registro.vendas[pratoId] ?? 0,
    }))
    // Empate na distância: o dia mais recente vem primeiro.
    .sort((a, b) => a.distancia - b.distancia || (a.registro.data < b.registro.data ? 1 : -1))
    .slice(0, Math.max(1, k));
}

/**
 * Prevê as vendas de um prato: devolve a previsão, a faixa (mínimo e máximo
 * observados entre os vizinhos) e os K dias usados.
 */
export function preverPrato(
  historico: RegistroVenda[],
  cenario: Cenario,
  pratoId: string,
  k: number = K_PADRAO,
  escala: Escala = calcularEscala(historico)
): ResultadoPrevisao {
  const vizinhos = buscarVizinhos(historico, cenario, pratoId, k, escala);
  const vendas = vizinhos.map((v) => v.venda);
  const media = vendas.reduce((s, v) => s + v, 0) / vendas.length;

  return {
    pratoId,
    previsao: Math.round(media * 10) / 10,
    minimo: Math.min(...vendas),
    maximo: Math.max(...vendas),
    vizinhos,
  };
}

/** Roda o KNN para vários pratos de uma vez, reaproveitando a mesma escala. */
export function preverPratos(
  historico: RegistroVenda[],
  cenario: Cenario,
  pratoIds: string[],
  k: number = K_PADRAO
): ResultadoPrevisao[] {
  const escala = calcularEscala(historico);
  return pratoIds.map((id) => preverPrato(historico, cenario, id, k, escala));
}

/** Transforma um registro do histórico em cenário (útil na avaliação). */
export function cenarioDoRegistro(registro: RegistroVenda): Cenario {
  return {
    diaSemana: registro.diaSemana,
    temperatura: registro.temperatura,
    chuva: registro.chuva,
    feriado: registro.feriado,
    inicioMes: registro.inicioMes,
  };
}
