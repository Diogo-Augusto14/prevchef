"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AnaliseIA from "./components/AnaliseIA";
import ResultadoDia from "./components/ResultadoDia";
import { AvisoSimulado, Cartao, Etiqueta } from "./components/ui";
import {
  DIA_PADRAO,
  GERADO_EM,
  HISTORICO,
  NOMES_DIAS,
  dataLonga,
  diaSemanaDe,
  inicioDoMes,
  numero,
} from "@/lib/dados";
import {
  CIDADES,
  CIDADE_PADRAO,
  buscarPrevisao,
  faixaDeClima,
  rotuloDoClima,
  type PrevisaoDoTempo,
} from "@/lib/clima";
import { feriadoDe } from "@/lib/feriados";
import { temperaturaTipicaPara } from "@/lib/padroes";
import { K_PADRAO } from "@/lib/knn";
import { gerarResumoDoDia } from "@/lib/previsao";
import {
  montarPayloadDaAnalise,
  pedirAnalise,
  type EstadoDaAnalise,
} from "@/lib/analise";

export default function PainelPage() {
  const [data, setData] = useState(DIA_PADRAO);
  const [cidadeId, setCidadeId] = useState(CIDADE_PADRAO.id);
  const [tempo, setTempo] = useState<PrevisaoDoTempo[]>([]);
  const [erroClima, setErroClima] = useState<string | null>(null);
  const [carregandoClima, setCarregandoClima] = useState(true);
  const [analise, setAnalise] = useState<EstadoDaAnalise>({ estado: "ocioso" });

  const cidade = CIDADES.find((c) => c.id === cidadeId) ?? CIDADE_PADRAO;

  /* Clima real: busca sozinho ao abrir e sempre que a cidade muda. */
  useEffect(() => {
    const controle = new AbortController();
    setCarregandoClima(true);
    setErroClima(null);

    buscarPrevisao(cidade, 16, controle.signal)
      .then((previsoes) => {
        setTempo(previsoes);
        // Se a data aberta já passou, pula para o primeiro dia com previsão.
        setData((atual) =>
          previsoes.length && atual < previsoes[0].data ? previsoes[0].data : atual
        );
      })
      .catch((erro) => {
        if (erro?.name === "AbortError") return;
        setErroClima("Não foi possível buscar a previsão do tempo.");
      })
      .finally(() => setCarregandoClima(false));

    return () => controle.abort();
  }, [cidade]);

  const tempoDoDia = useMemo(
    () => tempo.find((t) => t.data === data) ?? null,
    [tempo, data]
  );

  const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(data);
  const diaSemana = dataValida ? diaSemanaDe(data) : 0;
  const feriado = dataValida ? feriadoDe(data) : null;

  /* Cenário montado automaticamente: clima real + calendário. */
  const cenario = useMemo(
    () => ({
      diaSemana,
      temperatura: tempoDoDia?.temperatura ?? temperaturaTipicaPara(data),
      chuva: tempoDoDia?.chuva ?? false,
      feriado: Boolean(feriado),
      inicioMes: dataValida ? inicioDoMes(data) : false,
    }),
    [diaSemana, tempoDoDia, data, feriado, dataValida]
  );

  /* Previsão do KNN: recalcula sozinha quando o cenário muda. */
  const resumo = useMemo(
    () => (dataValida ? gerarResumoDoDia(cenario, data, K_PADRAO) : null),
    [cenario, data, dataValida]
  );

  /* Análise da IA: dispara sozinha, com um respiro para não chamar a cada tecla. */
  const controleAnalise = useRef<AbortController | null>(null);

  const rodarAnalise = useCallback(() => {
    if (!resumo || carregandoClima) return;

    controleAnalise.current?.abort();
    const controle = new AbortController();
    controleAnalise.current = controle;

    setAnalise({ estado: "carregando" });
    pedirAnalise(
      montarPayloadDaAnalise(resumo, cidade, tempoDoDia),
      controle.signal
    ).then((resultado) => {
      if (!controle.signal.aborted) setAnalise(resultado);
    });
  }, [resumo, cidade, tempoDoDia, carregandoClima]);

  useEffect(() => {
    if (!resumo || carregandoClima) return;
    const espera = setTimeout(rodarAnalise, 600);
    return () => clearTimeout(espera);
  }, [rodarAnalise, resumo, carregandoClima]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Painel do dia
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            O sistema busca o clima real, detecta o feriado, prevê a venda de
            cada prato e analisa tudo sozinho. Você só escolhe o dia e a praça.
          </p>
        </div>
        <AvisoSimulado />
      </div>

      <Cartao
        titulo="Condições do dia"
        descricao={`Detectadas automaticamente. Histórico simulado: ${
          HISTORICO.length
        } dias, até ${dataLonga(
          HISTORICO[HISTORICO.length - 1].data
        )} (gerado em ${dataLonga(GERADO_EM)}).`}
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
          <div>
            <label htmlFor="data" className="block text-sm font-medium text-slate-700">
              Dia
            </label>
            <input
              id="data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-marca-600 focus:outline-none focus:ring-2 focus:ring-marca-100"
            />
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              {dataValida ? NOMES_DIAS[diaSemana] : "Informe uma data válida."}
              {feriado && <Etiqueta cor="ambar">{feriado}</Etiqueta>}
              {dataValida && inicioDoMes(data) && (
                <Etiqueta cor="verde">início do mês</Etiqueta>
              )}
            </p>
          </div>

          <div>
            <label htmlFor="cidade" className="block text-sm font-medium text-slate-700">
              Praça
            </label>
            <select
              id="cidade"
              value={cidadeId}
              onChange={(e) => setCidadeId(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-marca-600 focus:outline-none focus:ring-2 focus:ring-marca-100"
            >
              {CIDADES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} — {c.uf}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              Define de onde vem a previsão do tempo.
            </p>
          </div>

          <Clima
            carregando={carregandoClima}
            erro={erroClima}
            tempo={tempoDoDia}
            temperaturaUsada={cenario.temperatura}
          />
        </div>
      </Cartao>

      <AnaliseIA estado={analise} aoTentarDeNovo={rodarAnalise} />

      {resumo && <ResultadoDia resumo={resumo} />}
    </div>
  );
}

function Clima({
  carregando,
  erro,
  tempo,
  temperaturaUsada,
}: {
  carregando: boolean;
  erro: string | null;
  tempo: PrevisaoDoTempo | null;
  temperaturaUsada: number;
}) {
  const faixa = faixaDeClima(temperaturaUsada);
  const cor = faixa === "frio" ? "azul" : faixa === "quente" ? "ambar" : "verde";

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-700">Clima</span>
        <Etiqueta cor={cor}>{rotuloDoClima(temperaturaUsada)}</Etiqueta>
      </div>

      {carregando ? (
        <p className="mt-2 text-xs text-slate-500">Buscando a previsão…</p>
      ) : erro ? (
        <p className="mt-2 text-xs text-amber-700">{erro}</p>
      ) : tempo ? (
        <>
          <p className="tabular mt-2 text-2xl font-semibold text-slate-900">
            {numero(tempo.temperatura)} °C
          </p>
          <p className="tabular mt-0.5 text-xs text-slate-500">
            mínima {numero(tempo.temperaturaMinima)} °C · máxima{" "}
            {numero(tempo.temperaturaMaxima)} °C · {tempo.chanceDeChuva}% de
            chance de chuva
            {tempo.chuvaMm > 0 && ` (${numero(tempo.chuvaMm)} mm)`}
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            {tempo.chuva ? (
              <Etiqueta cor="azul">dia de chuva</Etiqueta>
            ) : (
              <Etiqueta cor="neutro">sem chuva</Etiqueta>
            )}
            <span>previsão real · Open-Meteo</span>
          </p>
        </>
      ) : (
        <>
          <p className="tabular mt-2 text-2xl font-semibold text-slate-900">
            {numero(temperaturaUsada)} °C
          </p>
          <p className="mt-1 text-xs text-amber-700">
            Sem previsão real para esta data (a Open-Meteo vai até 16 dias).
            Usando a média histórica desta época do ano.
          </p>
        </>
      )}
    </div>
  );
}
