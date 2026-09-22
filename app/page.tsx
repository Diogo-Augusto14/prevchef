"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AnaliseIA from "./components/AnaliseIA";
import ResultadoDia from "./components/ResultadoDia";
import { Cartao, Etiqueta, TituloDaTela } from "./components/ui";
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
    <div className="space-y-7">
      <TituloDaTela titulo="Painel do dia">
        O sistema busca o clima real, detecta o feriado, prevê a venda de cada
        prato e analisa tudo sozinho. Você escolhe só o dia e a praça.
      </TituloDaTela>

      <Cartao
        titulo="Condições do dia"
        descricao={`Detectadas automaticamente · histórico simulado de ${
          HISTORICO.length
        } dias, até ${dataLonga(
          HISTORICO[HISTORICO.length - 1].data
        )} (gerado em ${dataLonga(GERADO_EM)})`}
      >
        <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.35fr)]">
          <div className="flex flex-col gap-2">
            <label htmlFor="data" className="rotulo">
              Dia
            </label>
            <input
              id="data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="campo tabular"
            />
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              {dataValida ? (
                <>
                  <Etiqueta cor="neutro">{NOMES_DIAS[diaSemana]}</Etiqueta>
                  {feriado && <Etiqueta cor="ambar">{feriado}</Etiqueta>}
                  {inicioDoMes(data) && (
                    <Etiqueta cor="jadeSuave">início do mês</Etiqueta>
                  )}
                </>
              ) : (
                <span className="text-xs text-ambar-300">
                  Informe uma data válida.
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="cidade" className="rotulo">
              Praça
            </label>
            <select
              id="cidade"
              value={cidadeId}
              onChange={(e) => setCidadeId(e.target.value)}
              className="campo"
            >
              {CIDADES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} — {c.uf}
                </option>
              ))}
            </select>
            <span className="mt-0.5 text-xs text-marfim/55">
              Define de onde vem a previsão do tempo.
            </span>
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

  return (
    <div className="rounded-[18px] border border-white/12 bg-gradient-to-br from-[rgba(56,118,160,0.20)] to-white/[0.03] px-[18px] py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]">
      <div className="flex items-center justify-between gap-2.5">
        <span className="rotulo">Clima</span>
        <Etiqueta cor={faixa === "quente" ? "ambar" : faixa === "frio" ? "nevoa" : "jade"}>
          {rotuloDoClima(temperaturaUsada)}
        </Etiqueta>
      </div>

      {carregando ? (
        <p className="mt-3 text-xs text-marfim/55">Buscando a previsão…</p>
      ) : erro ? (
        <p className="mt-3 text-xs text-ambar-300">{erro}</p>
      ) : tempo ? (
        <>
          <p className="tabular mt-2.5 font-display text-[42px] font-light leading-none tracking-tight text-marfim">
            {numero(tempo.temperatura)}
            <span className="ml-1.5 text-[17px] text-marfim/62">°C</span>
          </p>
          <p className="tabular mt-2 text-xs leading-snug text-marfim/62">
            mín {numero(tempo.temperaturaMinima)} · máx{" "}
            {numero(tempo.temperaturaMaxima)} · {tempo.chanceDeChuva}% de chance
            de chuva
            {tempo.chuvaMm > 0 && ` (${numero(tempo.chuvaMm)} mm)`}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {tempo.chuva ? (
              <Etiqueta cor="nevoa">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2" />
                  <path d="M18 16a4 4 0 0 0 .5-8 6 6 0 0 0-11.6 1.6A3.5 3.5 0 0 0 7 16Z" />
                </svg>
                dia de chuva
              </Etiqueta>
            ) : (
              <Etiqueta cor="neutro">sem chuva</Etiqueta>
            )}
            <span className="text-[11px] text-marfim/48">
              previsão real · Open-Meteo
            </span>
          </div>
        </>
      ) : (
        <>
          <p className="tabular mt-2.5 font-display text-[42px] font-light leading-none tracking-tight text-marfim">
            {numero(temperaturaUsada)}
            <span className="ml-1.5 text-[17px] text-marfim/62">°C</span>
          </p>
          <p className="mt-2 text-xs leading-snug text-ambar-300/90">
            Sem previsão real para esta data (a Open-Meteo vai até 16 dias).
            Usando a média histórica desta época do ano.
          </p>
        </>
      )}
    </div>
  );
}
