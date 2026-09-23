"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  BlocoDoTrilho,
  CABECALHO_TABELA,
  CELULA,
  Etiqueta,
  Heroi,
  Secao,
  TelaComTrilho,
  TituloDoTrilho,
} from "../components/ui";
import { HISTORICO, PRATOS, PRATO_IDS, dataLonga, numero } from "@/lib/dados";
import { K_PADRAO } from "@/lib/knn";
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
    <div className="flex h-80 items-center justify-center text-sm text-marfim/40 2xl:h-[380px]">
      Montando o gráfico…
    </div>
  ),
});

export default function DesempenhoPage() {
  // A avaliação varre o histórico inteiro; roda depois da montagem para não
  // travar a primeira pintura da tela.
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const [pratoSelecionado, setPratoSelecionado] = useState<string>("todos");
  const [k, setK] = useState(K_PADRAO);

  useEffect(() => {
    setAvaliacao(avaliar(HISTORICO, PRATO_IDS));
  }, []);

  // O "melhor resultado" da avaliação pode não ser o K que o sistema usa.
  const doSistema = useMemo(() => {
    if (!avaliacao) return null;
    const linha = avaliacao.linhas.find((l) => l.metodo === `KNN (K=${K_PADRAO})`);
    if (!linha) return null;
    const regua = avaliacao.referencia.geral;
    return {
      linha,
      ganhoPercentual: regua ? ((regua - linha.geral) / regua) * 100 : 0,
      diferenca: linha.geral - avaliacao.melhorKnn.geral,
      kDoMelhor:
        KS_AVALIADOS.find((v) => `KNN (K=${v})` === avaliacao.melhorKnn.metodo) ??
        K_PADRAO,
    };
  }, [avaliacao]);

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

  const trilho = (
    <>
      <TituloDoTrilho titulo="Desempenho do modelo">
        Treino nos 10 primeiros meses, teste nos 2 últimos. O modelo nunca vê os
        dias de teste antes de prever.
      </TituloDoTrilho>

      <BlocoDoTrilho rotulo="Ajustes do gráfico">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="prato" className="text-xs font-semibold text-marfim/72">
              Prato
            </label>
            <select
              id="prato"
              value={pratoSelecionado}
              onChange={(e) => setPratoSelecionado(e.target.value)}
              className="campo !py-2 !text-[13px]"
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
            <label htmlFor="k" className="text-xs font-semibold text-marfim/72">
              K
            </label>
            <select
              id="k"
              value={k}
              onChange={(e) => setK(Number(e.target.value))}
              className="campo !py-2 !text-[13px]"
            >
              {KS_AVALIADOS.map((valor) => (
                <option key={valor} value={valor}>
                  K = {valor}
                </option>
              ))}
            </select>
          </div>
        </div>
      </BlocoDoTrilho>

      <BlocoDoTrilho rotulo="Partição">
        {avaliacao ? (
          <ul className="divide-y divide-white/[0.07]">
            <TrechoDaParticao nome="Treino" trecho={avaliacao.particao.treino} />
            <TrechoDaParticao nome="Teste" trecho={avaliacao.particao.teste} />
          </ul>
        ) : (
          <p className="text-[13px] text-marfim/40">
            Calculando o erro em todos os dias de teste…
          </p>
        )}
      </BlocoDoTrilho>

      <BlocoDoTrilho rotulo="Melhor resultado">
        {avaliacao ? (
          <>
            <p className="tabular font-display text-[34px] font-medium leading-none tracking-tight text-fogo-400">
              MAE {numero(avaliacao.melhorKnn.geral, 2)}
            </p>
            <p className="mt-2.5 text-[13px] font-semibold text-marfim">
              {avaliacao.melhorKnn.metodo}
            </p>
            <p className="mt-0.5 text-xs leading-snug text-marfim/58">
              Erra{" "}
              <span className="tabular font-semibold text-marfim/85">
                {numero(Math.abs(avaliacao.ganhoPercentual), 1)}%
              </span>{" "}
              {avaliacao.ganhoPercentual >= 0 ? "menos" : "mais"} que a régua
            </p>
            {doSistema && (
              <div className="mt-3.5 border-t border-white/[0.07] pt-3">
                <p className="flex items-baseline justify-between gap-3 text-[13px] font-semibold text-marfim">
                  O sistema usa K = {K_PADRAO}
                  <span className="tabular font-display text-[17px] font-medium text-marfim">
                    MAE {numero(doSistema.linha.geral, 2)}
                  </span>
                </p>
                <p className="mt-0.5 text-xs leading-snug text-marfim/58">
                  Erra{" "}
                  <span className="tabular font-semibold text-marfim/85">
                    {numero(Math.abs(doSistema.ganhoPercentual), 1)}%
                  </span>{" "}
                  {doSistema.ganhoPercentual >= 0 ? "menos" : "mais"} que a régua.
                  {doSistema.diferenca > 0 && (
                    <>
                      {" "}O {avaliacao.melhorKnn.metodo} erra só{" "}
                      <span className="tabular font-semibold text-marfim/85">
                        {numero(doSistema.diferenca, 2)}
                      </span>{" "}
                      {doSistema.diferenca < 2 ? "porção" : "porções"} por dia a
                      menos;{" "}
                      {doSistema.kDoMelhor < K_PADRAO
                        ? `com ${K_PADRAO} vizinhos um dia atípico pesa menos na média, e a previsão fica mais estável.`
                        : `com ${K_PADRAO} vizinhos a previsão suaviza menos e não perde os picos.`}
                    </>
                  )}
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="text-[13px] text-marfim/40">Calculando…</p>
        )}
      </BlocoDoTrilho>

      <BlocoDoTrilho rotulo="Como ler estes números">
        <dl className="space-y-3.5 text-[13px] leading-relaxed">
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
              O erro medido vale para o padrão do último ano. Mudança de
              cardápio, de preço ou de público exige reavaliar.
            </dd>
          </div>
        </dl>
      </BlocoDoTrilho>
    </>
  );

  return (
    <TelaComTrilho trilho={trilho}>
      {/* Herói: o gráfico, sangrando até a borda do painel. */}
      <Heroi>
        <header className="px-6 pb-3 pt-5">
          <h2 className="font-display text-[19px] font-semibold tracking-tight text-marfim">
            Previsto × real no período de teste
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-marfim/55">
            Cada ponto é um dia que o modelo não viu no treino · erro médio desta
            seleção{" "}
            <span className="tabular font-semibold text-marfim">
              {numero(erroMedio, 2)} porções/dia
            </span>
          </p>
        </header>

        {/* Sem padding lateral: o gráfico encosta nas bordas do painel. */}
        <div className="pb-4">
          <GraficoDesempenho serie={serie} />
        </div>
      </Heroi>

      <Secao
        titulo="MAE por método"
        descricao="Porções de erro por dia — quanto menor, melhor. Em destaque, o melhor de cada coluna."
      >
        {!avaliacao ? (
          <p className="py-6 text-sm text-marfim/40">Calculando…</p>
        ) : (
          <TabelaMae avaliacao={avaliacao} />
        )}
      </Secao>
    </TelaComTrilho>
  );
}

function TrechoDaParticao({
  nome,
  trecho,
}: {
  nome: string;
  trecho: Avaliacao["particao"]["treino"];
}) {
  return (
    <li className="py-2.5 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold text-marfim">{nome}</span>
        <span className="tabular font-display text-[17px] font-medium text-marfim">
          {trecho.dias} dias
        </span>
      </div>
      <p className="mt-0.5 text-xs text-marfim/55">
        {dataLonga(trecho.inicio)} a {dataLonga(trecho.fim)}
      </p>
    </li>
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
                        melhor ? "font-bold text-fogo-300" : "text-marfim/70"
                      }`}
                    >
                      {numero(valor, 2)}
                    </td>
                  );
                })}
                <td
                  className={`${CELULA} text-right ${
                    linha.geral === melhorGeral
                      ? "font-bold text-fogo-300"
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
