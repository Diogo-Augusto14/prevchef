"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DetalheDaIA, ResumoDaIA } from "./components/AnaliseIA";
import CurvaDeChegada from "./components/CurvaDeChegada";
import FechamentoDoDia from "./components/FechamentoDoDia";
import {
  Alertas,
  DiasParecidos,
  InstrumentoDePratos,
  ListaDeCompras,
  PratoDoDia,
} from "./components/ResultadoDia";
import { Etiqueta, Heroi, TituloDaTela } from "./components/ui";
import {
  DIA_PADRAO,
  NOMES_DIAS,
  dinheiro,
  diaSemanaDe,
  inicioDoMes,
  numero,
} from "@/lib/dados";
import {
  CIDADES,
  CIDADE_PADRAO,
  MENSAGEM_DE_FALHA,
  buscarPrevisao,
  faixaDeClima,
  localDaCidade,
  localDoDispositivo,
  rotuloDoClima,
  type FalhaDeLocalizacao,
  type Local,
  type PrevisaoDoTempo,
} from "@/lib/clima";
import { feriadoDe } from "@/lib/feriados";
import { temperaturaTipicaPara } from "@/lib/padroes";
import { K_PADRAO } from "@/lib/knn";
import { gerarResumoDoDia } from "@/lib/previsao";
import { HISTORICO } from "@/lib/dados";
import { useOperacao } from "@/lib/operacao";
import {
  montarPayloadDaAnalise,
  pedirAnalise,
  type EstadoDaAnalise,
} from "@/lib/analise";

export default function PainelPage() {
  const { estoqueAtual, diasFechados, pronto } = useOperacao();
  const [data, setData] = useState(DIA_PADRAO);
  const [local, setLocal] = useState<Local>(() => localDaCidade(CIDADE_PADRAO));
  const [buscandoLocal, setBuscandoLocal] = useState(true);
  const [falhaLocal, setFalhaLocal] = useState<string | null>(null);
  const [tempo, setTempo] = useState<PrevisaoDoTempo[]>([]);
  const [erroClima, setErroClima] = useState<string | null>(null);
  const [carregandoClima, setCarregandoClima] = useState(true);
  const [analise, setAnalise] = useState<EstadoDaAnalise>({ estado: "ocioso" });

  /* Localização real: tenta o aparelho; se negar, fica na cidade da lista. */
  const detectarLocal = useCallback(() => {
    setBuscandoLocal(true);
    setFalhaLocal(null);

    localDoDispositivo()
      .then((encontrado) => setLocal(encontrado))
      .catch((falha: FalhaDeLocalizacao) =>
        setFalhaLocal(MENSAGEM_DE_FALHA[falha] ?? MENSAGEM_DE_FALHA.indisponivel)
      )
      .finally(() => setBuscandoLocal(false));
  }, []);

  useEffect(detectarLocal, [detectarLocal]);

  /* Clima real do ponto onde a pessoa está. */
  useEffect(() => {
    const controle = new AbortController();
    setCarregandoClima(true);
    setErroClima(null);

    buscarPrevisao(local, 16, controle.signal)
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
  }, [local]);

  const tempoDoDia = useMemo(
    () => tempo.find((t) => t.data === data) ?? null,
    [tempo, data]
  );

  const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(data);
  const diaSemana = dataValida ? diaSemanaDe(data) : 0;
  const feriado = dataValida ? feriadoDe(data) : null;

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

  /* O histórico cresce: cada dia fechado entra como mais um vizinho possível. */
  const historico = useMemo(
    () => (diasFechados.length ? [...HISTORICO, ...diasFechados] : HISTORICO),
    [diasFechados]
  );

  const resumo = useMemo(
    () =>
      dataValida && pronto
        ? gerarResumoDoDia(cenario, data, K_PADRAO, estoqueAtual, historico)
        : null,
    [cenario, data, dataValida, pronto, estoqueAtual, historico]
  );

  /* Análise da IA: dispara sozinha, com um respiro entre mudanças. */
  const controleAnalise = useRef<AbortController | null>(null);

  const rodarAnalise = useCallback(() => {
    if (!resumo || carregandoClima) return;

    controleAnalise.current?.abort();
    const controle = new AbortController();
    controleAnalise.current = controle;

    setAnalise({ estado: "carregando" });
    pedirAnalise(
      montarPayloadDaAnalise(resumo, local, tempoDoDia),
      controle.signal
    ).then((resultado) => {
      if (!controle.signal.aborted) setAnalise(resultado);
    });
  }, [resumo, local, tempoDoDia, carregandoClima]);

  useEffect(() => {
    if (!resumo || carregandoClima) return;
    const espera = setTimeout(rodarAnalise, 600);
    return () => clearTimeout(espera);
  }, [rodarAnalise, resumo, carregandoClima]);

  return (
    <div className="space-y-8">
      <TituloDaTela titulo="Painel do dia">
        Localização, clima e feriado entram sozinhos. Você escolhe só o dia.
      </TituloDaTela>

      {/* Faixa herói: onde, como está o tempo, quanto vai sair, e a leitura. */}
      <Heroi>
        <div className="grid gap-y-6 p-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.9fr)] md:gap-y-0">
          <div className="md:pr-7">
            <label htmlFor="data" className="rotulo">
              Dia
            </label>
            <input
              id="data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="campo tabular mt-2"
            />
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {dataValida ? (
                <>
                  <Etiqueta cor="neutro">{NOMES_DIAS[diaSemana]}</Etiqueta>
                  {feriado && <Etiqueta cor="ambar">{feriado}</Etiqueta>}
                  {inicioDoMes(data) && (
                    <Etiqueta cor="jadeSuave">início do mês</Etiqueta>
                  )}
                </>
              ) : (
                <span className="text-xs text-ambar-300">Data inválida.</span>
              )}
            </div>
          </div>

          <Clima
            carregando={carregandoClima}
            erro={erroClima}
            tempo={tempoDoDia}
            temperaturaUsada={cenario.temperatura}
          />

          <div className="md:border-l md:border-white/10 md:pl-7">
            <p className="rotulo">Movimento previsto</p>
            <p className="tabular mt-2 font-display text-[44px] font-light leading-none tracking-tight text-jade-100">
              {resumo ? Math.round(resumo.totalPorcoes) : "—"}
              <span className="ml-2 font-corpo text-sm font-medium text-marfim/60">
                porções
              </span>
            </p>
            <p className="tabular mt-2 text-[13px] text-marfim/62">
              {resumo ? dinheiro(resumo.faturamentoEstimado) : "—"} estimados ·{" "}
              {resumo ? dinheiro(resumo.custoDaCompra) : "—"} de compras
            </p>
          </div>
        </div>

        <div className="border-t border-white/10 px-6 py-5">
          <ResumoDaIA estado={analise} />
        </div>
      </Heroi>

      <Localizacao
        local={local}
        buscando={buscandoLocal}
        falha={falhaLocal}
        aoDetectar={detectarLocal}
        aoEscolherCidade={(id) => {
          const cidade = CIDADES.find((c) => c.id === id);
          if (cidade) {
            setLocal(localDaCidade(cidade));
            setFalhaLocal(null);
          }
        }}
      />

      {resumo && (
        <div className="grid gap-x-10 gap-y-8 lg:grid-cols-12">
          {/* Raciocínio */}
          <div className="space-y-8 lg:col-span-7 xl:col-span-8">
            <InstrumentoDePratos resumo={resumo} />
            <FechamentoDoDia
              data={data}
              cenario={cenario}
              previsoes={resumo.previsoes}
            />
            <CurvaDeChegada chegadas={resumo.chegadas} />
            <DetalheDaIA estado={analise} aoTentarDeNovo={rodarAnalise} />
            <DiasParecidos resumo={resumo} />
          </div>

          {/* Decisão */}
          <aside className="space-y-7 lg:col-span-5 xl:col-span-4">
            <PratoDoDia resumo={resumo} />
            <ListaDeCompras resumo={resumo} />
            <Alertas resumo={resumo} />
          </aside>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

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
    <div className="md:border-l md:border-white/10 md:px-7">
      <div className="flex items-center gap-2.5">
        <span className="rotulo">Clima</span>
        <Etiqueta cor={faixa === "quente" ? "ambar" : faixa === "frio" ? "nevoa" : "jade"}>
          {rotuloDoClima(temperaturaUsada)}
        </Etiqueta>
      </div>

      {carregando ? (
        <p className="mt-3 text-xs text-marfim/50">Buscando a previsão…</p>
      ) : erro ? (
        <p className="mt-3 text-xs text-ambar-300">{erro}</p>
      ) : tempo ? (
        <>
          <p className="tabular mt-2 font-display text-[44px] font-light leading-none tracking-tight text-marfim">
            {numero(tempo.temperatura)}
            <span className="ml-1 text-lg text-marfim/55">°C</span>
          </p>
          <p className="tabular mt-2 text-[13px] leading-snug text-marfim/62">
            {numero(tempo.temperaturaMinima)}–{numero(tempo.temperaturaMaxima)}°
            · {tempo.chanceDeChuva}% de chuva
            {tempo.chuvaMm > 0 && ` · ${numero(tempo.chuvaMm)} mm`}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {tempo.chuva && (
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
            )}
            <span className="text-[11px] text-marfim/45">Open-Meteo</span>
          </div>
        </>
      ) : (
        <>
          <p className="tabular mt-2 font-display text-[44px] font-light leading-none tracking-tight text-marfim">
            {numero(temperaturaUsada)}
            <span className="ml-1 text-lg text-marfim/55">°C</span>
          </p>
          <p className="mt-2 text-xs leading-snug text-ambar-300/90">
            Sem previsão real para esta data — a Open-Meteo vai até 16 dias.
            Usando a média histórica da época.
          </p>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Localizacao({
  local,
  buscando,
  falha,
  aoDetectar,
  aoEscolherCidade,
}: {
  local: Local;
  buscando: boolean;
  falha: string | null;
  aoDetectar: () => void;
  aoEscolherCidade: (id: string) => void;
}) {
  const doAparelho = local.fonte === "dispositivo";

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-y border-white/10 py-3.5">
      <span className="flex items-center gap-2.5">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={doAparelho ? "text-jade-300" : "text-marfim/45"}
        >
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <span className="text-sm font-semibold text-marfim">
          {buscando ? "Detectando sua localização…" : local.nome}
        </span>
        {!buscando && doAparelho && (
          <Etiqueta cor="jadeSuave">sua localização</Etiqueta>
        )}
      </span>

      {!buscando && !doAparelho && (
        <>
          <label htmlFor="cidade" className="sr-only">
            Cidade
          </label>
          <select
            id="cidade"
            value={CIDADES.find((c) => `${c.nome}, ${c.uf}` === local.nome)?.id ?? ""}
            onChange={(e) => aoEscolherCidade(e.target.value)}
            className="campo !w-auto !py-1.5 !text-[13px]"
          >
            {CIDADES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} — {c.uf}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={aoDetectar}
            className="rounded-lg border border-white/12 px-3 py-1.5 text-xs font-semibold text-marfim/80 transition hover:border-jade-400/40 hover:text-marfim"
          >
            Usar minha localização
          </button>
        </>
      )}

      {!buscando && doAparelho && (
        <button
          type="button"
          onClick={aoDetectar}
          className="rounded-lg border border-white/12 px-3 py-1.5 text-xs font-semibold text-marfim/80 transition hover:border-jade-400/40 hover:text-marfim"
        >
          Atualizar
        </button>
      )}

      {falha && <span className="text-xs text-ambar-300/90">{falha}</span>}

      <span className="ml-auto text-[11px] text-marfim/40">
        Coordenada arredondada para ~1 km antes de sair do navegador.
      </span>
    </div>
  );
}
