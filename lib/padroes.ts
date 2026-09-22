/**
 * "O que é comum vender" — reconhecimento de padrões no histórico.
 *
 * Enquanto o KNN responde "quanto vende num dia parecido com este", estas
 * funções respondem "o que costuma acontecer no geral": média por dia da
 * semana, por faixa de temperatura, com e sem chuva, em feriado e no início
 * do mês. É esse resumo que a análise automática recebe para explicar o
 * porquê da previsão, em vez de só repetir o número.
 */

import { HISTORICO, NOMES_DIAS, PRATOS, PRATO_IDS } from "./dados";
import { faixaDeClima } from "./clima";
import type { RegistroVenda } from "./tipos";

export type MediaPorCondicao = {
  /** Nome da condição, ex.: "sábado", "frio", "com chuva". */
  condicao: string;
  dias: number;
  /** Média de porções por prato, indexada pelo id do prato. */
  porPrato: Record<string, number>;
  total: number;
};

export type PadroesDoPrato = {
  pratoId: string;
  nome: string;
  /** Média geral de porções por dia em todo o histórico. */
  media: number;
  /** Dia da semana em que mais sai, e quanto acima da média geral. */
  melhorDia: { dia: string; media: number; variacao: number };
  /** Faixa de temperatura em que mais sai. */
  melhorClima: { clima: string; media: number; variacao: number };
  /**
   * Efeito de cada condição em %, medido dentro da mesma faixa de
   * temperatura (ver `efeitoDentroDoClima`) para não confundir o efeito da
   * chuva com o do calor.
   */
  efeitoChuva: number;
  efeitoFeriado: number;
  efeitoInicioMes: number;
};

const media = (valores: number[]) =>
  valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : 0;

const arredondar = (v: number, casas = 1) => {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
};

/** Variação percentual de `valor` sobre `base`. */
const variacao = (valor: number, base: number) =>
  base ? Math.round(((valor - base) / base) * 100) : 0;

function mediaDoGrupo(dias: RegistroVenda[], pratoId: string) {
  return media(dias.map((d) => d.vendas[pratoId] ?? 0));
}

/** Agrupa o histórico por uma condição qualquer e tira a média por prato. */
export function mediasPorCondicao(
  grupos: { condicao: string; dias: RegistroVenda[] }[]
): MediaPorCondicao[] {
  return grupos.map(({ condicao, dias }) => {
    const porPrato: Record<string, number> = {};
    for (const id of PRATO_IDS) {
      porPrato[id] = arredondar(mediaDoGrupo(dias, id));
    }
    return {
      condicao,
      dias: dias.length,
      porPrato,
      total: arredondar(
        Object.values(porPrato).reduce((s, v) => s + v, 0)
      ),
    };
  });
}

/** Médias por dia da semana (domingo a sábado). */
export function porDiaDaSemana(): MediaPorCondicao[] {
  return mediasPorCondicao(
    NOMES_DIAS.map((nome, indice) => ({
      condicao: nome,
      dias: HISTORICO.filter((d) => d.diaSemana === indice),
    }))
  );
}

/** Médias por faixa de temperatura. */
export function porFaixaDeClima(): MediaPorCondicao[] {
  return mediasPorCondicao([
    { condicao: "frio (abaixo de 19 °C)", dias: HISTORICO.filter((d) => faixaDeClima(d.temperatura) === "frio") },
    { condicao: "ameno (19 a 26 °C)", dias: HISTORICO.filter((d) => faixaDeClima(d.temperatura) === "ameno") },
    { condicao: "quente (acima de 26 °C)", dias: HISTORICO.filter((d) => faixaDeClima(d.temperatura) === "quente") },
  ]);
}

/** Médias com e sem chuva, feriado e início do mês. */
export function porCondicoesDoDia(): MediaPorCondicao[] {
  return mediasPorCondicao([
    { condicao: "com chuva", dias: HISTORICO.filter((d) => d.chuva) },
    { condicao: "sem chuva", dias: HISTORICO.filter((d) => !d.chuva) },
    { condicao: "feriado", dias: HISTORICO.filter((d) => d.feriado) },
    { condicao: "dia comum", dias: HISTORICO.filter((d) => !d.feriado) },
    { condicao: "início do mês", dias: HISTORICO.filter((d) => d.inicioMes) },
    { condicao: "resto do mês", dias: HISTORICO.filter((d) => !d.inicioMes) },
  ]);
}

const FAIXAS = ["frio", "ameno", "quente"] as const;

/**
 * Efeito percentual de uma condição, medido DENTRO de cada faixa de
 * temperatura e só depois combinado.
 *
 * Sem essa separação o número sai com o sinal trocado. No histórico
 * simulado chove mais no calor (25,4 °C nos dias de chuva contra 22,1 °C
 * nos secos), então comparar "com chuva" × "sem chuva" direto mistura o
 * efeito da chuva com o do calor: o caldo verde, que a chuva faz subir,
 * aparecia caindo 14%.
 */
function efeitoDentroDoClima(
  pratoId: string,
  temACondicao: (d: RegistroVenda) => boolean,
  minimoDeDias = 5
): number {
  let somaDasRazoes = 0;
  let somaDosPesos = 0;

  for (const faixa of FAIXAS) {
    const grupo = HISTORICO.filter((d) => faixaDeClima(d.temperatura) === faixa);
    const com = grupo.filter(temACondicao);
    const sem = grupo.filter((d) => !temACondicao(d));
    if (com.length < minimoDeDias || sem.length < minimoDeDias) continue;

    const base = mediaDoGrupo(sem, pratoId);
    if (!base) continue;

    // Cada faixa pesa pelo número de dias que ela contribui.
    somaDasRazoes += (mediaDoGrupo(com, pratoId) / base) * com.length;
    somaDosPesos += com.length;
  }

  if (somaDosPesos === 0) {
    // Nenhuma faixa com dias suficientes (feriado é raro): volta ao simples.
    const com = HISTORICO.filter(temACondicao);
    const base = mediaDoGrupo(HISTORICO.filter((d) => !temACondicao(d)), pratoId);
    return base ? Math.round((mediaDoGrupo(com, pratoId) / base - 1) * 100) : 0;
  }

  return Math.round((somaDasRazoes / somaDosPesos - 1) * 100);
}

/**
 * Média por prato nos dias com a mesma faixa de temperatura E a mesma
 * condição de chuva — o recorte que de fato descreve o dia consultado.
 */
export function mediaEmDiasParecidos(temperatura: number, chuva: boolean) {
  const faixa = faixaDeClima(temperatura);
  const dias = HISTORICO.filter(
    (d) => faixaDeClima(d.temperatura) === faixa && d.chuva === chuva
  );

  const porPrato: Record<string, number> = {};
  for (const id of PRATO_IDS) porPrato[id] = arredondar(mediaDoGrupo(dias, id));

  return {
    condicao: `${faixa} ${chuva ? "com chuva" : "sem chuva"}`,
    dias: dias.length,
    porPrato,
  };
}

/** Resumo por prato: onde cada um vende melhor e o peso de cada condição. */
export function padroesPorPrato(): PadroesDoPrato[] {
  const climas = [
    { clima: "frio", dias: HISTORICO.filter((d) => faixaDeClima(d.temperatura) === "frio") },
    { clima: "ameno", dias: HISTORICO.filter((d) => faixaDeClima(d.temperatura) === "ameno") },
    { clima: "quente", dias: HISTORICO.filter((d) => faixaDeClima(d.temperatura) === "quente") },
  ];

  return PRATOS.map((prato) => {
    const geral = mediaDoGrupo(HISTORICO, prato.id);

    const dias = NOMES_DIAS.map((nome, indice) => ({
      dia: nome,
      media: mediaDoGrupo(
        HISTORICO.filter((d) => d.diaSemana === indice),
        prato.id
      ),
    })).sort((a, b) => b.media - a.media);

    const porClima = climas
      .map(({ clima, dias: grupo }) => ({
        clima,
        media: mediaDoGrupo(grupo, prato.id),
      }))
      .sort((a, b) => b.media - a.media);

    return {
      pratoId: prato.id,
      nome: prato.nome,
      media: arredondar(geral),
      melhorDia: {
        dia: dias[0].dia,
        media: arredondar(dias[0].media),
        variacao: variacao(dias[0].media, geral),
      },
      melhorClima: {
        clima: porClima[0].clima,
        media: arredondar(porClima[0].media),
        variacao: variacao(porClima[0].media, geral),
      },
      efeitoChuva: efeitoDentroDoClima(prato.id, (d) => d.chuva),
      efeitoFeriado: efeitoDentroDoClima(prato.id, (d) => d.feriado),
      efeitoInicioMes: efeitoDentroDoClima(prato.id, (d) => d.inicioMes),
    };
  });
}

/**
 * Temperatura típica da época do ano, usada quando a data escolhida está
 * fora da janela de previsão do tempo (a Open-Meteo vai até 16 dias).
 * Tira a média dos dias do histórico próximos à mesma data no calendário.
 */
export function temperaturaTipicaPara(dataIso: string): number {
  const alvo = Number(dataIso.slice(5, 7)) * 31 + Number(dataIso.slice(8, 10));

  const proximos = HISTORICO.filter((d) => {
    const dia = Number(d.data.slice(5, 7)) * 31 + Number(d.data.slice(8, 10));
    const distancia = Math.abs(dia - alvo);
    // 372 = "ano" nessa escala aproximada; trata a virada de dezembro/janeiro.
    return Math.min(distancia, 372 - distancia) <= 7;
  });

  const base = proximos.length ? proximos : HISTORICO;
  return arredondar(media(base.map((d) => d.temperatura)));
}

/**
 * Pacote compacto enviado para a análise automática. Só números agregados:
 * nenhuma linha individual do histórico sai daqui.
 */
export function resumoDePadroes() {
  return {
    diasNoHistorico: HISTORICO.length,
    porDiaDaSemana: porDiaDaSemana(),
    porFaixaDeClima: porFaixaDeClima(),
    porCondicoesDoDia: porCondicoesDoDia(),
    porPrato: padroesPorPrato(),
  };
}
