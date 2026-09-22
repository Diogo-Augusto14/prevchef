/**
 * Avaliação do modelo — MAE (erro absoluto médio, em porções por dia).
 *
 * Método: os 10 primeiros meses do histórico viram treino e os 2 últimos meses
 * viram teste. O teste nunca é usado para escolher os vizinhos, então o número
 * que sai aqui é o erro do modelo em dias que ele não viu.
 *
 * Comparamos o KNN (K = 3, 5 e 7) com uma regra simples de referência:
 * "prever a média histórica daquele mesmo dia da semana". Um modelo só vale a
 * pena se ganhar dessa média.
 */

import {
  calcularEscala,
  cenarioDoRegistro,
  preverPrato,
  type Escala,
} from "./knn";
import type { RegistroVenda } from "./tipos";

export const KS_AVALIADOS = [3, 5, 7];

export type Particao = {
  treino: RegistroVenda[];
  teste: RegistroVenda[];
};

export type LinhaMae = {
  /** Nome do método, ex.: "KNN (K=5)". */
  metodo: string;
  /** MAE por prato, indexado pelo id do prato. */
  porPrato: Record<string, number>;
  /** MAE médio considerando todos os pratos. */
  geral: number;
};

export type PontoComparacao = {
  data: string;
  real: number;
  previsto: number;
};

export type Avaliacao = {
  particao: {
    treino: { inicio: string; fim: string; dias: number };
    teste: { inicio: string; fim: string; dias: number };
  };
  linhas: LinhaMae[];
  /** Melhor MAE geral entre as variações do KNN. */
  melhorKnn: LinhaMae;
  /** MAE geral da regra de referência. */
  referencia: LinhaMae;
  /** Redução percentual do erro do melhor KNN sobre a referência. */
  ganhoPercentual: number;
};

/** Soma meses a uma data AAAA-MM-DD, devolvendo outra data AAAA-MM-DD. */
function somarMeses(dataIso: string, meses: number): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1 + meses, dia));
  return d.toISOString().slice(0, 10);
}

/** Divide o histórico: 10 primeiros meses para treino, 2 últimos para teste. */
export function dividirHistorico(
  registros: RegistroVenda[],
  mesesDeTreino = 10
): Particao {
  const ordenados = [...registros].sort((a, b) => a.data.localeCompare(b.data));
  if (ordenados.length === 0) return { treino: [], teste: [] };

  const corte = somarMeses(ordenados[0].data, mesesDeTreino);
  const treino = ordenados.filter((r) => r.data < corte);
  const teste = ordenados.filter((r) => r.data >= corte);

  // Proteção para históricos curtos: nunca deixa uma das partes vazia.
  if (treino.length === 0 || teste.length === 0) {
    const limite = Math.max(1, Math.floor(ordenados.length * (10 / 12)));
    return { treino: ordenados.slice(0, limite), teste: ordenados.slice(limite) };
  }
  return { treino, teste };
}

const media = (valores: number[]) =>
  valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : 0;

const arredondar = (v: number) => Math.round(v * 100) / 100;

/** MAE do KNN para um dado K. */
export function maeKnn(
  treino: RegistroVenda[],
  teste: RegistroVenda[],
  pratoIds: string[],
  k: number,
  escala: Escala = calcularEscala(treino)
): LinhaMae {
  const porPrato: Record<string, number> = {};

  for (const pratoId of pratoIds) {
    const erros = teste.map((dia) => {
      const { previsao } = preverPrato(
        treino,
        cenarioDoRegistro(dia),
        pratoId,
        k,
        escala
      );
      return Math.abs(previsao - (dia.vendas[pratoId] ?? 0));
    });
    porPrato[pratoId] = arredondar(media(erros));
  }

  return {
    metodo: `KNN (K=${k})`,
    porPrato,
    geral: arredondar(media(Object.values(porPrato))),
  };
}

/** Média histórica de vendas por dia da semana, calculada só no treino. */
export function mediasPorDiaSemana(
  treino: RegistroVenda[],
  pratoId: string
): number[] {
  const somas = new Array(7).fill(0);
  const contagens = new Array(7).fill(0);
  for (const r of treino) {
    somas[r.diaSemana] += r.vendas[pratoId] ?? 0;
    contagens[r.diaSemana] += 1;
  }
  const geral = media(treino.map((r) => r.vendas[pratoId] ?? 0));
  return somas.map((s, i) => (contagens[i] ? s / contagens[i] : geral));
}

/** MAE da regra de referência: média do mesmo dia da semana. */
export function maeMediaDiaSemana(
  treino: RegistroVenda[],
  teste: RegistroVenda[],
  pratoIds: string[]
): LinhaMae {
  const porPrato: Record<string, number> = {};

  for (const pratoId of pratoIds) {
    const medias = mediasPorDiaSemana(treino, pratoId);
    const erros = teste.map((dia) =>
      Math.abs(medias[dia.diaSemana] - (dia.vendas[pratoId] ?? 0))
    );
    porPrato[pratoId] = arredondar(media(erros));
  }

  return {
    metodo: "Média do mesmo dia da semana",
    porPrato,
    geral: arredondar(media(Object.values(porPrato))),
  };
}

/** Roda a avaliação completa: KNN com K = 3, 5 e 7 contra a referência. */
export function avaliar(
  registros: RegistroVenda[],
  pratoIds: string[],
  ks: number[] = KS_AVALIADOS
): Avaliacao {
  const { treino, teste } = dividirHistorico(registros);
  const escala = calcularEscala(treino);

  const linhasKnn = ks.map((k) => maeKnn(treino, teste, pratoIds, k, escala));
  const referencia = maeMediaDiaSemana(treino, teste, pratoIds);
  const melhorKnn = linhasKnn.reduce((a, b) => (b.geral < a.geral ? b : a));

  return {
    particao: {
      treino: {
        inicio: treino[0]?.data ?? "",
        fim: treino[treino.length - 1]?.data ?? "",
        dias: treino.length,
      },
      teste: {
        inicio: teste[0]?.data ?? "",
        fim: teste[teste.length - 1]?.data ?? "",
        dias: teste.length,
      },
    },
    linhas: [...linhasKnn, referencia],
    melhorKnn,
    referencia,
    ganhoPercentual: referencia.geral
      ? arredondar(((referencia.geral - melhorKnn.geral) / referencia.geral) * 100)
      : 0,
  };
}

/**
 * Série previsto x real no período de teste, para o gráfico.
 * `pratoId` igual a "todos" soma os pratos informados em `pratoIds`.
 */
export function serieComparacao(
  registros: RegistroVenda[],
  pratoIds: string[],
  pratoId: string,
  k = 5
): PontoComparacao[] {
  const { treino, teste } = dividirHistorico(registros);
  const escala = calcularEscala(treino);
  const alvos = pratoId === "todos" ? pratoIds : [pratoId];

  return teste.map((dia) => {
    const cenario = cenarioDoRegistro(dia);
    let real = 0;
    let previsto = 0;
    for (const id of alvos) {
      real += dia.vendas[id] ?? 0;
      previsto += preverPrato(treino, cenario, id, k, escala).previsao;
    }
    return {
      data: dia.data,
      real,
      previsto: Math.round(previsto * 10) / 10,
    };
  });
}
