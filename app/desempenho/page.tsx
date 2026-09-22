"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  CABECALHO_TABELA,
  CELULA,
  Cartao,
  Etiqueta,
  Indicador,
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
    <div className="flex h-80 items-center justify-center text-sm text-marfim/45">
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
    <div className="space-y-7">
      <TituloDaTela titulo="Desempenho do modelo">
        Treino nos 10 primeiros meses, teste nos 2 últimos. O modelo nunca vê os
        dias de teste antes de prever.
      </TituloDaTela>

      {avaliacao && (
        <div className="grid gap-[18px] sm:grid-cols-3">
          <Indicador
            rotulo="Treino"
            valor={`${avaliacao.particao.treino.dias} dias`}
            detalhe={`${dataLonga(avaliacao.particao.treino.inicio)} a ${dataLonga(
              avaliacao.particao.treino.fim
            )}`}
          />
          <Indicador
            rotulo="Teste"
            valor={`${avaliacao.particao.teste.dias} dias`}
            detalhe={`${dataLonga(avaliacao.particao.teste.inicio)} a ${dataLonga(
              avaliacao.particao.teste.fim
            )}`}
          />
          <Indicador
            rotulo="Melhor resultado"
            valor={`MAE ${numero(avaliacao.melhorKnn.geral, 2)}`}
            detalhe={`${avaliacao.melhorKnn.metodo} — erra ${numero(
              Math.abs(avaliacao.ganhoPercentual),
              1
            )}% ${
              avaliacao.ganhoPercentual >= 0 ? "menos" : "mais"
            } que a média do dia da semana`}
            destaque
          />
        </div>
      )}

      <Cartao
        titulo="Previsto × real no período de teste"
        descricao="Cada ponto é um dia que o modelo não viu no treino."
        acao={
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="prato" className="rotulo">
                Prato
              </label>
              <select
                id="prato"
                value={pratoSelecionado}
                onChange={(e) => setPratoSelecionado(e.target.value)}
                className="campo !w-auto !py-2 !text-[13px]"
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
                className="campo !w-auto !py-2 !text-[13px]"
              >
                {KS_AVALIADOS.map((valor) => (
                  <option key={valor} value={valor}>
                    K = {valor}
                  </option>
                ))}
              </select>
            </div>
          </div>
        }
      >
        <GraficoDesempenho serie={serie} />
        <p className="mt-4 border-t border-white/[0.08] pt-4 text-sm text-marfim/62">
          Erro médio nesta seleção:{" "}
          <strong className="tabular font-bold text-marfim">
            {numero(erroMedioDaSerie, 2)} porções por dia
          </strong>{" "}
          {pratoSelecionado === "todos"
            ? "somando os cinco pratos"
            : `apenas ${PRATOS.find((p) => p.id === pratoSelecionado)?.nome}`}
          .
        </p>
      </Cartao>

      <Cartao
        titulo="MAE por método"
        descricao="Porções de erro por dia — quanto menor, melhor. Em jade, o melhor de cada coluna."
      >
        {!avaliacao ? (
          <p className="py-7 text-center text-sm text-marfim/45">
            Calculando o erro em todos os dias de teste…
          </p>
        ) : (
          <TabelaMae avaliacao={avaliacao} />
        )}
      </Cartao>

      <Cartao titulo="Como ler estes números">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-marfim/72 marker:text-jade-400/60">
          <li>
            <strong className="font-semibold text-marfim">MAE</strong> é a média de
            quanto a previsão erra, em porções, em cada dia de teste. MAE 4
            significa errar quatro porções para mais ou para menos, na média.
          </li>
          <li>
            A linha{" "}
            <strong className="font-semibold text-marfim">
              média do mesmo dia da semana
            </strong>{" "}
            é a régua: é o que o gerente já faria de cabeça. O KNN só se paga se
            ficar abaixo dela.
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
          <tr className="text-left">
            <th className={`${CABECALHO_TABELA} pr-3`}>Método</th>
            {PRATOS.map((p) => (
              <th key={p.id} className={`${CABECALHO_TABELA} pr-3 text-right`}>
                {p.nome}
              </th>
            ))}
            <th className={`${CABECALHO_TABELA} text-right`}>Geral</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {avaliacao.linhas.map((linha) => {
            const referencia = linha.metodo === avaliacao.referencia.metodo;
            const melhorLinha = linha.geral === melhorGeral;
            return (
              <tr
                key={linha.metodo}
                className={melhorLinha ? "bg-jade-400/[0.07]" : undefined}
              >
                <td
                  className={`${CELULA} pl-2.5 pr-3 font-semibold ${
                    referencia ? "text-marfim/82" : "text-marfim"
                  }`}
                >
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
                      className={`${CELULA} pr-3 text-right ${
                        melhor ? "font-bold text-jade-300" : "text-marfim/74"
                      }`}
                    >
                      {numero(valor, 2)}
                    </td>
                  );
                })}
                <td
                  className={`${CELULA} pr-2.5 text-right ${
                    linha.geral === melhorGeral
                      ? "font-bold text-jade-300"
                      : "text-marfim/74"
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
