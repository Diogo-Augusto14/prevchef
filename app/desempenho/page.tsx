"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  CABECALHO_TABELA,
  CELULA,
  AvisoSimulado,
  Etiqueta,
  Heroi,
  LinhaDeNumeros,
  Secao,
  TituloDaTela,
} from "../components/ui";
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
    <div className="flex h-[360px] items-center justify-center text-sm text-marfim/40">
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

  const erroMedio = useMemo(() => {
    if (serie.length === 0) return 0;
    return (
      serie.reduce((s, p) => s + Math.abs(p.previsto - p.real), 0) / serie.length
    );
  }, [serie]);

  return (
    <div className="space-y-8">
      <TituloDaTela
        titulo="Desempenho do modelo"
        acao={<AvisoSimulado className="max-w-md" />}
      >
        Treino nos 10 primeiros meses, teste nos 2 últimos. O modelo nunca vê os
        dias de teste antes de prever.
      </TituloDaTela>

      {/* Herói: o gráfico, sangrando até a borda do painel. */}
      <Heroi>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 px-6 pt-6">
          <div>
            <h2 className="font-display text-xl font-normal text-marfim">
              Previsto × real no período de teste
            </h2>
            <p className="mt-1 text-[13px] text-marfim/62">
              Cada ponto é um dia que o modelo não viu no treino · erro médio
              desta seleção{" "}
              <span className="tabular font-semibold text-marfim">
                {numero(erroMedio, 2)} porções/dia
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="prato" className="rotulo">
                Prato
              </label>
              <select
                id="prato"
                value={pratoSelecionado}
                onChange={(e) => setPratoSelecionado(e.target.value)}
                className="campo !w-auto !py-1.5 !text-[13px]"
              >
                <option value="todos">Todos os pratos</option>
                {PRATOS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="k" className="rotulo">
                K
              </label>
              <select
                id="k"
                value={k}
                onChange={(e) => setK(Number(e.target.value))}
                className="campo !w-auto !py-1.5 !text-[13px]"
              >
                {KS_AVALIADOS.map((valor) => (
                  <option key={valor} value={valor}>
                    K = {valor}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Sem padding: o gráfico encosta nas bordas do painel. */}
        <div className="mt-4">
          <GraficoDesempenho serie={serie} />
        </div>

        {avaliacao && (
          <LinhaDeNumeros
            className="border-t border-white/10 px-6 py-5"
            itens={[
              {
                rotulo: "Treino",
                valor: `${avaliacao.particao.treino.dias} dias`,
                detalhe: `${dataLonga(avaliacao.particao.treino.inicio)} a ${dataLonga(
                  avaliacao.particao.treino.fim
                )}`,
              },
              {
                rotulo: "Teste",
                valor: `${avaliacao.particao.teste.dias} dias`,
                detalhe: `${dataLonga(avaliacao.particao.teste.inicio)} a ${dataLonga(
                  avaliacao.particao.teste.fim
                )}`,
              },
              {
                rotulo: "Melhor resultado",
                valor: `MAE ${numero(avaliacao.melhorKnn.geral, 2)}`,
                detalhe: `${avaliacao.melhorKnn.metodo} · erra ${numero(
                  Math.abs(avaliacao.ganhoPercentual),
                  1
                )}% ${
                  avaliacao.ganhoPercentual >= 0 ? "menos" : "mais"
                } que a régua`,
                forte: true,
              },
            ]}
          />
        )}
      </Heroi>

      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-12">
        <div className="lg:col-span-7 xl:col-span-8">
          <Secao
            titulo="MAE por método"
            descricao="Porções de erro por dia — quanto menor, melhor. Em jade, o melhor de cada coluna."
          >
            {!avaliacao ? (
              <p className="py-6 text-sm text-marfim/40">
                Calculando o erro em todos os dias de teste…
              </p>
            ) : (
              <TabelaMae avaliacao={avaliacao} />
            )}
          </Secao>
        </div>

        <div className="lg:col-span-5 xl:col-span-4">
          <Secao titulo="Como ler estes números">
            <dl className="space-y-4 text-[13px] leading-relaxed">
              <div>
                <dt className="font-semibold text-marfim">MAE</dt>
                <dd className="mt-0.5 text-marfim/70">
                  A média de quanto a previsão erra, em porções, em cada dia de
                  teste. MAE 4 é errar quatro porções para mais ou para menos.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-marfim">A régua</dt>
                <dd className="mt-0.5 text-marfim/70">
                  A média histórica do mesmo dia da semana é o que o gerente já
                  faria de cabeça. O KNN só se paga ficando abaixo dela.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-marfim">A escolha do K</dt>
                <dd className="mt-0.5 text-marfim/70">
                  K baixo fica sensível a um dia atípico; K alto suaviza demais e
                  perde os picos. Por isso comparamos 3, 5 e 7.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-ambar-300">O limite</dt>
                <dd className="mt-0.5 text-marfim/70">
                  Os dados são simulados com padrões conhecidos, então o erro
                  aqui é otimista em relação a um restaurante real.
                </dd>
              </div>
            </dl>
          </Secao>
        </div>
      </div>
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
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left">
            <th className={`${CABECALHO_TABELA} pr-4`}>Método</th>
            {PRATOS.map((p) => (
              <th key={p.id} className={`${CABECALHO_TABELA} pr-3 text-right`}>
                {p.nome.split(" ")[0]}
              </th>
            ))}
            <th className={`${CABECALHO_TABELA} text-right`}>Geral</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {avaliacao.linhas.map((linha) => {
            const referencia = linha.metodo === avaliacao.referencia.metodo;
            return (
              <tr key={linha.metodo}>
                <td
                  className={`${CELULA} pr-4 font-semibold ${
                    referencia ? "text-marfim/75" : "text-marfim"
                  }`}
                >
                  {linha.metodo}
                  {referencia && (
                    <span className="ml-2">
                      <Etiqueta cor="neutro">régua</Etiqueta>
                    </span>
                  )}
                </td>
                {PRATOS.map((p) => {
                  const valor = linha.porPrato[p.id];
                  const melhor = valor === melhorPorPrato[p.id];
                  return (
                    <td
                      key={p.id}
                      className={`${CELULA} pr-3 text-right ${
                        melhor ? "font-bold text-jade-300" : "text-marfim/70"
                      }`}
                    >
                      {numero(valor, 2)}
                    </td>
                  );
                })}
                <td
                  className={`${CELULA} text-right ${
                    linha.geral === melhorGeral
                      ? "font-bold text-jade-300"
                      : "text-marfim/70"
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
