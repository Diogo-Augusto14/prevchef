"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { AvisoSimulado, Cartao, Etiqueta } from "../components/ui";
import { HISTORICO, PRATOS, PRATO_IDS, dataLonga, numero } from "@/lib/dados";
import {
  KS_AVALIADOS,
  avaliar,
  serieComparacao,
  type Avaliacao,
  type PontoComparacao,
} from "@/lib/mae";

const GraficoDesempenho = dynamic(() => import("../components/GraficoDesempenho"), {
  ssr: false,
  loading: () => (
    <div className="flex h-80 items-center justify-center text-sm text-slate-400">
      Montando o gráfico…
    </div>
  ),
});

export default function DesempenhoPage() {
  // A avaliação varre o histórico inteiro; roda depois da montagem para não
  // travar a primeira pintura da tela.
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const [pratoSelecionado, setPratoSelecionado] = useState<string>("todos");
  const [k, setK] = useState(5);

  useEffect(() => {
    setAvaliacao(avaliar(HISTORICO, PRATO_IDS));
  }, []);

  const serie: PontoComparacao[] = useMemo(
    () => serieComparacao(HISTORICO, PRATO_IDS, pratoSelecionado, k),
    [pratoSelecionado, k]
  );

  const erroMedioDaSerie = useMemo(() => {
    if (serie.length === 0) return 0;
    const soma = serie.reduce((s, p) => s + Math.abs(p.previsto - p.real), 0);
    return soma / serie.length;
  }, [serie]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Desempenho do modelo
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Treino nos 10 primeiros meses, teste nos 2 últimos. O modelo nunca vê
            os dias de teste antes de prever.
          </p>
        </div>
        <AvisoSimulado />
      </div>

      {avaliacao && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Resumo
            rotulo="Treino"
            valor={`${avaliacao.particao.treino.dias} dias`}
            detalhe={`${dataLonga(avaliacao.particao.treino.inicio)} a ${dataLonga(
              avaliacao.particao.treino.fim
            )}`}
          />
          <Resumo
            rotulo="Teste"
            valor={`${avaliacao.particao.teste.dias} dias`}
            detalhe={`${dataLonga(avaliacao.particao.teste.inicio)} a ${dataLonga(
              avaliacao.particao.teste.fim
            )}`}
          />
          <Resumo
            rotulo="Melhor resultado"
            valor={`MAE ${numero(avaliacao.melhorKnn.geral, 2)}`}
            detalhe={`${avaliacao.melhorKnn.metodo} — erra ${numero(
              Math.abs(avaliacao.ganhoPercentual),
              1
            )}% ${
              avaliacao.ganhoPercentual >= 0 ? "menos" : "mais"
            } que a média do dia da semana`}
          />
        </div>
      )}

      <Cartao
        titulo="Previsto × real no período de teste"
        descricao="Cada ponto é um dia que o modelo não viu no treino."
        acao={
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-slate-500">
              <span className="mb-1 block font-medium uppercase tracking-wide">
                Prato
              </span>
              <select
                value={pratoSelecionado}
                onChange={(e) => setPratoSelecionado(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
              >
                <option value="todos">Todos os pratos</option>
                {PRATOS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              <span className="mb-1 block font-medium uppercase tracking-wide">
                K
              </span>
              <select
                value={k}
                onChange={(e) => setK(Number(e.target.value))}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
              >
                {KS_AVALIADOS.map((valor) => (
                  <option key={valor} value={valor}>
                    K = {valor}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
      >
        <GraficoDesempenho serie={serie} />
        <p className="mt-3 text-sm text-slate-500">
          Erro médio nesta seleção:{" "}
          <strong className="tabular font-semibold text-slate-700">
            {numero(erroMedioDaSerie, 2)} porções por dia
          </strong>{" "}
          {pratoSelecionado === "todos"
            ? "(somando os cinco pratos)"
            : `(apenas ${PRATOS.find((p) => p.id === pratoSelecionado)?.nome})`}
          .
        </p>
      </Cartao>

      <Cartao
        titulo="MAE por método"
        descricao="Erro absoluto médio em porções por dia — quanto menor, melhor. Em verde, o melhor de cada coluna."
      >
        {!avaliacao ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Calculando o erro em todos os dias de teste…
          </p>
        ) : (
          <TabelaMae avaliacao={avaliacao} />
        )}
      </Cartao>

      <Cartao titulo="Como ler estes números">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
          <li>
            <strong>MAE</strong> é a média de quanto a previsão erra, em porções,
            em cada dia de teste. MAE 4 significa errar quatro porções para mais
            ou para menos, na média.
          </li>
          <li>
            A linha <strong>média do mesmo dia da semana</strong> é a régua: é o
            que o gerente já faria de cabeça. O KNN só se paga se ficar abaixo
            dela.
          </li>
          <li>
            K baixo deixa o modelo mais sensível a um dia atípico; K alto suaviza
            demais e perde os picos. Por isso comparamos K = 3, 5 e 7.
          </li>
          <li>
            Os dados são simulados com padrões conhecidos (sábado, frio, calor,
            feriado, início do mês), então o erro aqui é otimista em relação a um
            restaurante real.
          </li>
        </ul>
      </Cartao>
    </div>
  );
}

function TabelaMae({ avaliacao }: { avaliacao: Avaliacao }) {
  const melhorPorPrato: Record<string, number> = {};
  for (const id of PRATO_IDS) {
    melhorPorPrato[id] = Math.min(...avaliacao.linhas.map((l) => l.porPrato[id]));
  }
  const melhorGeral = Math.min(...avaliacao.linhas.map((l) => l.geral));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-3 font-medium">Método</th>
            {PRATOS.map((p) => (
              <th key={p.id} className="py-2 pr-3 text-right font-medium">
                {p.nome}
              </th>
            ))}
            <th className="py-2 text-right font-medium">Geral</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {avaliacao.linhas.map((linha) => {
            const referencia = linha.metodo === avaliacao.referencia.metodo;
            return (
              <tr key={linha.metodo} className={referencia ? "bg-slate-50" : ""}>
                <td className="py-2 pr-3 font-medium text-slate-900">
                  {linha.metodo}
                  {referencia && (
                    <span className="ml-2">
                      <Etiqueta cor="neutro">referência</Etiqueta>
                    </span>
                  )}
                </td>
                {PRATOS.map((p) => {
                  const valor = linha.porPrato[p.id];
                  const melhor = valor === melhorPorPrato[p.id];
                  return (
                    <td
                      key={p.id}
                      className={`tabular py-2 pr-3 text-right ${
                        melhor ? "font-semibold text-marca-700" : "text-slate-600"
                      }`}
                    >
                      {numero(valor, 2)}
                    </td>
                  );
                })}
                <td
                  className={`tabular py-2 text-right ${
                    linha.geral === melhorGeral
                      ? "font-semibold text-marca-700"
                      : "text-slate-600"
                  }`}
                >
                  {numero(linha.geral, 2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Resumo({
  rotulo,
  valor,
  detalhe,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {rotulo}
      </p>
      <p className="tabular mt-1 text-xl font-semibold text-slate-900">{valor}</p>
      <p className="mt-1 text-sm text-slate-500">{detalhe}</p>
    </div>
  );
}
