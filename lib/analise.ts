/**
 * Monta o pacote que vai para a análise automática e chama o route handler.
 *
 * Nada aqui depende de o usuário escrever uma pergunta: o painel chama esta
 * função sozinho sempre que o cenário do dia muda.
 */

import type { AnaliseDoDia } from "@/app/api/analise/route";
import { NOMES_DIAS, dataLonga, nomeDoPrato, quantidade } from "./dados";
import { faixaDeClima, type Local, type PrevisaoDoTempo } from "./clima";
import { K_PADRAO } from "./knn";
import {
  mediaEmDiasParecidos,
  padroesPorPrato,
  porDiaDaSemana,
} from "./padroes";
import { DIAS_ALERTA_VALIDADE, estoqueComValidade, type ResumoDoDia } from "./previsao";
import type { ItemEstoque } from "./tipos";

export type { AnaliseDoDia };

function venceEm(dias: number): string {
  if (dias === 0) return "vence hoje";
  return `vence em ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

/** Troca as chaves de id do prato pelo nome, como no resto do pacote. */
function porNomeDoPrato(valores: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(valores).map(([id, v]) => [nomeDoPrato(id), v])
  );
}

/**
 * Recorta do histórico só o que interessa para o dia consultado, em vez de
 * despejar tudo no prompt.
 *
 * `estoque`: o do momento, o mesmo que gerou o resumo.
 * `climaIndisponivel`: a busca do tempo falhou (não é data fora da janela).
 */
export function montarPayloadDaAnalise(
  resumo: ResumoDoDia,
  local: Local,
  tempo: PrevisaoDoTempo | null,
  estoque: ItemEstoque[],
  climaIndisponivel = false
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

  // Lote zerado (vendido ou descartado) não é mais assunto.
  const itensDoEstoque = estoqueComValidade(resumo.dataAlvo, estoque).filter(
    (i) => i.quantidade > 0
  );

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
          fonte: climaIndisponivel
            ? "previsão do tempo indisponível agora, usando a média histórica da época"
            : "sem previsão para esta data (fora da janela da Open-Meteo)",
          temperaturaMedia: resumo.cenario.temperatura,
          classificacao: faixa,
        },
    previsaoDoModelo: {
      metodo: `KNN de regressão, K=${K_PADRAO}, sobre o histórico simulado mais os dias fechados`,
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
    oQueEComumVender: {
      nota: "Os efeitos percentuais são medidos dentro da mesma faixa de temperatura, para não confundir o efeito da chuva com o do calor.",
      mediaNesteDiaDaSemana: mediaDoDia && porNomeDoPrato(mediaDoDia.porPrato),
      mediaEmDiasAssim: {
        recorte: `${diasAssim.condicao} (${diasAssim.dias} dias no histórico)`,
        porPrato: porNomeDoPrato(diasAssim.porPrato),
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
      vencidos: itensDoEstoque
        .filter((i) => i.diasParaVencer < 0)
        .map((i) => `${i.nome}: ${quantidade(i.quantidade, i.unidade)}`),
      pertoDeVencer: itensDoEstoque
        .filter(
          (i) => i.diasParaVencer >= 0 && i.diasParaVencer <= DIAS_ALERTA_VALIDADE
        )
        .map(
          (i) =>
            `${i.nome}: ${quantidade(i.quantidade, i.unidade)}, ${venceEm(i.diasParaVencer)}, usado em ${i.usadoEm.join(" e ")}`
        ),
    },
    listaDeCompras: {
      custoTotal: resumo.custoDaCompra,
      itens: resumo.compras
        .filter((c) => c.comprar > 0)
        .slice(0, 8)
        // "un" arredonda para cima, como na lista da tela: não se compra meio ovo.
        .map(
          (c) =>
            `${c.nome}: comprar ${quantidade(c.unidade === "un" ? Math.ceil(c.comprar) : c.comprar, c.unidade)}`
        ),
    },
    pratoDoDiaSugeridoPeloSistema: resumo.pratoDoDia
      ? `${resumo.pratoDoDia.nome} (aproveita ${resumo.pratoDoDia.ingrediente}, ${venceEm(resumo.pratoDoDia.diasParaVencer)})`
      : null,
  };
}

export type EstadoDaAnalise =
  | { estado: "ocioso" }
  | { estado: "carregando" }
  /** `salvaEm`: quando a leitura foi guardada neste navegador, em ISO. */
  | { estado: "pronto"; analise: AnaliseDoDia; salvaEm?: string }
  | { estado: "erro"; mensagem: string; configuracaoAusente?: boolean };

/* ------------------------------------------------------------------ */
/* Leitura guardada                                                    */
/* ------------------------------------------------------------------ */

/*
 * A leitura de um dia não muda a cada recarga da página, e cada chamada à
 * IA custa. Então a primeira leitura bem-sucedida de um dia fica guardada
 * no navegador e as próximas aberturas usam ela. Erro nunca é guardado.
 */
const CHAVE_DAS_LEITURAS = "prevchef:leituras:v1";
const LEITURAS_GUARDADAS = 30;

type LeituraGuardada = { analise: AnaliseDoDia; salvaEm: string };

/** Uma leitura por dia e por lugar: o clima de outra cidade é outra leitura. */
export function chaveDaLeitura(data: string, local: Local): string {
  return `${data}|${local.nome}`;
}

function lerLeituras(): Record<string, LeituraGuardada> {
  try {
    const bruto = window.localStorage.getItem(CHAVE_DAS_LEITURAS);
    const lido = bruto ? JSON.parse(bruto) : null;
    return lido && typeof lido === "object" ? lido : {};
  } catch {
    return {}; // localStorage bloqueado ou conteúdo inválido: sem leituras.
  }
}

export function leituraGuardada(chave: string): LeituraGuardada | null {
  const leitura = lerLeituras()[chave];
  const valida =
    leitura &&
    typeof leitura.salvaEm === "string" &&
    typeof leitura.analise?.resumo === "string" &&
    Array.isArray(leitura.analise?.sugestoes);
  return valida ? leitura : null;
}

/** Guarda a leitura e devolve o instante em que ela foi guardada. */
export function guardarLeitura(chave: string, analise: AnaliseDoDia): string {
  const salvaEm = new Date().toISOString();
  const leituras = { ...lerLeituras(), [chave]: { analise, salvaEm } };

  // Só as mais recentes: dia que já passou não volta a ser consultado.
  const mantidas = Object.fromEntries(
    Object.entries(leituras)
      .sort(([, a], [, b]) => b.salvaEm.localeCompare(a.salvaEm))
      .slice(0, LEITURAS_GUARDADAS)
  );

  try {
    window.localStorage.setItem(CHAVE_DAS_LEITURAS, JSON.stringify(mantidas));
  } catch {
    // Sem espaço ou sem permissão: a leitura vale só até recarregar.
  }
  return salvaEm;
}

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
