"use client";

import { useMemo, useState } from "react";
import {
  Etiqueta,
  Heroi,
  LinhaDeNumeros,
  Secao,
  TituloDaTela,
  Vazio,
} from "../components/ui";
import {
  DIA_PADRAO,
  diaSemanaDe,
  dinheiro,
  inicioDoMes,
  nomeDoPrato,
} from "@/lib/dados";
import { feriadoDe } from "@/lib/feriados";
import { temperaturaTipicaPara } from "@/lib/padroes";
import { gerarResumoDoDia } from "@/lib/previsao";
import { chegadasProximas, picoAindaPorVir } from "@/lib/chegadas";
import FilaDeEspera from "../components/FilaDeEspera";
import { MESAS, PRATOS, TEMPO_MEDIO_DE_REFEICAO } from "@/lib/restaurante";
import { calcularDisponibilidade, podeLancar } from "@/lib/disponibilidade";
import { planejarChegadas, type PlanoDeChegada } from "@/lib/salao";
import { pedidosAbertos, useOperacao } from "@/lib/operacao";
import type { Mesa } from "@/lib/tipos";

export default function ServicoPage() {
  const {
    pronto,
    ocupacoes,
    pedidos,
    agora,
    sentar,
    liberar,
    lancarPedido,
    fila,
    entrarNaFila,
    sairDaFila,
    sentarDaFila,
  } = useOperacao();

  const [mesaSelecionada, setMesaSelecionada] = useState<string | null>(null);
  const [pessoas, setPessoas] = useState(2);
  const [rascunho, setRascunho] = useState<Record<string, number>>({});

  const { salao, planos, situacaoDaFila } = useMemo(
    () => planejarChegadas(ocupacoes, fila, agora),
    [ocupacoes, fila, agora]
  );

  /*
   * Previsão de chegada do dia. Usa o clima típico da época: esta tela não
   * busca previsão do tempo — quem faz isso é o Painel.
   */
  const previsaoDoDia = useMemo(
    () =>
      gerarResumoDoDia(
        {
          diaSemana: diaSemanaDe(DIA_PADRAO),
          temperatura: temperaturaTipicaPara(DIA_PADRAO),
          chuva: false,
          feriado: Boolean(feriadoDe(DIA_PADRAO)),
          inicioMes: inicioDoMes(DIA_PADRAO),
        },
        DIA_PADRAO
      ),
    []
  );

  const proximas = useMemo(
    () => chegadasProximas(previsaoDoDia.chegadas, agora),
    [previsaoDoDia, agora]
  );
  const pico = useMemo(
    () => picoAindaPorVir(previsaoDoDia.chegadas, agora),
    [previsaoDoDia, agora]
  );

  const abertos = useMemo(() => pedidosAbertos(pedidos), [pedidos]);
  const disponibilidade = useMemo(
    () => calcularDisponibilidade(abertos, DIA_PADRAO),
    [abertos]
  );

  const mesa = MESAS.find((m) => m.id === mesaSelecionada) ?? null;
  const ocupacao = ocupacoes.find((o) => o.mesaId === mesaSelecionada) ?? null;
  const pedidosDaMesa = abertos.filter((p) => p.mesaId === mesaSelecionada);

  if (!pronto) {
    return (
      <div className="space-y-8">
        <TituloDaTela titulo="Serviço">Abrindo o salão…</TituloDaTela>
      </div>
    );
  }

  const totalRascunho = Object.entries(rascunho).reduce(
    (s, [id, qtd]) =>
      s + (PRATOS.find((p) => p.id === id)?.precoVenda ?? 0) * qtd,
    0
  );
  const temRascunho = Object.values(rascunho).some((q) => q > 0);

  return (
    <div className="space-y-8">
      <TituloDaTela titulo="Serviço">
        O salão em tempo real. A resposta para quem entrar pela porta já está
        calculada — a recepção lê, não espera.
      </TituloDaTela>

      {/* Herói: as respostas prontas, antes de alguém chegar. */}
      <Heroi>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-6 pt-6">
          <h2 className="font-display text-xl font-normal text-marfim">
            Se entrar um grupo agora
          </h2>
          <p className="text-[13px] text-marfim/62">
            Recalculado a cada mesa que senta ou levanta — nenhuma conta é feita
            na chegada do cliente
          </p>
        </div>

        <div className="mt-5 grid border-t border-white/10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {planos.map((plano, i) => (
            <CartaoDePlano key={plano.pessoas} plano={plano} indice={i} />
          ))}
        </div>
      </Heroi>

      <LinhaDeNumeros
        className="border-y border-white/10 py-4"
        itens={[
          {
            rotulo: "Mesas livres",
            valor: `${salao.mesasLivres.length}/${MESAS.length}`,
            detalhe: `${salao.lugaresLivres} lugares vagos`,
            forte: salao.mesasLivres.length > 0,
          },
          {
            rotulo: "Pessoas no salão",
            valor: String(salao.pessoasSentadas),
            detalhe: `${salao.ocupacaoPercentual}% das mesas ocupadas`,
          },
          {
            rotulo: "Pedidos abertos",
            valor: String(abertos.length),
            detalhe: "na fila ou em preparo",
          },
          {
            rotulo: "Chegando na próxima hora",
            valor: proximas.seguinte
              ? `${proximas.seguinte.pessoas} pessoas`
              : "fora do serviço",
            detalhe: pico
              ? `pico ainda por vir às ${pico.rotulo} com ${pico.pessoas}`
              : `giro médio de ${TEMPO_MEDIO_DE_REFEICAO} min por mesa`,
            forte: Boolean(proximas.seguinte && proximas.seguinte.pessoas > 0),
          },
        ]}
      />

      <FilaDeEspera
        situacao={situacaoDaFila}
        aoEntrar={entrarNaFila}
        aoSair={sairDaFila}
        aoSentar={sentarDaFila}
      />

      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-12">
        <div className="lg:col-span-7 xl:col-span-8">
          <Secao
            titulo="Mapa do salão"
            descricao="Clique numa mesa para sentar um grupo, lançar pedido ou liberar."
          >
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
              {MESAS.map((m) => {
                const ocupada = salao.mesasOcupadas.find((o) => o.mesa.id === m.id);
                const ativa = m.id === mesaSelecionada;

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMesaSelecionada(m.id);
                      setPessoas(Math.min(m.lugares, 2));
                      setRascunho({});
                    }}
                    aria-pressed={ativa}
                    className={`rounded-2xl border px-3.5 py-3 text-left transition ${
                      ativa
                        ? "border-jade-400/60 bg-jade-400/10"
                        : ocupada
                          ? "border-ambar-500/30 bg-ambar-500/[0.07] hover:border-ambar-500/50"
                          : "border-white/10 bg-white/[0.03] hover:border-white/25"
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-display text-lg text-marfim">
                        Mesa {m.numero}
                      </span>
                      <span className="tabular text-[11px] text-marfim/50">
                        {m.lugares} lug.
                      </span>
                    </span>
                    <span className="mt-1.5 block text-[11px] text-marfim/45">
                      {m.area}
                    </span>
                    <span className="mt-2 block">
                      {ocupada ? (
                        <span className="tabular text-[11px] font-semibold text-ambar-300">
                          {ocupada.ocupacao.pessoas} pessoa
                          {ocupada.ocupacao.pessoas > 1 ? "s" : ""} · há{" "}
                          {ocupada.ha} min
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-jade-300">
                          livre
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </Secao>
        </div>

        <aside className="lg:col-span-5 xl:col-span-4">
          {!mesa ? (
            <Secao titulo="Mesa">
              <Vazio>Escolha uma mesa no mapa ao lado.</Vazio>
            </Secao>
          ) : (
            <Secao
              titulo={`Mesa ${mesa.numero}`}
              descricao={`${mesa.lugares} lugares · ${mesa.area}`}
              acao={
                ocupacao ? (
                  <button
                    type="button"
                    onClick={() => {
                      liberar(mesa.id);
                      setRascunho({});
                    }}
                    className="rounded-lg border border-white/12 px-3 py-1.5 text-xs font-semibold text-marfim/80 transition hover:border-brasa-300/50 hover:text-brasa-300"
                  >
                    Liberar mesa
                  </button>
                ) : undefined
              }
            >
              {!ocupacao ? (
                <SentarGrupo
                  mesa={mesa}
                  pessoas={pessoas}
                  aoMudar={setPessoas}
                  aoSentar={() => sentar(mesa.id, pessoas)}
                />
              ) : (
                <div className="space-y-6">
                  <p className="text-[13px] text-marfim/70">
                    {ocupacao.pessoas} pessoa{ocupacao.pessoas > 1 ? "s" : ""}{" "}
                    sentada{ocupacao.pessoas > 1 ? "s" : ""} desde{" "}
                    {new Date(ocupacao.desde).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    .
                  </p>

                  {pedidosDaMesa.length > 0 && (
                    <div>
                      <p className="rotulo">Pedidos em aberto</p>
                      <ul className="mt-2">
                        {pedidosDaMesa.map((p) => (
                          <li
                            key={p.id}
                            className="flex items-baseline justify-between gap-3 border-b border-white/[0.06] py-2 text-[13px] last:border-b-0"
                          >
                            <span className="text-marfim/80">
                              {p.itens
                                .map(
                                  (i) => `${i.quantidade}× ${nomeDoPrato(i.pratoId)}`
                                )
                                .join(", ")}
                            </span>
                            <Etiqueta
                              cor={p.situacao === "pronto" ? "jade" : "neutro"}
                            >
                              {p.situacao.replace("-", " ")}
                            </Etiqueta>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <p className="rotulo">Lançar pedido</p>
                    <ul className="mt-2">
                      {PRATOS.map((prato) => {
                        const disp = disponibilidade.find(
                          (d) => d.pratoId === prato.id
                        );
                        const quantidade = rascunho[prato.id] ?? 0;
                        const bloqueado = !disp || disp.porcoes <= 0;
                        const teto = disp?.porcoes ?? 0;

                        return (
                          <li
                            key={prato.id}
                            className="flex items-center justify-between gap-3 border-b border-white/[0.06] py-2.5 last:border-b-0"
                          >
                            <div className="min-w-0">
                              <p
                                className={`truncate text-[13px] font-semibold ${
                                  bloqueado ? "text-marfim/35" : "text-marfim"
                                }`}
                              >
                                {prato.nome}
                              </p>
                              <p className="tabular mt-0.5 text-[11px] text-marfim/45">
                                {prato.tempoPreparoMinutos} min ·{" "}
                                {bloqueado ? (
                                  <span className="text-brasa-300">
                                    sem {disp?.limitante?.nome.toLowerCase() ?? "ingrediente"}
                                  </span>
                                ) : (
                                  `restam ${teto}`
                                )}
                              </p>
                            </div>
                            <Contador
                              valor={quantidade}
                              maximo={teto}
                              desabilitado={bloqueado}
                              aoMudar={(v) =>
                                setRascunho((r) => ({ ...r, [prato.id]: v }))
                              }
                            />
                          </li>
                        );
                      })}
                    </ul>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="tabular text-sm text-marfim/70">
                        {temRascunho ? dinheiro(totalRascunho) : "—"}
                      </span>
                      <button
                        type="button"
                        disabled={!temRascunho}
                        onClick={() => {
                          const itens = Object.entries(rascunho)
                            .filter(([, q]) => q > 0)
                            .map(([pratoId, quantidade]) => ({
                              pratoId,
                              quantidade,
                            }));

                          const recusado = itens.find(
                            (i) => !podeLancar(disponibilidade, i.pratoId, i.quantidade).pode
                          );
                          if (recusado) return;

                          lancarPedido(mesa.id, itens);
                          setRascunho({});
                        }}
                        className="rounded-xl bg-gradient-to-b from-jade-400 to-jade-500 px-4 py-2 text-[13px] font-bold text-tinta transition disabled:cursor-not-allowed disabled:from-white/10 disabled:to-white/10 disabled:text-marfim/35"
                      >
                        Mandar para a cozinha
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </Secao>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const CORES_PLANO = {
  livre: { rotulo: "Mesa pronta", cor: "text-jade-200", etiqueta: "jade" },
  juntar: { rotulo: "Juntar mesas", cor: "text-nevoa-300", etiqueta: "nevoa" },
  espera: { rotulo: "Com espera", cor: "text-ambar-200", etiqueta: "ambar" },
  "sem-opcao": { rotulo: "Sem opção", cor: "text-brasa-300", etiqueta: "brasa" },
} as const;

function CartaoDePlano({
  plano,
  indice,
}: {
  plano: PlanoDeChegada;
  indice: number;
}) {
  const estilo = CORES_PLANO[plano.situacao];

  return (
    <div
      className={`px-5 py-4 ${
        indice > 0 ? "border-t border-white/10 sm:border-t-0 sm:border-l" : ""
      } ${indice % 2 === 1 ? "sm:border-l sm:border-white/10" : ""} lg:border-l lg:border-white/10`}
    >
      <p className="rotulo">
        {plano.pessoas} pessoa{plano.pessoas > 1 ? "s" : ""}
      </p>

      <p className={`mt-2 font-display text-[26px] font-light leading-none ${estilo.cor}`}>
        {plano.situacao === "livre" && `Mesa ${plano.mesa?.numero}`}
        {plano.situacao === "juntar" &&
          plano.juntar?.map((m) => m.numero).join("+")}
        {plano.situacao === "espera" && `${plano.esperaMinutos} min`}
        {plano.situacao === "sem-opcao" && "—"}
      </p>

      <p className="mt-2 text-[11px] leading-snug text-marfim/55">
        {plano.explicacao}
      </p>
    </div>
  );
}

function SentarGrupo({
  mesa,
  pessoas,
  aoMudar,
  aoSentar,
}: {
  mesa: Mesa;
  pessoas: number;
  aoMudar: (v: number) => void;
  aoSentar: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="pessoas" className="rotulo">
          Quantas pessoas
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {Array.from({ length: mesa.lugares }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => aoMudar(n)}
              aria-pressed={n === pessoas}
              className={`h-10 w-10 rounded-xl border text-sm font-semibold transition ${
                n === pessoas
                  ? "border-jade-400/60 bg-jade-400/15 text-jade-200"
                  : "border-white/10 text-marfim/70 hover:border-white/25"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={aoSentar}
        className="w-full rounded-xl bg-gradient-to-b from-jade-400 to-jade-500 px-4 py-2.5 text-sm font-bold text-tinta transition"
      >
        Sentar {pessoas} na mesa {mesa.numero}
      </button>
    </div>
  );
}

function Contador({
  valor,
  maximo,
  desabilitado,
  aoMudar,
}: {
  valor: number;
  maximo: number;
  desabilitado: boolean;
  aoMudar: (v: number) => void;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        aria-label="Menos uma porção"
        disabled={desabilitado || valor <= 0}
        onClick={() => aoMudar(Math.max(0, valor - 1))}
        className="h-7 w-7 rounded-lg border border-white/12 text-marfim/70 transition hover:border-white/30 disabled:opacity-30"
      >
        −
      </button>
      <span className="tabular w-6 text-center text-sm font-semibold text-marfim">
        {valor}
      </span>
      <button
        type="button"
        aria-label="Mais uma porção"
        disabled={desabilitado || valor >= maximo}
        onClick={() => aoMudar(Math.min(maximo, valor + 1))}
        className="h-7 w-7 rounded-lg border border-white/12 text-marfim/70 transition hover:border-white/30 disabled:opacity-30"
      >
        +
      </button>
    </span>
  );
}
