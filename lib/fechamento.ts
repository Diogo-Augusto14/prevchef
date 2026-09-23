/**
 * Fechamento do dia: o serviço vira histórico.
 *
 * Até aqui o modelo aprendia só do arquivo — um passado congelado que nunca
 * crescia. Fechar o dia apura o que realmente saiu, monta um registro no
 * mesmo formato do histórico e devolve para o KNN. A partir do dia seguinte,
 * o serviço de hoje é um dos dias que o modelo pode consultar.
 *
 * É também o momento de comparar previsto com realizado, que é como se
 * descobre se o modelo está servindo ou não.
 */

import {
  PRATOS,
  PRATO_IDS,
  dataLocal,
  diaSemanaDe,
  inicioDoMes,
} from "./dados";
import { HORAS_DE_SERVICO } from "./restaurante";
import type { Cenario, ContaFechada, RegistroVenda } from "./tipos";
import type { PrevisaoDePrato } from "./previsao";

export type ComparacaoDoPrato = {
  pratoId: string;
  nome: string;
  previsto: number;
  realizado: number;
  /** Realizado menos previsto, em porções. */
  erro: number;
  dentroDaFaixa: boolean;
};

export type ApuracaoDoDia = {
  data: string;
  registro: RegistroVenda;
  pratos: ComparacaoDoPrato[];
  porcoesPrevistas: number;
  porcoesRealizadas: number;
  /** Erro absoluto médio do dia, em porções por prato. */
  maeDoDia: number;
  pessoas: number;
  faturamento: number;
  contas: number;
};

const arredondar = (v: number, casas = 1) => {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
};

/** Porções efetivamente vendidas, por prato. */
export function vendasApuradas(contas: ContaFechada[]): Record<string, number> {
  const vendas: Record<string, number> = {};
  for (const id of PRATO_IDS) vendas[id] = 0;

  for (const conta of contas) {
    for (const item of conta.itens) {
      vendas[item.pratoId] = (vendas[item.pratoId] ?? 0) + item.quantidade;
    }
  }

  return vendas;
}

/**
 * Pessoas que chegaram em cada hora de serviço.
 * A hora vem de quando a mesa sentou, não de quando a conta fechou.
 */
export function chegadasApuradas(contas: ContaFechada[]): number[] {
  const porHora = HORAS_DE_SERVICO.map(() => 0);

  for (const conta of contas) {
    const hora = new Date(conta.abertaEm).getHours();
    const i = HORAS_DE_SERVICO.indexOf(hora);
    // Quem sentou fora do horário de serviço entra na ponta mais próxima.
    const destino =
      i >= 0 ? i : hora < HORAS_DE_SERVICO[0] ? 0 : HORAS_DE_SERVICO.length - 1;
    porHora[destino] += conta.pessoas;
  }

  return porHora;
}

/** Apura o dia e monta o registro que entra no histórico. */
export function apurarODia(
  contas: ContaFechada[],
  data: string,
  cenario: Cenario,
  previsoes: PrevisaoDePrato[]
): ApuracaoDoDia {
  const vendas = vendasApuradas(contas);

  const registro: RegistroVenda = {
    data,
    diaSemana: diaSemanaDe(data),
    diaSemanaNome: [
      "domingo",
      "segunda",
      "terça",
      "quarta",
      "quinta",
      "sexta",
      "sábado",
    ][diaSemanaDe(data)],
    temperatura: cenario.temperatura,
    chuva: cenario.chuva,
    feriado: cenario.feriado,
    inicioMes: inicioDoMes(data),
    vendas,
    chegadasPorHora: chegadasApuradas(contas),
  };

  const pratos: ComparacaoDoPrato[] = PRATOS.map((prato) => {
    const previsao = previsoes.find((p) => p.pratoId === prato.id);
    const previsto = previsao?.previsao ?? 0;
    const realizado = vendas[prato.id] ?? 0;

    return {
      pratoId: prato.id,
      nome: prato.nome,
      previsto,
      realizado,
      erro: arredondar(realizado - previsto),
      dentroDaFaixa: previsao
        ? realizado >= previsao.minimo && realizado <= previsao.maximo
        : false,
    };
  });

  const porcoesPrevistas = pratos.reduce((s, p) => s + p.previsto, 0);
  const porcoesRealizadas = pratos.reduce((s, p) => s + p.realizado, 0);

  return {
    data,
    registro,
    pratos,
    porcoesPrevistas: arredondar(porcoesPrevistas),
    porcoesRealizadas,
    maeDoDia: pratos.length
      ? arredondar(
          pratos.reduce((s, p) => s + Math.abs(p.erro), 0) / pratos.length,
          2
        )
      : 0,
    pessoas: contas.reduce((s, c) => s + c.pessoas, 0),
    faturamento: Math.round(contas.reduce((s, c) => s + c.total, 0) * 100) / 100,
    contas: contas.length,
  };
}

/** Contas fechadas numa data (AAAA-MM-DD), pelo relógio local. */
export function contasDoDia(
  contas: ContaFechada[],
  data: string
): ContaFechada[] {
  return contas.filter((c) => dataLocal(c.fechadaEm) === data);
}
