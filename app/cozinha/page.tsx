"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BOTAO_PRIMARIO,
  BlocoDoTrilho,
  Carregando,
  Etiqueta,
  Heroi,
  LinhaDeNumeros,
  TelaComTrilho,
  TituloDoTrilho,
  Vazio,
} from "../components/ui";
import { dataLocal, duracao, quantidade } from "@/lib/dados";
import { motivoDaNegativa } from "@/lib/equipe";
import { mesaPorId } from "@/lib/restaurante";
import {
  PRAZO_ALVO_MINUTOS,
  cargaDasEstacoes,
  montarAgenda,
  type ItemAgendado,
  type PedidoAgendado,
} from "@/lib/cozinha";
import { calcularDisponibilidade } from "@/lib/disponibilidade";
import { pedidosAbertos, useOperacao } from "@/lib/operacao";

/**
 * Uma cor por posto. Fica só nas barras e nas amostras: o estado da mesa
 * (folga, risco, atraso) vai em texto, com as cores da casa.
 */
const COR_DO_POSTO: Record<string, string> = {
  fogao: "#E08DB5",
  grelha: "#A897F0",
  fritura: "#62C0CF",
  frio: "#C9D6E3",
};
const corDoPosto = (id: string) => COR_DO_POSTO[id] ?? "#C9D6E3";

const POSTOS_DA_LEGENDA = [
  { id: "fogao", nome: "Fogão" },
  { id: "grelha", nome: "Grelha" },
  { id: "fritura", nome: "Fritura e forno" },
  { id: "frio", nome: "Praça fria" },
];

const HORA = { hour: "2-digit", minute: "2-digit" } as const;

/** "15:54": a hora do relógio daqui a tantos minutos. */
const horaDaqui = (agora: Date, minutos: number) =>
  new Date(agora.getTime() + minutos * 60000).toLocaleTimeString("pt-BR", HORA);

const horaDe = (iso: string, somarMinutos = 0) =>
  new Date(new Date(iso).getTime() + somarMinutos * 60000).toLocaleTimeString("pt-BR", HORA);

/**
 * A régua e as mesas usam a mesma grade: é o que faz o minuto 14 cair no
 * mesmo ponto em todas as linhas. Abaixo de xl a trilha ocupa a largura toda
 * nas duas, e continua batendo.
 */
const GRADE = "xl:grid-cols-[176px_minmax(0,1fr)_112px] xl:gap-x-6";

/** Largura aproximada de um texto de 11 px, para decidir se cabe na barra. */
const larguraDoTexto = (texto: string) => texto.length * 6.2;

export default function CozinhaPage() {
  const {
    pronto,
    pedidos,
    agora,
    mudarSituacao,
    estoqueAtual,
    cardapio,
    autorizado,
    operador,
  } = useOperacao();
  const pode = autorizado("tocarCozinha");

  const abertos = useMemo(() => pedidosAbertos(pedidos), [pedidos]);
  const agenda = useMemo(() => montarAgenda(abertos, agora), [abertos, agora]);
  const carga = useMemo(() => cargaDasEstacoes(agenda), [agenda]);
  const hoje = dataLocal(agora);
  const disponibilidade = useMemo(
    () => calcularDisponibilidade(abertos, hoje, estoqueAtual, cardapio),
    [abertos, hoje, estoqueAtual, cardapio]
  );

  // A régua mede a trilha; as linhas usam a medida para decidir se o nome
  // do prato cabe dentro da barra. Antes da primeira medida, uma estimativa.
  const [largura, setLargura] = useState(0);
  const aoMedir = useCallback((px: number) => setLargura(px), []);

  if (!pronto) {
    return <Carregando titulo="Cozinha">Montando a fila…</Carregando>;
  }

  const atrasados = agenda.filter((p) => p.atrasado);
  const proxima = agenda.length
    ? agenda.reduce((a, b) => (b.prontoEm < a.prontoEm ? b : a))
    : null;

  // A régua vai até a última saída, com no mínimo a meta; de 10 em 10 min,
  // ou de 15 em 15 quando passa de uma hora.
  const maisLonge = Math.max(PRAZO_ALVO_MINUTOS, ...agenda.map((p) => p.prontoEm));
  const passo = maisLonge > 60 ? 15 : 10;
  const horizonte = Math.ceil(maisLonge / passo) * passo;

  const emFalta = disponibilidade.filter((d) => d.situacao !== "disponivel");
  // Os postos vêm sempre todos; com tudo em 0% não há "mais apertado".
  const maisApertado = carga.some((e) => e.ocupacao > 0)
    ? [...carga].sort((a, b) => b.ocupacao - a.ocupacao)[0]
    : null;

  const trilho = (
    <>
      <TituloDoTrilho titulo="Cozinha">
        Os pratos de uma mesma mesa saem juntos, então quem demora mais entra
        primeiro no posto. A fila respeita a ordem de chegada dos pedidos.
      </TituloDoTrilho>

      <BlocoDoTrilho
        rotulo="Carga dos postos"
        acao={<span className="text-[11px] text-marfim/55">próx. 30 min</span>}
      >
        <p className="mb-3 text-[11px] leading-relaxed text-marfim/50">
          Quanto de cada posto está comprometido na próxima meia hora.
        </p>
        <ul className="space-y-3">
          {carga.map((e) => (
            <li key={e.id}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-marfim">
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: corDoPosto(e.id) }}
                  />
                  <span className="truncate">{e.nome}</span>
                </span>
                <span
                  className={`tabular shrink-0 text-[11px] ${
                    e.ocupacao >= 85
                      ? "font-bold text-brasa-300"
                      : "text-marfim/55"
                  }`}
                >
                  {e.ocupacao}%
                </span>
              </div>
              <span className="relative mt-1.5 block h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <span
                  className={`absolute inset-y-0 left-0 rounded-full ${
                    e.ocupacao >= 85
                      ? "bg-brasa-300"
                      : e.ocupacao >= 60
                        ? "bg-ambar-500"
                        : "bg-nevoa-500/45"
                  }`}
                  style={{ width: `${Math.max(e.ocupacao, 1.5)}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      </BlocoDoTrilho>

      <BlocoDoTrilho rotulo="O que ainda dá para fazer">
        <p className="mb-3 text-[11px] leading-relaxed text-marfim/50">
          Estoque menos o que os pedidos em aberto já comprometeram. O salão não
          consegue lançar o que aparece esgotado aqui.
        </p>
        {emFalta.length === 0 ? (
          <p className="text-[13px] leading-relaxed text-nevoa-300">
            Todos os pratos do cardápio com folga de estoque.
          </p>
        ) : (
          <ul>
            {emFalta.map((d) => (
              <li
                key={d.pratoId}
                className="border-b border-white/[0.07] py-2.5 first:pt-0 last:border-b-0 last:pb-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <p
                    className={`min-w-0 text-[13px] font-semibold leading-snug ${
                      d.situacao === "esgotado"
                        ? "text-brasa-300"
                        : d.situacao === "pausado"
                          ? "text-marfim/45"
                          : "text-marfim"
                    }`}
                  >
                    {d.nome}
                  </p>
                  <Etiqueta
                    cor={
                      d.situacao === "esgotado"
                        ? "brasa"
                        : d.situacao === "ultimas"
                          ? "ambar"
                          : "neutro"
                    }
                  >
                    {d.situacao === "esgotado"
                      ? "não dá mais"
                      : d.situacao === "pausado"
                        ? "pausado"
                        : `${d.porcoes} porç${d.porcoes === 1 ? "ão" : "ões"}`}
                  </Etiqueta>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-marfim/50">
                  {d.situacao === "pausado"
                    ? "pausado no cardápio pelo gerente"
                    : d.limitante
                      ? `${d.limitante.nome}: ${quantidade(d.limitante.restante, d.limitante.unidade)} em estoque`
                      : "sem ingrediente cadastrado"}
                  {d.comprometidas > 0 &&
                    ` · ${d.comprometidas} já comprometida${d.comprometidas > 1 ? "s" : ""}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </BlocoDoTrilho>

      <BlocoDoTrilho rotulo="Meta da casa">
        <p className="flex items-baseline gap-2">
          <span className="tabular font-display text-[34px] font-medium leading-none tracking-tight text-marfim">
            {PRAZO_ALVO_MINUTOS}
          </span>
          <span className="text-[13px] text-marfim/60">
            min do pedido à mesa
          </span>
        </p>
      </BlocoDoTrilho>
    </>
  );

  const mesaDaProxima = proxima ? mesaPorId(proxima.pedido.mesaId)?.numero : null;

  return (
    <TelaComTrilho trilho={trilho}>
      <LinhaDeNumeros
        itens={[
          {
            rotulo: "Pedidos na fila",
            valor: String(agenda.length),
            detalhe: `${agenda.filter((p) => p.pedido.situacao === "em-preparo").length} já em preparo`,
          },
          {
            rotulo: "Próxima saída",
            valor: proxima ? horaDaqui(agora, proxima.prontoEm) : "—",
            detalhe: proxima
              ? `Mesa ${mesaDaProxima ?? "?"}, ${proxima.prontoEm > 0 ? `em ${proxima.prontoEm} min` : "agora"}`
              : "nenhum pedido na cozinha",
            forte: true,
          },
          {
            rotulo: "Fora do prazo",
            valor: String(atrasados.length),
            detalhe: `saem depois de ${PRAZO_ALVO_MINUTOS} min do pedido`,
          },
          {
            rotulo: "Posto mais apertado",
            valor: maisApertado ? maisApertado.nome : "—",
            detalhe: maisApertado
              ? `${maisApertado.ocupacao}% da meia hora`
              : "nenhum posto ocupado",
          },
        ]}
      />

      <Heroi>
        <header className="px-6 pb-4 pt-5">
          <h2 className="font-display text-[19px] font-semibold tracking-tight text-marfim">
            Fila de produção
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-marfim/60">
            Cada barra é um prato no seu posto. Os pratos de uma mesa terminam
            juntos, na linha laranja; o tracejado âmbar é o prazo da mesa.
          </p>
          <ul
            aria-label="Legenda"
            className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-marfim/75"
          >
            {POSTOS_DA_LEGENDA.map((p) => (
              <li key={p.id} className="flex items-center gap-1.5">
                <AmostraDoPosto cor={corDoPosto(p.id)} />
                {p.nome}
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <AmostraDoPosto cor={corDoPosto("frio")} noFogo />
              barra cheia: já no fogo
            </li>
          </ul>
          {!pode && (
            <p className="vidro-ambar mt-3 rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed text-ambar-200">
              {motivoDaNegativa(operador, "tocarCozinha")}
            </p>
          )}
        </header>

        {agenda.length === 0 ? (
          <div className="border-t border-white/10 px-6 py-8">
            <Vazio>Nenhum pedido na fila. A cozinha está limpa.</Vazio>
          </div>
        ) : (
          <>
            <ReguaDoTempo
              horizonte={horizonte}
              passo={passo}
              agora={agora}
              aoMedir={aoMedir}
            />
            <div>
              {agenda.map((p) => (
                <LinhaDaFila
                  key={p.pedido.id}
                  agendado={p}
                  horizonte={horizonte}
                  passo={passo}
                  largura={largura || 480}
                  agora={agora}
                  aoAvancar={mudarSituacao}
                  desabilitado={!pode}
                />
              ))}
            </div>
          </>
        )}
      </Heroi>
    </TelaComTrilho>
  );
}

/* ------------------------------------------------------------------ */

function AmostraDoPosto({ cor, noFogo = false }: { cor: string; noFogo?: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-block h-2.5 w-3.5 rounded-[3px]"
      style={{ background: `${cor}${noFogo ? "80" : "3D"}`, border: `1px solid ${cor}${noFogo ? "" : "BF"}` }}
    />
  );
}

/** A régua de tempo, uma vez só para todas as mesas: hora do relógio e +min. */
function ReguaDoTempo({
  horizonte,
  passo,
  agora,
  aoMedir,
}: {
  horizonte: number;
  passo: number;
  agora: Date;
  aoMedir: (px: number) => void;
}) {
  const trilha = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = trilha.current;
    if (!el) return;
    const observador = new ResizeObserver(([entrada]) => aoMedir(entrada.contentRect.width));
    observador.observe(el);
    return () => observador.disconnect();
  }, [aoMedir]);

  const marcas = Array.from({ length: horizonte / passo + 1 }, (_, i) => i * passo);

  return (
    <div
      className={`grid grid-cols-1 border-t border-white/10 px-6 pb-2 pt-3 ${GRADE}`}
    >
      <p className="hidden self-end text-[11px] text-marfim/55 xl:block">mesa e prazo</p>
      <div ref={trilha} className="relative h-8" aria-hidden>
        {marcas.map((m, i) => {
          const primeira = i === 0;
          const ultima = i === marcas.length - 1;
          return (
            <span
              key={m}
              className={`tabular absolute top-0 whitespace-nowrap text-[11px] leading-[14px] ${
                primeira ? "text-fogo-300" : "text-marfim/80"
              }`}
              style={
                primeira
                  ? { left: 0 }
                  : ultima
                    ? { right: 0, textAlign: "right" }
                    : { left: `${(m / horizonte) * 100}%`, transform: "translateX(-50%)", textAlign: "center" }
              }
            >
              {horaDaqui(agora, m)}
              <br />
              <span className={primeira ? "" : "text-marfim/50"}>
                {primeira ? "agora" : `+${m}`}
              </span>
            </span>
          );
        })}
      </div>
      <p className="hidden self-end text-right text-[11px] text-marfim/55 xl:block">sai às</p>
    </div>
  );
}

function LinhaDaFila({
  agendado,
  horizonte,
  passo,
  largura,
  agora,
  aoAvancar,
  desabilitado,
}: {
  agendado: PedidoAgendado;
  horizonte: number;
  passo: number;
  /** Largura da trilha em px, medida na régua. */
  largura: number;
  agora: Date;
  aoAvancar: (pedidoId: string, situacao: "em-preparo" | "pronto") => void;
  desabilitado: boolean;
}) {
  const mesa = mesaPorId(agendado.pedido.mesaId);
  const numero = mesa?.numero ?? "?";
  const emPreparo = agendado.pedido.situacao === "em-preparo";
  // O plano manda começar depois: o posto está ocupado por outra mesa.
  const planoDizDepois = !emPreparo && agendado.comecaEm > 0;
  const pct = (min: number) => `${(Math.min(Math.max(min, 0), horizonte) / horizonte) * 100}%`;
  const marcas = Array.from({ length: horizonte / passo }, (_, i) => (i + 1) * passo);
  const { folga, estadoDoPrazo, passouDoPrevisto } = agendado;

  return (
    // Abaixo de xl a linha do tempo desce para baixo da mesa e do botão.
    <div
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-3 border-t border-white/[0.07] px-6 py-4 xl:items-center ${GRADE}`}
    >
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-marfim">
          <span className="font-display text-[17px] font-medium">Mesa {numero}</span>
          <Etiqueta cor={emPreparo ? "fogoSuave" : "neutro"}>
            {emPreparo ? "em preparo" : "na fila"}
          </Etiqueta>
        </p>
        <p className="tabular mt-0.5 text-[11px] text-marfim/55">
          pedido {horaDe(agendado.pedido.lancadoEm)} · prazo{" "}
          {horaDe(agendado.pedido.lancadoEm, PRAZO_ALVO_MINUTOS)}
        </p>
        <p
          className={`tabular text-[11px] font-semibold ${
            estadoDoPrazo === "atrasado"
              ? "text-brasa-300"
              : estadoDoPrazo === "risco"
                ? "text-ambar-300"
                : "text-nevoa-300"
          }`}
        >
          {folga < 0
            ? `${duracao(-folga)} além do prazo`
            : folga === 0
              ? "sai no limite do prazo"
              : `${duracao(folga)} de folga`}
        </p>
      </div>

      {/* Linha do tempo: cada faixa é um prato no seu posto. */}
      <div className="relative order-last col-span-2 py-1 xl:order-none xl:col-span-1">
        <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-fogo-500/50" />
        {marcas.map((m) => (
          <span
            key={m}
            aria-hidden
            className="absolute inset-y-0 w-px bg-white/[0.08]"
            style={{ left: m === horizonte ? "calc(100% - 1px)" : pct(m) }}
          />
        ))}
        {agendado.prazoEm > 0 && agendado.prazoEm <= horizonte && (
          <span
            aria-hidden
            className="absolute inset-y-0 border-l-2 border-dashed border-ambar-500"
            style={{ left: agendado.prazoEm === horizonte ? "calc(100% - 2px)" : pct(agendado.prazoEm) }}
          />
        )}

        {passouDoPrevisto > 0 ? (
          <p className="relative py-1.5 text-[12px] font-semibold text-ambar-300">
            Pelo plano, os pratos já deviam ter saído — passou{" "}
            {duracao(passouDoPrevisto)} do previsto.
          </p>
        ) : (
          <div className="relative space-y-1">
            {agendado.itens.map((item) => (
              <FaixaDoPrato
                key={item.pratoId}
                item={item}
                noFogo={emPreparo && item.inicio <= 0}
                horizonte={horizonte}
                largura={largura}
                agora={agora}
              />
            ))}
          </div>
        )}

        {passouDoPrevisto === 0 && (
          <span
            aria-hidden
            className="absolute inset-y-0.5 w-0.5 rounded-full bg-fogo-500"
            style={{ left: `calc(${pct(agendado.prontoEm)} - 1px)` }}
          />
        )}
      </div>

      <div className="flex flex-col items-end gap-1.5">
        <span className="tabular font-display text-[22px] font-medium leading-none text-fogo-200">
          {horaDaqui(agora, passouDoPrevisto > 0 ? -passouDoPrevisto : agendado.prontoEm)}
        </span>
        <span
          className={`tabular text-[11px] ${
            passouDoPrevisto > 0 ? "font-semibold text-ambar-300" : "text-marfim/55"
          }`}
        >
          {passouDoPrevisto > 0
            ? `passou ${duracao(passouDoPrevisto)}`
            : agendado.prontoEm > 0
              ? `em ${agendado.prontoEm} min`
              : "agora"}
        </span>
        <button
          type="button"
          disabled={desabilitado}
          aria-label={`${emPreparo ? "Pronto" : planoDizDepois ? "Adiantar" : "Iniciar"} — mesa ${numero}`}
          title={
            planoDizDepois
              ? `O plano começa às ${horaDaqui(agora, agendado.comecaEm)}, quando o posto vaga. Adiantar começa agora, fora do plano.`
              : undefined
          }
          onClick={() =>
            aoAvancar(agendado.pedido.id, emPreparo ? "pronto" : "em-preparo")
          }
          className={
            emPreparo
              ? BOTAO_PRIMARIO + " mt-0.5 border border-transparent px-3 py-1.5 text-[12px]"
              : planoDizDepois
                ? "mt-0.5 rounded-xl border border-white/16 px-3 py-1.5 text-[12px] font-semibold text-marfim/60 transition enabled:hover:border-white/30 enabled:hover:text-marfim disabled:cursor-not-allowed disabled:opacity-35"
                : "mt-0.5 rounded-xl border border-fogo-400/60 px-3 py-1.5 text-[12px] font-semibold text-fogo-200 transition enabled:hover:border-fogo-400 enabled:hover:bg-fogo-500/10 disabled:cursor-not-allowed disabled:opacity-35"
          }
        >
          {emPreparo ? "Pronto" : planoDizDepois ? "Adiantar" : "Iniciar"}
        </button>
      </div>
    </div>
  );
}

/**
 * Um prato na trilha. O nome vai dentro da barra quando cabe; senão, encosta
 * nela pelo lado que tiver espaço. À esquerda fica a hora em que ele entra —
 * e, quando quem segura é o posto cheio, o motivo.
 */
function FaixaDoPrato({
  item,
  noFogo,
  horizonte,
  largura,
  agora,
}: {
  item: ItemAgendado;
  noFogo: boolean;
  horizonte: number;
  largura: number;
  agora: Date;
}) {
  const inicio = Math.max(0, item.inicio);
  const fim = Math.min(item.fim, horizonte);
  const px = (min: number) => (min / horizonte) * largura;
  const pctDe = (min: number) => (Math.min(Math.max(min, 0), horizonte) / horizonte) * 100;

  const cor = corDoPosto(item.estacao);
  const nome = `${item.quantidade}× ${item.pratoNome}`;
  const entra = item.inicio > 0 ? horaDaqui(agora, item.inicio) : null;
  const motivo = entra ? (item.esperaPosto ? `${item.estacaoNome} cheio até ${entra}` : entra) : null;

  const nomeDentro = px(fim - inicio) >= larguraDoTexto(nome) + 16;
  const textoEsquerda = nomeDentro ? motivo : [nome, motivo].filter(Boolean).join(" · ");
  const cabeEsquerda =
    textoEsquerda !== null && textoEsquerda !== "" && px(inicio) - 8 >= larguraDoTexto(textoEsquerda);
  // Sem espaço à esquerda, o nome vai depois da barra; a hora cai só no título.
  const textoDireita = !nomeDentro && !cabeEsquerda ? nome : null;
  const titulo = `${nome} · ${item.estacaoNome}${motivo ? ` · entra ${entra}` : noFogo ? " · no fogo" : ""}${
    item.esperaPosto ? " (esperando o posto vagar)" : ""
  }`;

  return (
    <div className="relative h-[22px]" title={titulo}>
      {cabeEsquerda && (
        <span
          className="tabular absolute inset-y-0 left-0 truncate text-right text-[11px] leading-[22px] text-marfim/55"
          style={{ right: `calc(${100 - pctDe(inicio)}% + 6px)` }}
        >
          {nomeDentro ? (
            textoEsquerda
          ) : (
            <>
              <span className="text-marfim/90">{nome}</span>
              {motivo && ` · ${motivo}`}
            </>
          )}
        </span>
      )}
      <span
        className="absolute inset-y-0 box-border truncate rounded-[5px] px-1.5 text-[11px] font-semibold leading-[20px] text-marfim"
        style={{
          left: `${pctDe(inicio)}%`,
          width: `${Math.max(pctDe(fim) - pctDe(inicio), 0.8)}%`,
          background: `${cor}${noFogo ? "80" : "3D"}`,
          border: `1px solid ${cor}${noFogo ? "" : "BF"}`,
        }}
      >
        {nomeDentro ? nome : ""}
      </span>
      {textoDireita && (
        <span
          className="absolute inset-y-0 right-0 truncate text-[11px] leading-[22px] text-marfim/90"
          style={{ left: `calc(${pctDe(fim)}% + 8px)` }}
        >
          {textoDireita}
        </span>
      )}
    </div>
  );
}
