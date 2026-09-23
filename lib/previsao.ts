/**
 * Camada que transforma a saída do KNN em informação de gerente:
 * lista de compras, prato do dia e alertas.
 */

import {
  ESTOQUE,
  HISTORICO,
  PRATOS,
  PRATO_IDS,
  dataLonga,
  diasEntre,
  nomeDoPrato,
  quantidade,
} from "./dados";
import { K_PADRAO, preverPratos, type ResultadoPrevisao, type Vizinho } from "./knn";
import { mediasPorDiaSemana } from "./mae";
import { preverChegadas, type PrevisaoDeChegada } from "./chegadas";
import type { Cenario, ItemEstoque, RegistroVenda } from "./tipos";

/** Quantos dias antes do vencimento já consideramos "perto de vencer". */
export const DIAS_ALERTA_VALIDADE = 3;

export type PrevisaoDePrato = ResultadoPrevisao & {
  nome: string;
  precoVenda: number;
  /** Média histórica do mesmo dia da semana, para comparação. */
  mediaDoDiaSemana: number;
  /** Variação percentual da previsão sobre essa média. */
  variacao: number;
  /** Largura da faixa dividida pela previsão — quanto maior, mais incerto. */
  incerteza: number;
};

export type ItemCompra = {
  id: string;
  nome: string;
  unidade: string;
  /** Consumo previsto somando todos os pratos. */
  necessario: number;
  /** Quantidade que consta na câmara, vencida ou não. */
  emEstoque: number;
  /** O que dá para usar no dia (zero se já estiver vencido). */
  disponivel: number;
  vencido: boolean;
  /** Quanto falta comprar (nunca negativo). */
  comprar: number;
  custoEstimado: number;
  validade: string | null;
  diasParaVencer: number | null;
};

export type Alerta = {
  nivel: "alto" | "medio" | "info";
  titulo: string;
  detalhe: string;
};

export type PratoDoDia = {
  pratoId: string;
  nome: string;
  ingrediente: string;
  diasParaVencer: number;
  quantidadeEmEstoque: number;
  unidade: string;
  porcoesPrevistas: number;
} | null;

export type ResumoDoDia = {
  cenario: Cenario;
  dataAlvo: string;
  previsoes: PrevisaoDePrato[];
  /** Os K dias parecidos usados (são os mesmos para todos os pratos). */
  diasParecidos: Vizinho[];
  /** Curva de chegada por hora, tirada dos mesmos vizinhos. */
  chegadas: PrevisaoDeChegada;
  compras: ItemCompra[];
  pratoDoDia: PratoDoDia;
  alertas: Alerta[];
  totalPorcoes: number;
  faturamentoEstimado: number;
  custoDaCompra: number;
};

const arredondar = (v: number, casas = 2) => {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
};

/** Monta o resumo completo do dia a partir do cenário escolhido na tela. */
export function gerarResumoDoDia(
  cenario: Cenario,
  dataAlvo: string,
  k: number = K_PADRAO,
  /** Estoque do momento. Sem isso, usa a carga inicial do arquivo. */
  estoque: ItemEstoque[] = ESTOQUE,
  /** Histórico do modelo. Cresce a cada dia fechado. */
  historico: RegistroVenda[] = HISTORICO,
  /** Preços de venda do dia. Sem isso, usa o preço do arquivo. */
  precos?: Record<string, number>
): ResumoDoDia {
  /*
   * O modelo só pode olhar para trás.
   *
   * Depois que um dia é fechado, ele entra no histórico — e se fosse
   * consultável, prever esse mesmo dia acharia um vizinho de distância zero
   * e o "acerto" seria só a resposta sendo lida de volta. Vazamento do
   * futuro. Aqui o corte é explícito: nada do próprio dia nem de depois.
   */
  const passado = historico.filter((r) => r.data < dataAlvo);
  const brutas = preverPratos(passado, cenario, PRATO_IDS, k);

  const previsoes: PrevisaoDePrato[] = brutas.map((r) => {
    const prato = PRATOS.find((p) => p.id === r.pratoId)!;
    const mediaSemana = mediasPorDiaSemana(passado, r.pratoId)[cenario.diaSemana];
    return {
      ...r,
      nome: prato.nome,
      precoVenda: precos?.[prato.id] ?? prato.precoVenda,
      mediaDoDiaSemana: arredondar(mediaSemana, 1),
      variacao: mediaSemana ? arredondar(((r.previsao - mediaSemana) / mediaSemana) * 100, 0) : 0,
      incerteza: r.previsao ? arredondar((r.maximo - r.minimo) / r.previsao, 2) : 0,
    };
  });

  const diasParecidos = brutas[0]?.vizinhos ?? [];
  const compras = montarListaDeCompras(previsoes, dataAlvo, estoque);
  const pratoDoDia = escolherPratoDoDia(previsoes, dataAlvo, estoque);

  const totalPorcoes = previsoes.reduce((s, p) => s + p.previsao, 0);
  const faturamentoEstimado = previsoes.reduce(
    (s, p) => s + p.previsao * p.precoVenda,
    0
  );
  const custoDaCompra = compras.reduce((s, c) => s + c.custoEstimado, 0);

  return {
    cenario,
    dataAlvo,
    previsoes,
    diasParecidos,
    chegadas: preverChegadas(diasParecidos),
    compras,
    pratoDoDia,
    alertas: montarAlertas(previsoes, compras, cenario, dataAlvo, estoque),
    totalPorcoes: arredondar(totalPorcoes, 1),
    faturamentoEstimado: arredondar(faturamentoEstimado, 2),
    custoDaCompra: arredondar(custoDaCompra, 2),
  };
}

/* ------------------------------------------------------------------ */
/* Lista de compras: previsão x ficha técnica - estoque                */
/* ------------------------------------------------------------------ */

export function montarListaDeCompras(
  previsoes: PrevisaoDePrato[],
  dataAlvo: string,
  estoque: ItemEstoque[] = ESTOQUE
): ItemCompra[] {
  const necessarioPorIngrediente = new Map<string, number>();

  for (const previsao of previsoes) {
    const prato = PRATOS.find((p) => p.id === previsao.pratoId);
    if (!prato) continue;
    for (const ing of prato.ingredientes) {
      const atual = necessarioPorIngrediente.get(ing.id) ?? 0;
      necessarioPorIngrediente.set(
        ing.id,
        atual + ing.quantidadePorPorcao * previsao.previsao
      );
    }
  }

  const itens: ItemCompra[] = [];

  for (const [id, necessarioBruto] of necessarioPorIngrediente) {
    const item = estoque.find((e) => e.id === id);
    const necessario = arredondar(necessarioBruto, 2);
    const emEstoque = item?.quantidade ?? 0;
    const diasParaVencer = item ? diasEntre(dataAlvo, item.validade) : null;
    // O que já venceu no dia do serviço não conta como disponível.
    const vencido = diasParaVencer !== null && diasParaVencer < 0;
    const disponivel = vencido ? 0 : emEstoque;
    const comprar = arredondar(Math.max(0, necessario - disponivel), 2);
    const referencia = PRATOS.flatMap((p) => p.ingredientes).find((i) => i.id === id);

    itens.push({
      id,
      nome: item?.nome ?? referencia?.nome ?? id,
      unidade: item?.unidade ?? referencia?.unidade ?? "un",
      necessario,
      emEstoque,
      disponivel,
      vencido,
      comprar,
      custoEstimado: arredondar(comprar * (item?.custoUnitario ?? 0), 2),
      validade: item?.validade ?? null,
      diasParaVencer,
    });
  }

  // Primeiro o que precisa comprar mais caro; depois o que já está coberto.
  return itens.sort(
    (a, b) => b.custoEstimado - a.custoEstimado || b.comprar - a.comprar || a.nome.localeCompare(b.nome)
  );
}

/* ------------------------------------------------------------------ */
/* Prato do dia                                                       */
/* ------------------------------------------------------------------ */

/**
 * Sugere como prato do dia aquele que usa o ingrediente mais perto de vencer
 * (entre os que ainda estão dentro da validade e têm estoque).
 */
export function escolherPratoDoDia(
  previsoes: PrevisaoDePrato[],
  dataAlvo: string,
  estoque: ItemEstoque[] = ESTOQUE
): PratoDoDia {
  const candidatos = estoque.map((item) => ({
    item,
    dias: diasEntre(dataAlvo, item.validade),
  }))
    .filter(({ item, dias }) => item.quantidade > 0 && dias >= 0)
    .sort((a, b) => a.dias - b.dias);

  for (const { item, dias } of candidatos) {
    const pratosComOIngrediente = PRATOS.filter((p) =>
      p.ingredientes.some((i) => i.id === item.id)
    );
    if (pratosComOIngrediente.length === 0) continue;

    // Entre os pratos que usam o ingrediente, o de maior saída prevista.
    const escolhido = pratosComOIngrediente
      .map((p) => ({
        prato: p,
        previsao: previsoes.find((x) => x.pratoId === p.id)?.previsao ?? 0,
      }))
      .sort((a, b) => b.previsao - a.previsao)[0];

    return {
      pratoId: escolhido.prato.id,
      nome: escolhido.prato.nome,
      ingrediente: item.nome,
      diasParaVencer: dias,
      quantidadeEmEstoque: item.quantidade,
      unidade: item.unidade,
      porcoesPrevistas: escolhido.previsao,
    };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Alertas                                                             */
/* ------------------------------------------------------------------ */

function montarAlertas(
  previsoes: PrevisaoDePrato[],
  compras: ItemCompra[],
  cenario: Cenario,
  dataAlvo: string,
  estoque: ItemEstoque[] = ESTOQUE
): Alerta[] {
  const alertas: Alerta[] = [];

  // Vencidos entram num alerta só, senão a lista vira ruído.
  const vencidos = estoque.filter((e) => diasEntre(dataAlvo, e.validade) < 0);
  if (vencidos.length > 0) {
    alertas.push({
      nivel: "alto",
      titulo:
        vencidos.length === 1
          ? `${vencidos[0].nome} vencido`
          : `${vencidos.length} itens vencidos no dia escolhido`,
      detalhe: `Retirar do estoque antes do serviço: ${vencidos
        .map((e) => `${e.nome} (${dataLonga(e.validade)})`)
        .join(", ")}. ${vencidos.length === 1 ? "Já foi descontado" : "Já foram descontados"} da lista de compras.`,
    });
  }

  const vencendo = estoque.map((e) => ({ e, dias: diasEntre(dataAlvo, e.validade) }))
    .filter(({ dias }) => dias >= 0 && dias <= DIAS_ALERTA_VALIDADE)
    .sort((a, b) => a.dias - b.dias);
  for (const { e, dias } of vencendo.slice(0, 3)) {
    alertas.push({
      nivel: dias <= 1 ? "alto" : "medio",
      titulo: `${e.nome} vence ${dias === 0 ? "no dia" : `em ${dias} dia${dias > 1 ? "s" : ""}`}`,
      detalhe: `${quantidade(e.quantidade, e.unidade)} em estoque. Priorizar no cardápio ou transformar em promoção.`,
    });
  }
  if (vencendo.length > 3) {
    const n = vencendo.length - 3;
    alertas.push({
      nivel: "info",
      titulo: `Mais ${n} ${n === 1 ? "item" : "itens"} perto do vencimento`,
      detalhe: `Ver a tela de Estoque: ${vencendo
        .slice(3)
        .map(({ e }) => e.nome)
        .join(", ")}.`,
    });
  }

  // Os três buracos maiores: o que falta em proporção ao que será usado.
  const proporcaoQueFalta = (c: ItemCompra) => c.comprar / Math.max(c.necessario, 0.01);
  const faltando = compras
    .filter((c) => c.comprar > 0)
    .sort((a, b) => proporcaoQueFalta(b) - proporcaoQueFalta(a))
    .slice(0, 3);
  for (const item of faltando) {
    const cobertura = item.necessario ? (item.disponivel / item.necessario) * 100 : 100;
    alertas.push({
      nivel: cobertura < 50 ? "alto" : "medio",
      titulo: `Falta ${item.nome}`,
      detalhe: `O estoque cobre ${Math.round(cobertura)}% do previsto. Comprar ${quantidade(item.unidade === "un" ? Math.ceil(item.comprar) : item.comprar, item.unidade)}.`,
    });
  }

  const incertos = previsoes.filter((p) => p.incerteza > 0.6);
  for (const p of incertos) {
    alertas.push({
      nivel: "info",
      titulo: `Previsão instável para ${p.nome}`,
      detalhe: `Os dias parecidos variaram de ${p.minimo} a ${p.maximo} porções. Vale produzir em duas levas.`,
    });
  }

  if (cenario.feriado) {
    alertas.push({
      nivel: "info",
      titulo: "Feriado",
      detalhe: "Feriados costumam puxar o movimento para cima no histórico simulado. Reforce a escala.",
    });
  }
  if (cenario.chuva) {
    alertas.push({
      nivel: "info",
      titulo: "Previsão de chuva",
      detalhe: "Com chuva, saem mais pratos quentes e menos salada. Vale reforçar a entrega.",
    });
  }

  return alertas;
}

/** Itens de estoque com os dias restantes até a validade, para a tela Estoque. */
export function estoqueComValidade(
  dataBase: string,
  estoque: ItemEstoque[] = ESTOQUE
): (ItemEstoque & {
  diasParaVencer: number;
  usadoEm: string[];
})[] {
  return estoque.map((item) => ({
    ...item,
    diasParaVencer: diasEntre(dataBase, item.validade),
    usadoEm: PRATOS.filter((p) => p.ingredientes.some((i) => i.id === item.id)).map(
      (p) => nomeDoPrato(p.id)
    ),
  })).sort((a, b) => a.diasParaVencer - b.diasParaVencer);
}
