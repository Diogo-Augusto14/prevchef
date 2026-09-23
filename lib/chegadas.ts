/**
 * Previsão de chegada por horário.
 *
 * Não há modelo novo aqui. O KNN já encontrou os 5 dias mais parecidos com
 * o que se quer prever; a curva de chegada é a média da curva DESSES dias.
 * Se aqueles dias eram parecidos no clima, no dia da semana e no calendário,
 * o jeito como as pessoas se espalharam pelas horas também se parece.
 *
 * Isso dá de graça a mesma faixa mínimo–máximo que os pratos têm: o menor e
 * o maior valor observado entre os vizinhos, em cada hora.
 */

import { HORAS_DE_SERVICO } from "./restaurante";
import type { Vizinho } from "./knn";

export type HoraPrevista = {
  hora: number;
  /** Rótulo pronto para a tela, ex.: "20h". */
  rotulo: string;
  pessoas: number;
  minimo: number;
  maximo: number;
  /** Fatia do movimento do dia que cai nesta hora. */
  fatia: number;
};

export type PrevisaoDeChegada = {
  horas: HoraPrevista[];
  totalDePessoas: number;
  /** A hora mais cheia do dia. */
  pico: HoraPrevista | null;
  /** O pico que ainda está por vir, se o serviço já começou. */
  proximoPico: HoraPrevista | null;
};

const arredondar = (v: number, casas = 0) => {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
};

/** Monta a curva de chegada a partir dos vizinhos que o KNN já achou. */
export function preverChegadas(vizinhos: Vizinho[]): PrevisaoDeChegada {
  if (vizinhos.length === 0) {
    return { horas: [], totalDePessoas: 0, pico: null, proximoPico: null };
  }

  const curvas = vizinhos.map((v) => v.registro.chegadasPorHora ?? []);

  const horas: HoraPrevista[] = HORAS_DE_SERVICO.map((hora, i) => {
    const valores = curvas.map((c) => c[i] ?? 0);
    const media = valores.reduce((s, v) => s + v, 0) / valores.length;

    return {
      hora,
      rotulo: `${hora}h`,
      pessoas: arredondar(media),
      minimo: Math.min(...valores),
      maximo: Math.max(...valores),
      fatia: 0,
    };
  });

  const total = horas.reduce((s, h) => s + h.pessoas, 0);
  for (const h of horas) {
    h.fatia = total ? arredondar((h.pessoas / total) * 100) : 0;
  }

  const pico = horas.reduce<HoraPrevista | null>(
    (maior, h) => (!maior || h.pessoas > maior.pessoas ? h : maior),
    null
  );

  return { horas, totalDePessoas: total, pico, proximoPico: pico };
}

/** O pico que ainda não passou, dado o relógio. */
export function picoAindaPorVir(
  previsao: PrevisaoDeChegada,
  agora: Date
): HoraPrevista | null {
  const hora = agora.getHours();
  const restantes = previsao.horas.filter((h) => h.hora >= hora);
  if (restantes.length === 0) return null;

  return restantes.reduce((maior, h) => (h.pessoas > maior.pessoas ? h : maior));
}

/** Quantas pessoas a previsão espera na hora atual e na seguinte. */
export function chegadasProximas(previsao: PrevisaoDeChegada, agora: Date) {
  const hora = agora.getHours();
  const atual = previsao.horas.find((h) => h.hora === hora) ?? null;
  const seguinte = previsao.horas.find((h) => h.hora === hora + 1) ?? null;

  return { atual, seguinte, foraDoServico: !atual && !seguinte };
}
