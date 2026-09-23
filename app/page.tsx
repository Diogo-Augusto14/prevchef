"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LeituraDoDia } from "./components/AnaliseIA";
import CurvaDeChegada from "./components/CurvaDeChegada";
import FechamentoDoDia from "./components/FechamentoDoDia";
import {
  Alertas,
  DatasParecidas,
  DiasParecidos,
  InstrumentoDePratos,
  ListaDeCompras,
  PratoDoDia,
} from "./components/ResultadoDia";
import {
  BOTAO_SECUNDARIO,
  BlocoDoTrilho,
  Etiqueta,
  LinhaDeNumeros,
  TelaComTrilho,
} from "./components/ui";
import {
  DIA_PADRAO,
  NOMES_DIAS,
  dataLocal,
  dataLonga,
  dinheiro,
  diaSemanaDe,
  inicioDoMes,
  numero,
  paraData,
  somarDias,
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
import { precosDoDia } from "@/lib/cardapio";
import { K_PADRAO } from "@/lib/knn";
import { gerarResumoDoDia } from "@/lib/previsao";
import { HISTORICO } from "@/lib/dados";
import { useOperacao } from "@/lib/operacao";
import {
  chaveDaLeitura,
  guardarLeitura,
  leituraGuardada,
  montarPayloadDaAnalise,
  pedirAnalise,
  type EstadoDaAnalise,
} from "@/lib/analise";

/* Primeiro dia com K dias de histórico antes: mais cedo, o KNN não tem vizinhos. */
const PRIMEIRO_DIA = somarDias(HISTORICO[0].data, K_PADRAO);

export default function PainelPage() {
  const { estoqueAtual, diasFechados, cardapio, pronto } = useOperacao();
  const [data, setData] = useState(DIA_PADRAO);
  const [local, setLocal] = useState<Local>(() => localDaCidade(CIDADE_PADRAO));
  const [buscandoLocal, setBuscandoLocal] = useState(true);
  const [falhaLocal, setFalhaLocal] = useState<string | null>(null);
  const [tempo, setTempo] = useState<PrevisaoDoTempo[]>([]);
  const [erroClima, setErroClima] = useState<string | null>(null);
  const [carregandoClima, setCarregandoClima] = useState(true);
  const [tentativasDoClima, setTentativasDoClima] = useState(0);
  const [localDemorou, setLocalDemorou] = useState(false);
  const [analise, setAnalise] = useState<EstadoDaAnalise>({ estado: "ocioso" });
  const jaPulou = useRef(false);

  /* Depois de montar (para não quebrar a hidratação): data passada vira hoje. */
  useEffect(() => {
    const hoje = dataLocal();
    setData((atual) => (atual < hoje ? hoje : atual));
  }, []);

  /* A IA espera a localização, mas não presa no pedido de permissão. */
  useEffect(() => {
    const limite = setTimeout(() => setLocalDemorou(true), 4000);
    return () => clearTimeout(limite);
  }, []);
  const esperouLocal = !buscandoLocal || localDemorou;

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
        // Só na primeira resposta: depois, o dia escolhido pela pessoa fica.
        if (!jaPulou.current) {
          setData((atual) =>
            previsoes.length && atual < previsoes[0].data ? previsoes[0].data : atual
          );
          jaPulou.current = true;
        }
      })
      .catch((erro) => {
        if (erro?.name === "AbortError") return;
        // Sem isso, o clima da cidade anterior seguiria valendo com o nome novo.
        setTempo([]);
        setErroClima("Não foi possível buscar a previsão do tempo.");
      })
      .finally(() => {
        // A busca cancelada termina depois que a nova já começou: não desliga o "carregando" dela.
        if (!controle.signal.aborted) setCarregandoClima(false);
      });

    return () => controle.abort();
  }, [local, tentativasDoClima]);

  const tempoDoDia = useMemo(
    () => tempo.find((t) => t.data === data) ?? null,
    [tempo, data]
  );

  const formatoValido = /^\d{4}-\d{2}-\d{2}$/.test(data);
  const dataValida = formatoValido && data >= PRIMEIRO_DIA;
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

  /* O faturamento estimado usa o preço que vale hoje, não o do arquivo. */
  const precos = useMemo(() => precosDoDia(cardapio), [cardapio]);

  const resumo = useMemo(
    () =>
      dataValida && pronto
        ? gerarResumoDoDia(cenario, data, K_PADRAO, estoqueAtual, historico, precos)
        : null,
    [cenario, data, dataValida, pronto, estoqueAtual, historico, precos]
  );

  /*
   * Análise da IA: dispara sozinha, com um respiro entre mudanças. Se o dia
   * já tem leitura guardada neste navegador, usa ela e não chama a IA —
   * `forcar` é o "gerar de novo" pedido pela pessoa.
   *
   * Uma chamada em curso nunca é cancelada: cancelar no navegador não para
   * a rota, que segue falando com a IA e gastando do mesmo jeito. Então,
   * enquanto a chamada de um dia está a caminho, novos disparos do mesmo
   * dia esperam por ela, e toda resposta boa fica guardada — mesmo a de um
   * dia que a pessoa já deixou de olhar.
   */
  const chaveDoDia = dataValida ? chaveDaLeitura(data, local) : null;
  const chaveAtual = useRef<string | null>(null);
  const emCurso = useRef(new Set<string>());

  useEffect(() => {
    chaveAtual.current = chaveDoDia;
  }, [chaveDoDia]);

  const rodarAnalise = useCallback(
    (forcar: boolean) => {
      if (!resumo || carregandoClima || !esperouLocal) return;
      const chave = chaveDaLeitura(resumo.dataAlvo, local);

      if (!forcar) {
        const guardada = leituraGuardada(chave);
        if (guardada) {
          setAnalise({ estado: "pronto", ...guardada });
          return;
        }
      }

      if (emCurso.current.has(chave)) {
        setAnalise({ estado: "carregando" });
        return;
      }

      emCurso.current.add(chave);
      setAnalise({ estado: "carregando" });
      const semClima = Boolean(erroClima);
      pedirAnalise(
        montarPayloadDaAnalise(resumo, local, tempoDoDia, estoqueAtual, semClima)
      ).then(
        (resultado) => {
          emCurso.current.delete(chave);
          // Leitura feita sem o clima real não é guardada: volta a ser pedida.
          const salvaEm =
            resultado.estado === "pronto" && !semClima
              ? guardarLeitura(chave, resultado.analise)
              : undefined;
          if (chaveAtual.current !== chave) return;
          setAnalise(
            resultado.estado === "pronto" ? { ...resultado, salvaEm } : resultado
          );
        }
      );
    },
    [resumo, local, tempoDoDia, carregandoClima, esperouLocal, estoqueAtual, erroClima]
  );

  useEffect(() => {
    if (!chaveDoDia) return;
    // Leitura guardada aparece na hora, sem esperar o clima; só a chamada
    // nova espera o clima e o respiro.
    const guardada = leituraGuardada(chaveDoDia);
    if (guardada) {
      setAnalise({ estado: "pronto", ...guardada });
      return;
    }
    // Sem isso, a leitura do dia ou do lugar anterior fica na tela até a nova chegar.
    setAnalise({ estado: "carregando" });
    if (!resumo || carregandoClima || !esperouLocal) return;
    const espera = setTimeout(() => rodarAnalise(false), 600);
    return () => clearTimeout(espera);
  }, [chaveDoDia, rodarAnalise, resumo, carregandoClima, esperouLocal]);

  const itensAComprar = resumo
    ? resumo.compras.filter((c) => c.comprar > 0).length
    : 0;

  return (
    <TelaComTrilho
      trilho={
        <>
          <BlocoDoTrilho rotulo="Dia">
            <h1 className="font-display text-[26px] font-medium leading-[1.15] tracking-tight text-marfim">
              <span className="sr-only">Painel do dia: </span>
              {dataValida ? diaPorExtenso(data) : "Escolha um dia"}
            </h1>
            <p className="mt-2 text-[12px] leading-relaxed text-marfim/55">
              Localização, clima e feriado entram sozinhos. Você escolhe só o dia.
            </p>
            <label htmlFor="data" className="sr-only">
              Dia
            </label>
            <input
              id="data"
              type="date"
              value={data}
              min={PRIMEIRO_DIA}
              onChange={(e) => setData(e.target.value)}
              className="campo tabular mt-3"
            />
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {dataValida ? (
                <>
                  <Etiqueta cor="neutro">{NOMES_DIAS[diaSemana]}</Etiqueta>
                  {feriado && <Etiqueta cor="ambar">{feriado}</Etiqueta>}
                  {inicioDoMes(data) && (
                    <Etiqueta cor="neutro">início do mês</Etiqueta>
                  )}
                </>
              ) : (
                <span className="text-xs text-ambar-300">
                  {formatoValido
                    ? `O histórico começa em ${dataLonga(HISTORICO[0].data)}. Escolha a partir de ${dataLonga(PRIMEIRO_DIA)}.`
                    : "Data inválida."}
                </span>
              )}
            </div>
          </BlocoDoTrilho>

          <Clima
            carregando={carregandoClima}
            erro={erroClima}
            tempo={tempoDoDia}
            temperaturaUsada={cenario.temperatura}
            aoTentarDeNovo={() => setTentativasDoClima((n) => n + 1)}
          />

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
            <>
              <DatasParecidas resumo={resumo} />
              <Alertas resumo={resumo} />
              <BlocoDoTrilho>
                <a
                  href="#fechamento"
                  className="block w-full rounded-[13px] border border-fogo-500/40 bg-fogo-500/12 px-4 py-2.5 text-center text-[13px] font-bold text-fogo-300 transition hover:bg-fogo-500/20 hover:text-fogo-200"
                >
                  Fechar o dia
                </a>
              </BlocoDoTrilho>
            </>
          )}
        </>
      }
    >
      {resumo ? (
        <>
          <LinhaDeNumeros
            itens={[
              {
                rotulo: "Movimento previsto",
                valor: (
                  <>
                    {Math.round(resumo.totalPorcoes)}
                    <span className="ml-2 font-corpo text-sm font-medium text-marfim/60">
                      porções
                    </span>
                  </>
                ),
                detalhe: "somando todos os pratos",
                forte: true,
              },
              {
                rotulo: "Faturamento estimado",
                valor: dinheiro(resumo.faturamentoEstimado),
                detalhe: "com o preço que vale hoje",
              },
              {
                rotulo: "Compras do dia",
                valor: dinheiro(resumo.custoDaCompra),
                detalhe:
                  itensAComprar === 0
                    ? "o estoque cobre a previsão"
                    : `${itensAComprar} ${itensAComprar === 1 ? "item" : "itens"} na lista`,
              },
            ]}
          />

          <InstrumentoDePratos resumo={resumo} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <CurvaDeChegada chegadas={resumo.chegadas} />
            <div className="space-y-5">
              <PratoDoDia resumo={resumo} />
              <ListaDeCompras resumo={resumo} />
            </div>
          </div>

          <LeituraDoDia estado={analise} aoTentarDeNovo={() => rodarAnalise(true)} />

          <FechamentoDoDia
            data={data}
            cenario={cenario}
            previsoes={resumo.previsoes}
          />

          <DiasParecidos resumo={resumo} />
        </>
      ) : (
        <div
          className={`vidro-bloco flex h-64 items-center justify-center rounded-[22px] px-6 text-center text-sm text-marfim/55 ${
            dataValida ? "animate-pulse" : ""
          }`}
          aria-live="polite"
        >
          {dataValida
            ? "Montando a previsão do dia…"
            : "Escolha um dia para ver a previsão."}
        </div>
      )}
    </TelaComTrilho>
  );
}

/* ------------------------------------------------------------------ */

/** "Sexta, 25 de setembro" — sem o "-feira", para caber no trilho. */
function diaPorExtenso(dataIso: string): string {
  const dia = paraData(dataIso);
  if (Number.isNaN(dia.getTime())) return "Escolha um dia";
  const texto = dia
    .toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    })
    .replace("-feira", "");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/* ------------------------------------------------------------------ */

function Clima({
  carregando,
  erro,
  tempo,
  temperaturaUsada,
  aoTentarDeNovo,
}: {
  carregando: boolean;
  erro: string | null;
  tempo: PrevisaoDoTempo | null;
  temperaturaUsada: number;
  aoTentarDeNovo: () => void;
}) {
  const faixa = faixaDeClima(temperaturaUsada);

  return (
    <BlocoDoTrilho
      rotulo="Clima"
      acao={
        <Etiqueta cor={faixa === "quente" ? "ambar" : faixa === "frio" ? "nevoa" : "neutro"}>
          {rotuloDoClima(temperaturaUsada)}
        </Etiqueta>
      }
    >
      {carregando ? (
        <p className="text-xs text-marfim/50">Buscando a previsão…</p>
      ) : erro ? (
        <>
          <p className="tabular font-display text-[40px] font-medium leading-none tracking-tight text-marfim">
            {numero(temperaturaUsada)}
            <span className="ml-1 text-base text-marfim/55">°C</span>
          </p>
          <p className="mt-2.5 text-xs leading-relaxed text-ambar-300">
            {erro} Usando a média histórica da época.
          </p>
          <button
            type="button"
            onClick={aoTentarDeNovo}
            className={`${BOTAO_SECUNDARIO} mt-3 px-3 py-1.5 text-xs`}
          >
            Tentar de novo
          </button>
        </>
      ) : tempo ? (
        <>
          <div className="flex items-end justify-between gap-3">
            <p className="tabular font-display text-[40px] font-medium leading-none tracking-tight text-marfim">
              {numero(tempo.temperatura)}
              <span className="ml-1 text-base text-marfim/55">°C</span>
            </p>
            <p className="tabular text-right text-[12px] leading-[1.55] text-marfim/62">
              <span className="block">
                {numero(tempo.temperaturaMinima)}–{numero(tempo.temperaturaMaxima)}°
              </span>
              <span className="block">{tempo.chanceDeChuva}% de chuva</span>
              {tempo.chuvaMm > 0 && (
                <span className="block">{numero(tempo.chuvaMm)} mm</span>
              )}
            </p>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
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
            <span className="text-[11px] text-marfim/55">Open-Meteo</span>
          </div>
        </>
      ) : (
        <>
          <p className="tabular font-display text-[40px] font-medium leading-none tracking-tight text-marfim">
            {numero(temperaturaUsada)}
            <span className="ml-1 text-base text-marfim/55">°C</span>
          </p>
          <p className="mt-2.5 text-xs leading-relaxed text-ambar-300/90">
            Sem previsão real para esta data — a Open-Meteo vai até 16 dias.
            Usando a média histórica da época.
          </p>
        </>
      )}
    </BlocoDoTrilho>
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
    <BlocoDoTrilho
      rotulo="Localização"
      acao={
        !buscando && doAparelho ? (
          <Etiqueta cor="fogoSuave">sua localização</Etiqueta>
        ) : undefined
      }
    >
      <p className="flex items-center gap-2.5">
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
          className={`shrink-0 ${doAparelho ? "text-fogo-300" : "text-marfim/45"}`}
        >
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <span className="min-w-0 text-sm font-semibold text-marfim">
          {buscando ? "Detectando sua localização…" : local.nome}
        </span>
      </p>

      {!buscando && !doAparelho && (
        <div className="mt-3 space-y-2">
          <label htmlFor="cidade" className="sr-only">
            Cidade
          </label>
          <select
            id="cidade"
            value={CIDADES.find((c) => `${c.nome}, ${c.uf}` === local.nome)?.id ?? ""}
            onChange={(e) => aoEscolherCidade(e.target.value)}
            className="campo !py-2 !text-[13px]"
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
            className={`${BOTAO_SECUNDARIO} w-full px-3 py-2 text-xs`}
          >
            Usar minha localização
          </button>
        </div>
      )}

      {!buscando && doAparelho && (
        <button
          type="button"
          onClick={aoDetectar}
          className={`${BOTAO_SECUNDARIO} mt-3 px-3 py-1.5 text-xs`}
        >
          Atualizar
        </button>
      )}

      {falha && (
        <p className="mt-2.5 text-xs leading-relaxed text-ambar-300/90">{falha}</p>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-marfim/55">
        Coordenada arredondada para ~1 km antes de sair do navegador.
      </p>
    </BlocoDoTrilho>
  );
}
