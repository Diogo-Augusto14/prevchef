/**
 * Carrega os arquivos de dados SIMULADOS e expõe alguns utilitários de formato.
 *
 * Os JSON são importados direto no bundle: o protótipo não tem backend, tudo
 * roda no navegador.
 */

import estoqueJson from "@/data/estoque.json";
import pratosJson from "@/data/pratos.json";
import vendasJson from "@/data/vendas.json";
import type { ArquivoVendas, ItemEstoque, Prato, RegistroVenda } from "./tipos";

const arquivoVendas = vendasJson as unknown as ArquivoVendas;

export const HISTORICO: RegistroVenda[] = arquivoVendas.registros;
export const GERADO_EM = arquivoVendas.geradoEm;
export const PRATOS = pratosJson as unknown as Prato[];
export const ESTOQUE = estoqueJson as unknown as ItemEstoque[];
export const PRATO_IDS = PRATOS.map((p) => p.id);

export const NOMES_DIAS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

export const NOMES_DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function nomeDoPrato(id: string): string {
  return PRATOS.find((p) => p.id === id)?.nome ?? id;
}

/** Converte AAAA-MM-DD em Date no fuso UTC (evita deslocar o dia). */
export function paraData(dataIso: string): Date {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/** Formata AAAA-MM-DD como "12/05". */
export function dataCurta(dataIso: string): string {
  const [, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}`;
}

/** Formata AAAA-MM-DD como "12/05/2026". */
export function dataLonga(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Dia da semana (0–6) de uma data AAAA-MM-DD. */
export function diaSemanaDe(dataIso: string): number {
  return paraData(dataIso).getUTCDay();
}

/** Verdadeiro nos cinco primeiros dias do mês. */
export function inicioDoMes(dataIso: string): boolean {
  return Number(dataIso.slice(8, 10)) <= 5;
}

/** Diferença em dias inteiros entre duas datas AAAA-MM-DD. */
export function diasEntre(deIso: string, ateIso: string): number {
  return Math.round(
    (paraData(ateIso).getTime() - paraData(deIso).getTime()) / 86400000
  );
}

/** Soma dias a uma data AAAA-MM-DD. */
export function somarDias(dataIso: string, dias: number): string {
  return new Date(paraData(dataIso).getTime() + dias * 86400000)
    .toISOString()
    .slice(0, 10);
}

/**
 * Data AAAA-MM-DD de um instante no fuso local (toISOString daria a de UTC,
 * que no Brasil vira o dia seguinte a partir das 21h). Espera um instante;
 * um "AAAA-MM-DD" puro é lido como meia-noite UTC e voltaria um dia.
 */
export function dataLocal(momento: string | Date = new Date()): string {
  const d = new Date(momento);
  const doisDigitos = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
}

/** Último dia fechado do histórico simulado. */
export const ULTIMO_DIA = HISTORICO[HISTORICO.length - 1]?.data ?? GERADO_EM;

/**
 * Dia que o painel abre por padrão: o primeiro ainda não vendido.
 * É derivado dos dados (e não do relógio) para que servidor e navegador
 * renderizem exatamente a mesma tela.
 */
export const DIA_PADRAO = somarDias(ULTIMO_DIA, 1);

export const numero = (v: number, casas = 1) =>
  v.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });

/** Quantidade com unidade: "180 un", mas "2,50 kg". */
export const quantidade = (v: number, unidade: string) =>
  `${numero(v, unidade === "un" ? 0 : 2)} ${unidade}`;

/** Minutos como "45 min", "2 h 15 min", "2 h" ou "2 dias". */
export function duracao(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  if (m < 1440) {
    const horas = Math.floor(m / 60);
    const resto = m % 60;
    return resto ? `${horas} h ${resto} min` : `${horas} h`;
  }
  const dias = Math.floor(m / 1440);
  return dias === 1 ? "1 dia" : `${dias} dias`;
}

export const dinheiro = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
