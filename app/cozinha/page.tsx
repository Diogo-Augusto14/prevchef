"use client";

import { useMemo } from "react";
import {
  Etiqueta,
  Heroi,
  LinhaDeNumeros,
  Secao,
  TituloDaTela,
  Vazio,
} from "../components/ui";
import { DIA_PADRAO } from "@/lib/dados";
import { mesaPorId } from "@/lib/restaurante";
import {
  PRAZO_ALVO_MINUTOS,
  cargaDasEstacoes,
  montarAgenda,
  type PedidoAgendado,
} from "@/lib/cozinha";
import { calcularDisponibilidade } from "@/lib/disponibilidade";
import { pedidosAbertos, useOperacao } from "@/lib/operacao";

export default function CozinhaPage() {
  const { pronto, pedidos, agora, mudarSituacao, estoqueAtual } = useOperacao();

  const abertos = useMemo(() => pedidosAbertos(pedidos), [pedidos]);
  const agenda = useMemo(() => montarAgenda(abertos, agora), [abertos, agora]);
  const carga = useMemo(() => cargaDasEstacoes(agenda), [agenda]);
  const disponibilidade = useMemo(
    () => calcularDisponibilidade(abertos, DIA_PADRAO, estoqueAtual),
    [abertos, estoqueAtual]
  );

  if (!pronto) {
    return (
      <div className="space-y-8">
        <TituloDaTela titulo="Cozinha">Montando a fila…</TituloDaTela>
      </div>
    );
  }

  const atrasados = agenda.filter((p) => p.atrasado);
  const proximo = agenda.length
    ? Math.min(...agenda.map((p) => p.prontoEm))
    : null;
  // A régua da linha do tempo: o pedido mais distante define a largura.
  const horizonte = Math.max(
    ...agenda.map((p) => p.prontoEm),
    PRAZO_ALVO_MINUTOS
  );

  const emFalta = disponibilidade.filter((d) => d.situacao !== "disponivel");

  return (
    <div className="space-y-8">
      <TituloDaTela titulo="Cozinha">
        Os pratos de uma mesma mesa saem juntos, então quem demora mais entra
        primeiro no posto. A fila respeita a ordem de chegada dos pedidos.
      </TituloDaTela>

      <Heroi>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-6 pt-6">
          <h2 className="font-display text-xl font-normal text-marfim">
            Fila de produção
          </h2>
          <p className="text-[13px] text-marfim/62">
            Linha do tempo dos próximos {horizonte} min · meta de{" "}
            {PRAZO_ALVO_MINUTOS} min do pedido à mesa
          </p>
        </div>

        <div className="mt-5 border-t border-white/10">
          {agenda.length === 0 ? (
            <div className="px-6 py-8">
              <Vazio>Nenhum pedido na fila. A cozinha está limpa.</Vazio>
            </div>
          ) : (
            agenda.map((p) => (
              <LinhaDaFila
                key={p.pedido.id}
                agendado={p}
                horizonte={horizonte}
                aoAvancar={mudarSituacao}
              />
            ))
          )}
        </div>
      </Heroi>

      <LinhaDeNumeros
        className="border-y border-white/10 py-4"
        itens={[
          {
            rotulo: "Pedidos na fila",
            valor: String(agenda.length),
            detalhe: `${agenda.filter((p) => p.pedido.situacao === "em-preparo").length} já em preparo`,
          },
          {
            rotulo: "Próximo prato",
            valor: proximo === null ? "—" : `${proximo} min`,
            detalhe: "o primeiro pedido a fechar",
            forte: true,
          },
          {
            rotulo: "Fora do prazo",
            valor: String(atrasados.length),
            detalhe: `passam de ${PRAZO_ALVO_MINUTOS} min do lançamento`,
          },
          {
            rotulo: "Posto mais apertado",
            valor: carga.length
              ? [...carga].sort((a, b) => b.ocupacao - a.ocupacao)[0].nome
              : "—",
            detalhe: carga.length
              ? `${[...carga].sort((a, b) => b.ocupacao - a.ocupacao)[0].ocupacao}% da meia hora`
              : "",
          },
        ]}
      />

      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-12">
        <div className="lg:col-span-5 xl:col-span-4">
          <Secao
            titulo="Carga dos postos"
            descricao="Quanto de cada posto está comprometido na próxima meia hora."
          >
            <ul>
              {carga.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-4 border-b border-white/[0.06] py-3 last:border-b-0"
                >
                  <span className="w-28 shrink-0 text-[13px] font-semibold text-marfim">
                    {e.nome}
                  </span>
                  <span className="relative h-1.5 flex-1 rounded-full bg-white/[0.06]">
                    <span
                      className={`absolute inset-y-0 left-0 rounded-full ${
                        e.ocupacao >= 85
                          ? "bg-brasa-300"
                          : e.ocupacao >= 60
                            ? "bg-ambar-500"
                            : "bg-jade-400/60"
                      }`}
                      style={{ width: `${Math.max(e.ocupacao, 1.5)}%` }}
                    />
                  </span>
                  <span className="tabular w-10 shrink-0 text-right text-[11px] text-marfim/55">
                    {e.ocupacao}%
                  </span>
                </li>
              ))}
            </ul>
          </Secao>
        </div>

        <div className="lg:col-span-7 xl:col-span-8">
          <Secao
            titulo="O que ainda dá para fazer"
            descricao="Estoque menos o que os pedidos em aberto já comprometeram. O salão não consegue lançar o que aparece esgotado aqui."
          >
            {emFalta.length === 0 ? (
              <Vazio>Todos os pratos do cardápio com folga de estoque.</Vazio>
            ) : (
              <ul>
                {emFalta.map((d) => (
                  <li
                    key={d.pratoId}
                    className="flex items-center justify-between gap-4 border-b border-white/[0.06] py-3 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold ${
                          d.situacao === "esgotado"
                            ? "text-brasa-300"
                            : "text-marfim"
                        }`}
                      >
                        {d.nome}
                      </p>
                      <p className="mt-0.5 text-[11px] text-marfim/50">
                        {d.limitante
                          ? `${d.limitante.nome}: ${d.limitante.restante} ${d.limitante.unidade} em estoque`
                          : "sem ingrediente cadastrado"}
                        {d.comprometidas > 0 &&
                          ` · ${d.comprometidas} já comprometida${d.comprometidas > 1 ? "s" : ""}`}
                      </p>
                    </div>
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
                        : `${d.porcoes} porç${d.porcoes === 1 ? "ão" : "ões"}`}
                    </Etiqueta>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LinhaDaFila({
  agendado,
  horizonte,
  aoAvancar,
}: {
  agendado: PedidoAgendado;
  horizonte: number;
  aoAvancar: (pedidoId: string, situacao: "em-preparo" | "pronto") => void;
}) {
  const mesa = mesaPorId(agendado.pedido.mesaId);
  const pct = (v: number) => `${Math.min(100, (v / horizonte) * 100)}%`;
  const emPreparo = agendado.pedido.situacao === "em-preparo";

  return (
    <div className="grid gap-y-3 border-b border-white/[0.07] px-6 py-4 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)_auto] lg:items-center lg:gap-x-6">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-display text-[17px] text-marfim">
          Mesa {mesa?.numero ?? "?"}
          {emPreparo && <Etiqueta cor="jadeSuave">em preparo</Etiqueta>}
          {agendado.atrasado && <Etiqueta cor="brasa">fora do prazo</Etiqueta>}
        </p>
        <p className="tabular mt-0.5 text-[11px] text-marfim/50">
          esperando há {agendado.esperando} min · total previsto{" "}
          {agendado.esperaTotal} min
        </p>
      </div>

      {/* Linha do tempo: cada barra é um prato no seu posto. */}
      <div className="space-y-1.5">
        {agendado.itens.map((item) => (
          <div key={item.pratoId} className="flex items-center gap-2.5">
            <span className="relative h-5 flex-1 rounded-md bg-white/[0.05]">
              <span
                className={`absolute inset-y-0 flex items-center justify-start overflow-hidden rounded-md px-2 ${
                  agendado.atrasado ? "bg-ambar-500/30" : "bg-jade-400/25"
                }`}
                style={{ left: pct(item.inicio), width: pct(item.duracao) }}
              >
                <span className="truncate text-[10px] font-semibold text-marfim/90">
                  {item.quantidade}× {item.pratoNome}
                </span>
              </span>
            </span>
            <span className="tabular w-24 shrink-0 text-right text-[10px] text-marfim/45">
              {item.inicio === 0 ? "agora" : `+${item.inicio} min`} ·{" "}
              {item.estacaoNome}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 lg:flex-col lg:items-end lg:gap-1.5">
        <span className="tabular font-display text-2xl font-light leading-none text-jade-100">
          {agendado.prontoEm}
          <span className="ml-1 font-corpo text-[11px] font-medium text-marfim/55">
            min
          </span>
        </span>
        <button
          type="button"
          onClick={() =>
            aoAvancar(agendado.pedido.id, emPreparo ? "pronto" : "em-preparo")
          }
          className="rounded-lg border border-white/12 px-2.5 py-1 text-[11px] font-semibold text-marfim/75 transition hover:border-jade-400/50 hover:text-jade-200"
        >
          {emPreparo ? "Pronto" : "Iniciar"}
        </button>
      </div>
    </div>
  );
}
