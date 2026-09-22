/**
 * Monta o pacote que vai para a análise automática e chama o route handler.
 *
 * Nada aqui depende de o usuário escrever uma pergunta: o painel chama esta
 * função sozinho sempre que o cenário do dia muda.
 */

import type { AnaliseDoDia } from "@/app/api/analise/route";
import { NOMES_DIAS, dataLonga } from "./dados";
import { faixaDeClima, type Local, type PrevisaoDoTempo } from "./clima";
import {
  mediaEmDiasParecidos,
  padroesPorPrato,
  porDiaDaSemana,
} from "./padroes";
import { DIAS_ALERTA_VALIDADE, estoqueComValidade, type ResumoDoDia } from "./previsao";

export type { AnaliseDoDia };

/**
 * Recorta do histórico só o que interessa para o dia consultado, em vez de
 * despejar tudo no prompt.
 */
export function montarPayloadDaAnalise(
  resumo: ResumoDoDia,
  local: Local,
  tempo: PrevisaoDoTempo | null
) {
  const faixa = faixaDeClima(resumo.cenario.temperatura);
  const diaDaSemana = NOMES_DIAS[resumo.cenario.diaSemana];

  const mediaDoDia = porDiaDaSemana().find((m) => m.condicao === diaDaSemana);
  // Clima e chuva juntos: separados, o número engana, porque no histórico
  // chove mais nos dias quentes.
  const diasAssim = mediaEmDiasParecidos(
    resumo.cenario.temperatura,
    resumo.cenario.chuva
  );

  const estoque = estoqueComValidade(resumo.dataAlvo);

  return {
    aviso:
      "Histórico, fichas técnicas e estoque são SIMULADOS. A previsão do tempo é real.",
    dia: {
      data: dataLonga(resumo.dataAlvo),
      diaDaSemana,
      feriado: resumo.cenario.feriado,
      inicioDoMes: resumo.cenario.inicioMes,
    },
    climaReal: tempo
      ? {
          cidade: local.nome,
          fonte: "Open-Meteo",
          temperaturaMedia: tempo.temperatura,
          temperaturaMinima: tempo.temperaturaMinima,
          temperaturaMaxima: tempo.temperaturaMaxima,
          chanceDeChuvaPercentual: tempo.chanceDeChuva,
          chuvaMilimetros: tempo.chuvaMm,
          classificacao: faixa,
        }
      : {
          cidade: local.nome,
          fonte: "sem previsão para esta data (fora da janela da Open-Meteo)",
          temperaturaMedia: resumo.cenario.temperatura,
          classificacao: faixa,
        },
    previsaoDoModelo: {
      metodo: "KNN de regressão, K=5, sobre 365 dias simulados",
      totalDePorcoes: resumo.totalPorcoes,
      faturamentoEstimado: resumo.faturamentoEstimado,
      pratos: resumo.previsoes.map((p) => ({
        prato: p.nome,
        porcoesPrevistas: p.previsao,
        faixaMinima: p.minimo,
        faixaMaxima: p.maximo,
        mediaHistoricaDoMesmoDiaDaSemana: p.mediaDoDiaSemana,
        variacaoPercentual: p.variacao,
      })),
    },
    oQueECommumVender: {
      nota: "Os efeitos percentuais são medidos dentro da mesma faixa de temperatura, para não confundir o efeito da chuva com o do calor.",
      mediaNesteDiaDaSemana: mediaDoDia?.porPrato,
      mediaEmDiasAssim: {
        recorte: `${diasAssim.condicao} (${diasAssim.dias} dias no histórico)`,
        porPrato: diasAssim.porPrato,
      },
      porPrato: padroesPorPrato().map((p) => ({
        prato: p.nome,
        mediaDiaria: p.media,
        vendeMaisEm: `${p.melhorDia.dia} (${p.melhorDia.variacao > 0 ? "+" : ""}${p.melhorDia.variacao}%)`,
        climaFavorito: `${p.melhorClima.clima} (${p.melhorClima.variacao > 0 ? "+" : ""}${p.melhorClima.variacao}%)`,
        efeitoDaChuvaPercentual: p.efeitoChuva,
        efeitoDoFeriadoPercentual: p.efeitoFeriado,
        efeitoDoInicioDoMesPercentual: p.efeitoInicioMes,
      })),
    },
    estoque: {
      vencidos: estoque
        .filter((i) => i.diasParaVencer < 0)
        .map((i) => `${i.nome}: ${i.quantidade} ${i.unidade}`),
      pertoDeVencer: estoque
        .filter(
          (i) => i.diasParaVencer >= 0 && i.diasParaVencer <= DIAS_ALERTA_VALIDADE
        )
        .map(
          (i) =>
            `${i.nome}: ${i.quantidade} ${i.unidade}, vence em ${i.diasParaVencer} dia(s), usado em ${i.usadoEm.join(" e ")}`
        ),
    },
    listaDeCompras: {
      custoTotal: resumo.custoDaCompra,
      itens: resumo.compras
        .filter((c) => c.comprar > 0)
        .slice(0, 8)
        .map((c) => `${c.nome}: comprar ${c.comprar} ${c.unidade}`),
    },
    pratoDoDiaSugeridoPeloSistema: resumo.pratoDoDia
      ? `${resumo.pratoDoDia.nome} (aproveita ${resumo.pratoDoDia.ingrediente}, vence em ${resumo.pratoDoDia.diasParaVencer} dia(s))`
      : null,
  };
}

export type EstadoDaAnalise =
  | { estado: "ocioso" }
  | { estado: "carregando" }
  | { estado: "pronto"; analise: AnaliseDoDia }
  | { estado: "erro"; mensagem: string; configuracaoAusente?: boolean };

/** Chama o route handler. O erro volta tratado para a tela não quebrar. */
export async function pedirAnalise(
  payload: ReturnType<typeof montarPayloadDaAnalise>,
  sinal?: AbortSignal
): Promise<EstadoDaAnalise> {
  try {
    const resposta = await fetch("/api/analise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: sinal,
    });

    const corpo = await resposta.json().catch(() => null);

    if (!resposta.ok) {
      return {
        estado: "erro",
        mensagem: corpo?.error ?? `A análise falhou (${resposta.status}).`,
        configuracaoAusente: Boolean(corpo?.configuracaoAusente),
      };
    }

    return { estado: "pronto", analise: corpo as AnaliseDoDia };
  } catch (erro) {
    if (erro instanceof DOMException && erro.name === "AbortError") {
      return { estado: "carregando" };
    }
    return {
      estado: "erro",
      mensagem: "Não foi possível falar com a IA. Verifique a conexão.",
    };
  }
}
