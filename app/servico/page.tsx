"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  BlocoDoTrilho,
  Carregando,
  Etiqueta,
  Heroi,
  Secao,
  TelaComTrilho,
  TituloDoTrilho,
} from "../components/ui";
import {
  DIA_PADRAO,
  dataLocal,
  diaSemanaDe,
  dinheiro,
  duracao,
  inicioDoMes,
  nomeDoPrato,
} from "@/lib/dados";
import { feriadoDe } from "@/lib/feriados";
import { temperaturaTipicaPara } from "@/lib/padroes";
import { gerarResumoDoDia } from "@/lib/previsao";
import { chegadasProximas, picoAindaPorVir } from "@/lib/chegadas";
import FilaDeEspera from "../components/FilaDeEspera";
import Reservas from "../components/Reservas";
import Conta from "../components/Conta";
import Cardapio from "../components/Cardapio";
import { precoDe } from "@/lib/cardapio";
import { resumoDoCaixa } from "@/lib/conta";
import { contasDoDia } from "@/lib/fechamento";
import { motivoDaNegativa } from "@/lib/equipe";
import { MESAS, PRATOS, TEMPO_MEDIO_DE_REFEICAO } from "@/lib/restaurante";
import { calcularDisponibilidade, podeLancar } from "@/lib/disponibilidade";
import {
  listarNumeros,
  ocupacaoConjunta,
  ocupacoesDaJuncao,
  planejarChegadas,
  planejarGrupo,
  type EstadoDoSalao,
  type PlanoDeChegada,
} from "@/lib/salao";
import { pedidosAbertos, useOperacao } from "@/lib/operacao";
import type { Mesa } from "@/lib/tipos";

export default function ServicoPage() {
  const {
    pronto,
    ocupacoes,
    pedidos,
    agora,
    sentar,
    sentarNaJuncao,
    lancarPedido,
    cancelarItem,
    fila,
    entrarNaFila,
    sairDaFila,
    sentarDaFila,
    reservas,
    reservar,
    cancelarReserva,
    sentarReserva,
    contasFechadas,
    fecharConta,
    estoqueAtual,
    cardapio,
    autorizado,
    operador,
    reiniciarServico,
  } = useOperacao();

  const [mesaSelecionada, setMesaSelecionada] = useState<string | null>(null);
  const [pessoas, setPessoas] = useState(2);
  const [rascunho, setRascunho] = useState<Record<string, number>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmandoRecomeco, setConfirmandoRecomeco] = useState(false);

  const { salao, salaoParaNovos, planos, situacaoDaFila } = useMemo(
    () => planejarChegadas(ocupacoes, fila, reservas, agora),
    [ocupacoes, fila, reservas, agora]
  );

  // Contas de um dia não fechado ficam guardadas; o caixa conta só as de hoje.
  const caixa = useMemo(
    () => resumoDoCaixa(contasDoDia(contasFechadas, dataLocal(agora))),
    [contasFechadas, agora]
  );

  // Antes de pronto o relógio ainda marca a época zero (1969, sem histórico
  // para o modelo); o dia padrão só segura a conta até lá, e nada é mostrado.
  const hoje = pronto ? dataLocal(agora) : DIA_PADRAO;

  /*
   * Previsão de chegada do dia. Usa o clima típico da época: esta tela não
   * busca previsão do tempo — quem faz isso é o Painel.
   */
  const previsaoDoDia = useMemo(
    () =>
      gerarResumoDoDia(
        {
          diaSemana: diaSemanaDe(hoje),
          temperatura: temperaturaTipicaPara(hoje),
          chuva: false,
          feriado: Boolean(feriadoDe(hoje)),
          inicioMes: inicioDoMes(hoje),
        },
        hoje
      ),
    [hoje]
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
    () => calcularDisponibilidade(abertos, hoje, estoqueAtual, cardapio),
    [abertos, hoje, estoqueAtual, cardapio]
  );

  const mesa = MESAS.find((m) => m.id === mesaSelecionada) ?? null;
  // Numa junção, tocar qualquer mesa abre o grupo inteiro: as pessoas
  // somadas, os pedidos de todas as mesas e uma conta só.
  const juncao = mesaSelecionada ? ocupacoesDaJuncao(ocupacoes, mesaSelecionada) : [];
  const ocupacao = ocupacaoConjunta(juncao);
  const mesasDaConta =
    juncao.length > 0
      ? juncao
          .map((o) => MESAS.find((m) => m.id === o.mesaId))
          .filter((m): m is Mesa => Boolean(m))
      : mesa
        ? [mesa]
        : [];
  const idsDaConta = mesasDaConta.map((m) => m.id);
  const juntas = mesasDaConta.length > 1;
  const pedidosDaMesa = abertos.filter((p) => idsDaConta.includes(p.mesaId));

  // Abaixo de xl o painel da mesa fica depois do mapa: sem isto, o toque
  // na mesa não mostra nada. Com "nearest", em xl não rola.
  useEffect(() => {
    if (!mesaSelecionada) return;
    document
      .getElementById("painel-da-mesa")
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    document.getElementById("titulo-da-mesa")?.focus({ preventScroll: true });
  }, [mesaSelecionada]);

  if (!pronto) {
    return <Carregando titulo="Serviço">Abrindo o salão…</Carregando>;
  }

  const totalRascunho = Object.entries(rascunho).reduce(
    (s, [id, qtd]) => s + precoDe(cardapio, id) * qtd,
    0
  );
  const temRascunho = Object.values(rascunho).some((q) => q > 0);
  const mesaGuardada = mesa
    ? salao.mesasReservadas.find((r) => r.mesa.id === mesa.id)
    : undefined;
  const chegandoAgora = Boolean(proximas.seguinte && proximas.seguinte.pessoas > 0);
  const podeSalao = autorizado("gerenciarSalao");
  const podePedir = autorizado("lancarPedido");

  const escolherMesa = (m: Mesa) => {
    setMesaSelecionada(m.id);
    setPessoas(Math.min(m.lugares, 2));
    setRascunho({});
    setAviso(null);
  };

  // Grupo que nenhuma mesa comporta sozinha: senta juntando e já abre o
  // painel do grupo, pronto para lançar o pedido.
  const negativaDoSalao = podeSalao ? null : motivoDaNegativa(operador, "gerenciarSalao");
  const sentarJuntando = (mesas: Mesa[], grupo: number) => {
    sentarNaJuncao(
      mesas.map((m) => m.id),
      grupo
    );
    escolherMesa(mesas[0]);
  };

  /*
   * Uma linha por conta aberta: a junção aparece uma vez só, somando as
   * mesas. Parcial pelo que foi lançado, inclusive o que ainda está na
   * cozinha — a Conta só cobra o que saiu. Há mais tempo sentada, primeiro.
   */
  const porConta = new Map<
    string,
    { mesas: Mesa[]; pessoas: number; ha: number; parcial: number }
  >();
  for (const o of salao.mesasOcupadas) {
    const parcial = pedidos
      .filter((p) => p.mesaId === o.mesa.id)
      .flatMap((p) => p.itens)
      .reduce(
        (s, i) => s + (i.precoUnitario ?? precoDe(cardapio, i.pratoId)) * i.quantidade,
        0
      );
    const chave = o.ocupacao.grupo ?? o.mesa.id;
    const linha = porConta.get(chave);
    if (linha) {
      linha.mesas.push(o.mesa);
      linha.pessoas += o.ocupacao.pessoas;
      linha.ha = Math.max(linha.ha, o.ha);
      linha.parcial += parcial;
    } else {
      porConta.set(chave, {
        mesas: [o.mesa],
        pessoas: o.ocupacao.pessoas,
        ha: o.ha,
        parcial,
      });
    }
  }
  const mesasEmServico = [...porConta.values()].sort((a, b) => b.ha - a.ha);
  const parcialDoSalao = mesasEmServico.reduce((s, m) => s + m.parcial, 0);

  const trilho = (
    <>
      <TituloDoTrilho titulo="Serviço">
        O salão em tempo real. A resposta para quem entrar pela porta já está
        calculada.
      </TituloDoTrilho>

      <BlocoDoTrilho>
        <h2 className="rotulo mb-2.5">Se entrar um grupo agora</h2>
        <ul>
          {planos.map((plano) => (
            <LinhaDePlano
              key={plano.pessoas}
              plano={plano}
              aoJuntar={sentarJuntando}
              negativa={negativaDoSalao}
            />
          ))}
        </ul>
        <p className="mt-3 text-[11px] leading-snug text-marfim/55">
          Recalculado a cada mesa que senta ou levanta — nenhuma conta é feita na
          chegada do cliente.
        </p>
      </BlocoDoTrilho>

      <BlocoDoTrilho>
        <GrupoGrande
          salao={salaoParaNovos}
          aoJuntar={sentarJuntando}
          negativa={negativaDoSalao}
        />
      </BlocoDoTrilho>

      <BlocoDoTrilho rotulo="Caixa do dia">
        <p className="tabular font-display text-[34px] font-medium leading-none tracking-tight text-marfim">
          {dinheiro(caixa.faturamento)}
        </p>
        <p className="mt-2 text-xs leading-snug text-marfim/58">
          {caixa.contas
            ? `${caixa.contas} conta${caixa.contas > 1 ? "s" : ""} · ${dinheiro(caixa.ticketMedio)} por pessoa`
            : `${abertos.length} ${abertos.length === 1 ? "pedido aberto" : "pedidos abertos"}, nenhuma conta fechada`}
        </p>
      </BlocoDoTrilho>

      <BlocoDoTrilho rotulo="Salão agora">
        <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
          <div>
            <dt className="text-[11px] text-marfim/50">Mesas livres</dt>
            <dd
              className={`tabular mt-1 font-display text-[26px] font-medium leading-none tracking-tight ${
                salao.mesasLivres.length > 0 ? "text-nevoa-300" : "text-marfim"
              }`}
            >
              {salao.mesasLivres.length}/{MESAS.length}
            </dd>
            <dd className="mt-1.5 text-[11px] leading-snug text-marfim/50">
              {salao.lugaresLivres} lugares vagos
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-marfim/50">Pessoas no salão</dt>
            <dd className="tabular mt-1 font-display text-[26px] font-medium leading-none tracking-tight text-marfim">
              {salao.pessoasSentadas}
            </dd>
            <dd className="mt-1.5 text-[11px] leading-snug text-marfim/50">
              {salao.ocupacaoPercentual}% das mesas ocupadas
            </dd>
          </div>
          <div className="col-span-2 border-t border-white/[0.07] pt-4">
            <dt className="text-[11px] text-marfim/50">Chegando na próxima hora</dt>
            <dd
              className={`tabular mt-1 font-display text-[26px] font-medium leading-none tracking-tight ${
                chegandoAgora ? "text-fogo-300" : "text-marfim"
              }`}
            >
              {proximas.seguinte
                ? `${proximas.seguinte.pessoas} pessoa${proximas.seguinte.pessoas === 1 ? "" : "s"}`
                : "fora do serviço"}
            </dd>
            <dd className="mt-1.5 text-[11px] leading-snug text-marfim/50">
              {pico
                ? `pico ainda por vir às ${pico.rotulo} com ${pico.pessoas} pessoa${pico.pessoas === 1 ? "" : "s"}`
                : `giro médio de ${TEMPO_MEDIO_DE_REFEICAO} min por mesa`}
            </dd>
          </div>
        </dl>
      </BlocoDoTrilho>

      {autorizado("fecharODia") && (
        <BlocoDoTrilho rotulo="Serviço de exemplo">
          {!confirmandoRecomeco ? (
            <button
              type="button"
              onClick={() => setConfirmandoRecomeco(true)}
              className={BOTAO_SECUNDARIO + " w-full px-4 py-2 text-[13px]"}
            >
              Recomeçar com o serviço de exemplo
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-[12px] leading-snug text-marfim/70">
                Troca o salão, a fila, as reservas e as contas pelo exemplo — e
                zera também as entradas, perdas e baixas do estoque, os dias
                fechados e o cardápio de hoje. Dá para desfazer.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    reiniciarServico();
                    setConfirmandoRecomeco(false);
                    setMesaSelecionada(null);
                    setRascunho({});
                    setAviso(null);
                  }}
                  className={BOTAO_PRIMARIO + " flex-1 px-4 py-2 text-[13px]"}
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmandoRecomeco(false)}
                  className={BOTAO_SECUNDARIO + " px-4 py-2 text-[13px]"}
                >
                  Voltar
                </button>
              </div>
            </div>
          )}
        </BlocoDoTrilho>
      )}
    </>
  );

  return (
    <TelaComTrilho trilho={trilho}>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px] 2xl:gap-6">
        <Secao
          titulo="Mapa do salão"
          descricao="Clique numa mesa para sentar, lançar pedido ou fechar a conta."
          acao={<LegendaDoMapa />}
        >
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-7">
            {MESAS.map((m) => {
              const ocupada = salao.mesasOcupadas.find((o) => o.mesa.id === m.id);
              const guardada = salao.mesasReservadas.find(
                (r) => r.mesa.id === m.id
              );
              // A junção acende junto: tocar a 5 marca a 13 do mesmo grupo.
              const ativa = m.id === mesaSelecionada || idsDaConta.includes(m.id);
              const juntaCom = ocupada?.ocupacao.grupo
                ? ocupacoesDaJuncao(ocupacoes, m.id)
                : [];
              const outrasDaJuncao = juntaCom
                .filter((o) => o.mesaId !== m.id)
                .map((o) => MESAS.find((x) => x.id === o.mesaId))
                .filter((x): x is Mesa => Boolean(x));
              const pessoasDoGrupo = juntaCom.reduce((s, o) => s + o.pessoas, 0);

              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => escolherMesa(m)}
                  aria-pressed={ativa}
                  className={`min-w-0 rounded-2xl border px-3.5 py-3 text-left transition ${
                    ocupada
                      ? "border-fogo-500/35 bg-fogo-500/[0.08] hover:border-fogo-500/60"
                      : guardada
                        ? "border-ambar-500/35 bg-ambar-500/[0.08] hover:border-ambar-500/60"
                        : "border-nevoa-500/30 bg-white/[0.03] hover:border-nevoa-500/55"
                  } ${ativa ? "ring-2 ring-marfim/70" : ""}`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-lg font-medium text-marfim">
                      Mesa {m.numero}
                    </span>
                    <span className="tabular shrink-0 text-[11px] text-marfim/50">
                      {m.lugares} lug.
                    </span>
                  </span>
                  <span className="mt-1.5 block text-[11px] text-marfim/55">
                    {m.area}
                  </span>
                  <span className="mt-2 block">
                    {ocupada ? (
                      <>
                        <span className="tabular block text-[11px] font-semibold text-fogo-300">
                          {ocupada.ocupacao.pessoas} pessoa
                          {ocupada.ocupacao.pessoas > 1 ? "s" : ""} · há{" "}
                          {duracao(ocupada.ha)}
                        </span>
                        {outrasDaJuncao.length > 0 && (
                          <span className="tabular mt-0.5 block text-[11px] text-fogo-200/70">
                            grupo de {pessoasDoGrupo} com a{outrasDaJuncao.length > 1 ? "s" : ""}{" "}
                            {listarNumeros(outrasDaJuncao)}
                          </span>
                        )}
                      </>
                    ) : guardada ? (
                      <span className="tabular text-[11px] font-semibold text-ambar-300">
                        {guardada.reserva.nome} ·{" "}
                        {guardada.emMinutos > 0
                          ? `em ${guardada.emMinutos} min`
                          : guardada.emMinutos === 0
                            ? "agora"
                            : `${-guardada.emMinutos} min de atraso`}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-nevoa-300">
                        livre
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </Secao>

        {!mesa ? (
          <Secao
            titulo={
              mesasEmServico.length === 0 && salao.mesasReservadas.length > 0
                ? "Mesas guardadas"
                : "Mesas ocupadas"
            }
            descricao={
              mesasEmServico.length > 0
                ? "Da que está há mais tempo. Toque numa para abrir a mesa."
                : salao.mesasReservadas.length > 0
                  ? "Nenhuma mesa ocupada. Estas seguram lugar para reservas chegando."
                  : undefined
            }
            className="flex flex-col xl:self-stretch"
            classeDoMiolo="flex flex-1 flex-col"
          >
            {mesasEmServico.length > 0 ? (
              <>
                <ul>
                  {mesasEmServico.map(({ mesas, pessoas: n, ha, parcial }) => (
                    <li
                      key={mesas[0].id}
                      className="border-b border-white/[0.07] last:border-b-0"
                    >
                      <button
                        type="button"
                        onClick={() => escolherMesa(mesas[0])}
                        className="group -mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marfim/70"
                      >
                        <span className="min-w-0">
                          <span className="block font-display text-[17px] font-medium leading-tight text-marfim transition group-hover:text-fogo-200">
                            {mesas.length > 1
                              ? `Mesas ${listarNumeros(mesas)}`
                              : `Mesa ${mesas[0].numero}`}
                          </span>
                          <span className="tabular mt-0.5 block truncate text-[11px] font-semibold text-fogo-300">
                            {n} pessoa{n > 1 ? "s" : ""} · há {duracao(ha)}
                            {mesas.length > 1 ? " · conta única" : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span
                            className={`tabular block font-display text-[17px] font-medium leading-tight ${
                              parcial > 0 ? "text-marfim" : "text-marfim/45"
                            }`}
                          >
                            {parcial > 0 ? dinheiro(parcial) : "—"}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-marfim/50">
                            {parcial > 0 ? "parcial" : "sem pedido"}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-auto flex items-baseline justify-between gap-3 border-t border-white/[0.09] pt-4 text-[12px] text-marfim/58">
                  Em aberto no salão
                  <span className="tabular font-display text-lg font-medium text-marfim">
                    {dinheiro(parcialDoSalao)}
                  </span>
                </p>
              </>
            ) : salao.mesasReservadas.length > 0 ? (
              <ul>
                {salao.mesasReservadas.map(({ mesa: m, reserva, emMinutos }) => (
                  <li
                    key={m.id}
                    className="border-b border-white/[0.07] last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => escolherMesa(m)}
                      className="group -mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marfim/70"
                    >
                      <span className="min-w-0">
                        <span className="block font-display text-[17px] font-medium leading-tight text-marfim transition group-hover:text-fogo-200">
                          Mesa {m.numero}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-marfim/55">
                          {reserva.nome} · {reserva.pessoas} pessoa
                          {reserva.pessoas > 1 ? "s" : ""}
                        </span>
                      </span>
                      <span className="tabular shrink-0 text-[11px] font-semibold text-ambar-300">
                        {emMinutos > 0
                          ? `em ${emMinutos} min`
                          : emMinutos === 0
                            ? "agora"
                            : `${-emMinutos} min de atraso`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] leading-relaxed text-marfim/70">
                Nenhuma mesa ocupada e nenhuma guardada: as {MESAS.length} estão
                livres. Toque numa no mapa para sentar o primeiro grupo.
              </p>
            )}
          </Secao>
        ) : (
          <Heroi id="painel-da-mesa">
            <header className="flex items-start justify-between gap-3 border-b border-white/[0.09] px-6 pb-4 pt-5">
              <div className="min-w-0">
                <h2
                  id="titulo-da-mesa"
                  tabIndex={-1}
                  className="font-display text-[26px] font-medium leading-none tracking-tight text-marfim focus:outline-none"
                >
                  {juntas ? `Mesas ${listarNumeros(mesasDaConta)}` : `Mesa ${mesa.numero}`}
                </h2>
                <p className="mt-1.5 text-xs text-marfim/58">
                  {juntas
                    ? `${mesasDaConta.reduce((s, m) => s + m.lugares, 0)} lugares · juntadas, conta única`
                    : `${mesa.lugares} lugares · ${mesa.area}`}
                </p>
              </div>
              {ocupacao ? (
                <Etiqueta cor="fogoSuave">{juntas ? "ocupadas" : "ocupada"}</Etiqueta>
              ) : mesaGuardada ? (
                <Etiqueta cor="ambar">guardada</Etiqueta>
              ) : (
                <Etiqueta cor="nevoa">livre</Etiqueta>
              )}
            </header>

            <div className="px-6 pb-6 pt-5">
              {!ocupacao ? (
                <SentarGrupo
                  mesa={mesa}
                  pessoas={pessoas}
                  aoMudar={setPessoas}
                  aoSentar={() => sentar(mesa.id, pessoas)}
                  negativa={
                    podeSalao ? null : motivoDaNegativa(operador, "gerenciarSalao")
                  }
                />
              ) : (
                <div className="divide-y divide-white/[0.09]">
                  <p className="pb-5 text-[13px] text-marfim/70">
                    {ocupacao.pessoas} pessoa{ocupacao.pessoas > 1 ? "s" : ""}{" "}
                    sentada{ocupacao.pessoas > 1 ? "s" : ""} desde{" "}
                    {new Date(ocupacao.desde).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    .
                    {juntas &&
                      ` Um grupo só: o pedido lançado em qualquer das ${mesasDaConta.length} mesas cai na mesma conta.`}
                  </p>

                  {pedidosDaMesa.length > 0 && (
                    <div className="py-5">
                      <p className="rotulo">Pedidos em aberto</p>
                      <ul className="mt-2">
                        {pedidosDaMesa.map((p) => {
                          // Depois que a cozinha terminou, tirar item não é
                          // cancelamento: o prato existe e alguém paga por ele.
                          const cancelavel =
                            p.situacao === "na-fila" || p.situacao === "em-preparo";

                          return (
                            <li
                              key={p.id}
                              className="border-b border-white/[0.07] py-2 last:border-b-0"
                            >
                              <div className="flex items-baseline justify-between gap-3">
                                <span className="tabular text-[11px] text-marfim/55">
                                  {new Date(p.lancadoEm).toLocaleTimeString("pt-BR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                  {juntas &&
                                    ` · mesa ${MESAS.find((m) => m.id === p.mesaId)?.numero ?? "?"}`}
                                </span>
                                <Etiqueta
                                  cor={p.situacao === "pronto" ? "fogo" : "neutro"}
                                >
                                  {p.situacao.replace("-", " ")}
                                </Etiqueta>
                              </div>
                              <ul className="mt-1.5 space-y-1">
                                {p.itens.map((i) => (
                                  <li
                                    key={i.pratoId}
                                    className="flex items-center justify-between gap-3 text-[13px]"
                                  >
                                    <span className="min-w-0 truncate text-marfim/80">
                                      {i.quantidade}× {nomeDoPrato(i.pratoId)}
                                    </span>
                                    {autorizado("lancarPedido") && (
                                      <button
                                        type="button"
                                        disabled={!cancelavel}
                                        onClick={() => cancelarItem(p.id, i.pratoId)}
                                        title={
                                          cancelavel
                                            ? `Cancelar 1 ${nomeDoPrato(i.pratoId)}`
                                            : "Já saiu da cozinha — feche a conta ou registre perda"
                                        }
                                        className="shrink-0 rounded-lg border border-white/12 px-2 py-0.5 text-[11px] font-semibold text-marfim/60 transition hover:border-brasa-300/50 hover:text-brasa-300 disabled:cursor-not-allowed disabled:opacity-30"
                                      >
                                        −1
                                      </button>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  <div className="py-5">
                    <p className="rotulo">Conta</p>
                    <div className="mt-2">
                      <Conta
                        // Trocar de mesa no meio da confirmação não pode
                        // fechar a conta da outra.
                        key={idsDaConta.join()}
                        mesas={mesasDaConta}
                        ocupacao={ocupacao}
                        pedidosDaMesa={pedidos.filter((p) => idsDaConta.includes(p.mesaId))}
                        agora={agora}
                        aoFechar={(comServico, total) => {
                          fecharConta(mesa.id, comServico, total);
                          setRascunho({});
                          setMesaSelecionada(null);
                        }}
                      />
                    </div>
                  </div>

                  <div className="pt-5">
                    <p className="rotulo">
                      Lançar pedido{juntas && ` · a cozinha vê a mesa ${mesa.numero}`}
                    </p>
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
                            className="flex items-center justify-between gap-3 border-b border-white/[0.07] py-2.5 last:border-b-0"
                          >
                            <div className="min-w-0">
                              <p
                                className={`truncate text-[13px] font-semibold ${
                                  bloqueado ? "text-marfim/35" : "text-marfim"
                                }`}
                              >
                                {prato.nome}
                              </p>
                              <p className="tabular mt-0.5 text-[11px] text-marfim/55">
                                {prato.tempoPreparoMinutos} min ·{" "}
                                {bloqueado ? (
                                  disp?.situacao === "pausado" ? (
                                    <span className="text-ambar-300">
                                      pausado no cardápio
                                    </span>
                                  ) : (
                                    <span className="text-brasa-300">
                                      {`sem ${disp?.limitante?.nome.toLowerCase() ?? "ingrediente"}`}
                                    </span>
                                  )
                                ) : (
                                  `${teto === 1 ? "resta" : "restam"} ${teto}`
                                )}
                              </p>
                            </div>
                            <Contador
                              nome={prato.nome}
                              valor={quantidade}
                              maximo={teto}
                              desabilitado={bloqueado || !podePedir}
                              aoMudar={(v) => {
                                setRascunho((r) => ({ ...r, [prato.id]: v }));
                                setAviso(null);
                              }}
                            />
                          </li>
                        );
                      })}
                    </ul>

                    {!podePedir && (
                      <p className="vidro-ambar mt-4 rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed text-ambar-200">
                        {motivoDaNegativa(operador, "lancarPedido")}
                      </p>
                    )}

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span
                        className={`tabular font-display text-lg font-medium ${
                          temRascunho ? "text-fogo-100" : "text-marfim/45"
                        }`}
                      >
                        {temRascunho ? dinheiro(totalRascunho) : "—"}
                      </span>
                      <button
                        type="button"
                        disabled={!temRascunho || !podePedir}
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
                          if (recusado) {
                            const { motivo } = podeLancar(
                              disponibilidade,
                              recusado.pratoId,
                              recusado.quantidade
                            );
                            setAviso(
                              `${nomeDoPrato(recusado.pratoId)}: ${motivo ?? "não dá para lançar agora."} Tire do pedido para mandar o resto.`
                            );
                            return;
                          }

                          lancarPedido(mesa.id, itens);
                          setRascunho({});
                          setAviso(null);
                        }}
                        className={BOTAO_PRIMARIO + " px-4 py-2 text-[13px]"}
                      >
                        Mandar para a cozinha
                      </button>
                    </div>

                    {aviso && (
                      <p
                        role="alert"
                        className="vidro-ambar mt-3 rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed text-ambar-200"
                      >
                        {aviso}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Heroi>
        )}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          <FilaDeEspera
            situacao={situacaoDaFila}
            aoEntrar={entrarNaFila}
            aoSair={sairDaFila}
            aoSentar={sentarDaFila}
          />
          <Cardapio />
        </div>

        <Reservas
          reservas={reservas}
          agora={agora}
          aoReservar={reservar}
          aoCancelar={cancelarReserva}
          aoChegar={sentarReserva}
        />
      </div>
    </TelaComTrilho>
  );
}

/* ------------------------------------------------------------------ */

const CORES_PLANO = {
  livre: { rotulo: "Mesa pronta", cor: "text-nevoa-300" },
  juntar: { rotulo: "Juntar mesas", cor: "text-fogo-300" },
  espera: { rotulo: "Com espera", cor: "text-ambar-300" },
  "sem-opcao": { rotulo: "Sem opção", cor: "text-brasa-300" },
} as const;

/** A resposta curta que a recepção lê: a mesa, a junção, a espera ou nada. */
function respostaDoPlano(plano: PlanoDeChegada): string {
  switch (plano.situacao) {
    case "livre":
      return `Mesa ${plano.mesa?.numero}`;
    case "juntar":
      return plano.juntar?.map((m) => m.numero).join("+") ?? "";
    case "espera":
      return `${plano.esperaMinutos} min`;
    case "sem-opcao":
      return "—";
  }
}

/**
 * Junção é a única resposta que o mapa não resolve com um toque: sentar em
 * duas mesas de uma vez precisa do botão, que já liga as mesas numa conta só.
 */
function BotaoDeJuntar({
  plano,
  aoJuntar,
  negativa,
  className,
}: {
  plano: PlanoDeChegada;
  aoJuntar: (mesas: Mesa[], pessoas: number) => void;
  negativa: string | null;
  className: string;
}) {
  // Quem não pode sentar ninguém não vê o botão: a explicação aparece ao
  // tocar numa mesa do mapa, como em qualquer outra mesa.
  if (plano.situacao !== "juntar" || !plano.juntar || negativa) return null;
  const mesas = plano.juntar;

  return (
    <button
      type="button"
      onClick={() => aoJuntar(mesas, plano.pessoas)}
      className={className}
    >
      Sentar {plano.pessoas} juntando as mesas {listarNumeros(mesas)}
    </button>
  );
}

function LinhaDePlano({
  plano,
  aoJuntar,
  negativa,
}: {
  plano: PlanoDeChegada;
  aoJuntar: (mesas: Mesa[], pessoas: number) => void;
  negativa: string | null;
}) {
  const estilo = CORES_PLANO[plano.situacao];

  return (
    <li className="border-b border-white/[0.07] py-2.5 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-marfim/75">
          {plano.pessoas} pessoa{plano.pessoas > 1 ? "s" : ""}
        </span>
        <span
          className={`tabular font-display text-[19px] font-medium leading-none ${estilo.cor}`}
        >
          {respostaDoPlano(plano)}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-marfim/55">
        {plano.explicacao}
      </p>
      <BotaoDeJuntar
        plano={plano}
        aoJuntar={aoJuntar}
        negativa={negativa}
        className="mt-2 rounded-lg border border-fogo-500/35 px-2.5 py-1 text-[11px] font-semibold text-fogo-200 transition enabled:hover:border-fogo-500/60 enabled:hover:bg-fogo-500/10 disabled:cursor-not-allowed disabled:opacity-40"
      />
    </li>
  );
}

/**
 * Grupos acima dos seis pré-calculados: a recepção digita o tamanho e a
 * resposta sai da mesma conta das linhas de cima, juntando até três mesas.
 */
function GrupoGrande({
  salao,
  aoJuntar,
  negativa,
}: {
  salao: EstadoDoSalao;
  aoJuntar: (mesas: Mesa[], pessoas: number) => void;
  negativa: string | null;
}) {
  const [pessoas, setPessoas] = useState(10);
  const plano = useMemo(
    () => (pessoas >= 1 ? planejarGrupo(salao, pessoas) : null),
    [salao, pessoas]
  );
  const estilo = plano ? CORES_PLANO[plano.situacao] : null;

  return (
    <>
      <label htmlFor="grupo-grande" className="rotulo block">
        Grupo maior
      </label>
      <div className="mt-2.5 flex items-center gap-3">
        <input
          id="grupo-grande"
          type="number"
          min={1}
          max={40}
          value={pessoas}
          step={1}
          // Gente é inteira: "10,5" viraria meia pessoa na conta e no histórico.
          onChange={(e) => setPessoas(Math.floor(Number(e.target.value)))}
          className="campo tabular !w-20 !py-1.5 !text-[13px]"
        />
        <span className="text-[13px] text-marfim/55">pessoas</span>
        {plano && estilo && (
          <span
            className={`tabular ml-auto font-display text-[19px] font-medium leading-none ${estilo.cor}`}
          >
            {respostaDoPlano(plano)}
          </span>
        )}
      </div>
      {plano && estilo && (
        <p className="mt-2.5 text-[12px] leading-snug">
          <span className={`font-semibold ${estilo.cor}`}>{estilo.rotulo}.</span>{" "}
          <span className="text-marfim/62">{plano.explicacao}</span>
        </p>
      )}
      {plano && (
        <BotaoDeJuntar
          plano={plano}
          aoJuntar={aoJuntar}
          negativa={negativa}
          className={BOTAO_SECUNDARIO + " mt-3 w-full px-4 py-2 text-[13px]"}
        />
      )}
    </>
  );
}

const LEGENDA_DO_MAPA = [
  { rotulo: "livre", ponto: "bg-nevoa-300" },
  { rotulo: "ocupada", ponto: "bg-fogo-400" },
  { rotulo: "guardada", ponto: "bg-ambar-300" },
] as const;

function LegendaDoMapa() {
  return (
    <ul
      aria-label="Legenda do mapa"
      className="flex flex-wrap items-center gap-x-3.5 gap-y-1 pt-1 text-[11px] text-marfim/60"
    >
      {LEGENDA_DO_MAPA.map((item) => (
        <li key={item.rotulo} className="flex items-center gap-1.5">
          <span aria-hidden className={`h-2 w-2 rounded-full ${item.ponto}`} />
          {item.rotulo}
        </li>
      ))}
    </ul>
  );
}

function SentarGrupo({
  mesa,
  pessoas,
  aoMudar,
  aoSentar,
  negativa,
}: {
  mesa: Mesa;
  pessoas: number;
  aoMudar: (v: number) => void;
  aoSentar: () => void;
  /** Por que o operador não pode sentar; sem isso, o botão fica ativo. */
  negativa: string | null;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p id="rotulo-pessoas" className="rotulo">
          Quantas pessoas
        </p>
        <div
          role="group"
          aria-labelledby="rotulo-pessoas"
          className="mt-2 flex flex-wrap gap-2"
        >
          {Array.from({ length: mesa.lugares }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => aoMudar(n)}
              aria-pressed={n === pessoas}
              className={`tabular h-10 w-10 rounded-xl border text-sm font-semibold transition ${
                n === pessoas
                  ? "border-fogo-400/60 bg-fogo-500/15 text-fogo-200"
                  : "border-white/10 text-marfim/70 hover:border-white/25"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {negativa && (
        <p className="vidro-ambar rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed text-ambar-200">
          {negativa}
        </p>
      )}

      <button
        type="button"
        onClick={aoSentar}
        disabled={Boolean(negativa)}
        className={BOTAO_PRIMARIO + " w-full px-4 py-2.5 text-sm"}
      >
        Sentar {pessoas} na mesa {mesa.numero}
      </button>
    </div>
  );
}

function Contador({
  nome,
  valor,
  maximo,
  desabilitado,
  aoMudar,
}: {
  nome: string;
  valor: number;
  maximo: number;
  /** Trava só o "+": prato pausado ou esgotado ainda sai do rascunho. */
  desabilitado: boolean;
  aoMudar: (v: number) => void;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        aria-label={`Menos uma porção de ${nome}`}
        disabled={valor <= 0}
        onClick={() => aoMudar(Math.max(0, valor - 1))}
        className="h-9 w-9 rounded-lg border border-white/12 text-marfim/70 transition hover:border-white/30 disabled:opacity-30"
      >
        −
      </button>
      <output className="tabular w-6 text-center text-sm font-semibold text-marfim">
        {valor}
      </output>
      <button
        type="button"
        aria-label={`Mais uma porção de ${nome}`}
        disabled={desabilitado || valor >= maximo}
        onClick={() => aoMudar(Math.min(maximo, valor + 1))}
        className="h-9 w-9 rounded-lg border border-white/12 text-marfim/70 transition hover:border-white/30 disabled:opacity-30"
      >
        +
      </button>
    </span>
  );
}
