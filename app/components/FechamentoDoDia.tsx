"use client";

import { useMemo, useState } from "react";
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, Etiqueta, Secao, Vazio } from "./ui";
import { dataLonga, dinheiro, numero } from "@/lib/dados";
import { apurarODia, contasDoDia } from "@/lib/fechamento";
import { motivoDaNegativa } from "@/lib/equipe";
import { pedidosAbertos, useOperacao } from "@/lib/operacao";
import type { Cenario } from "@/lib/tipos";
import type { PrevisaoDePrato } from "@/lib/previsao";

/* O trilho do painel aponta para cá; todos os ramos precisam carregar a âncora. */
const ANCORA = "fechamento";
/* O cabeçalho só gruda a partir de lg, numa linha só; abaixo disso não há o que recuar. */
const RECUO_DA_ANCORA = "scroll-mt-4 lg:scroll-mt-28";

/**
 * Mesa ocupada só vira conta quando fecha; até lá fica fora da apuração.
 * Avisa, mas não impede: o gerente pode fechar o dia mesmo assim.
 */
function avisoDePendencia(mesas: number, pedidos: number): string | null {
  if (mesas === 0 && pedidos === 0) return null;

  const partes: string[] = [];
  if (mesas > 0) {
    partes.push(`${mesas} mesa${mesas === 1 ? "" : "s"} ocupada${mesas === 1 ? "" : "s"}`);
  }
  if (pedidos > 0) {
    partes.push(`${pedidos} pedido${pedidos === 1 ? "" : "s"} em aberto`);
  }

  const consequencia =
    mesas === 1
      ? "a conta dessa mesa ainda não existe e não entra neste fechamento."
      : mesas > 1
        ? "as contas dessas mesas ainda não existem e não entram neste fechamento."
        : pedidos === 1
          ? "esse pedido ainda não entra neste fechamento."
          : "esses pedidos ainda não entram neste fechamento.";

  return `Ainda há ${partes.join(" e ")} — ${consequencia}`;
}

/**
 * Fechar o dia: o serviço vira histórico e o modelo passa a consultá-lo.
 *
 * É aqui que o previsto encontra o realizado. Enquanto o dia não fecha, o
 * PrevChef só sabe prever; depois de fechar, ele sabe se acertou.
 */
export default function FechamentoDoDia({
  data,
  cenario,
  previsoes,
}: {
  data: string;
  cenario: Cenario;
  previsoes: PrevisaoDePrato[];
}) {
  const {
    contasFechadas,
    diasFechados,
    fecharODia,
    operador,
    autorizado,
    ocupacoes,
    pedidos,
  } = useOperacao();

  const [confirmando, setConfirmando] = useState(false);

  const contas = useMemo(
    () => contasDoDia(contasFechadas, data),
    [contasFechadas, data]
  );

  const apuracao = useMemo(
    () => apurarODia(contas, data, cenario, previsoes),
    [contas, data, cenario, previsoes]
  );

  const jaFechado = diasFechados.some((d) => d.data === data);
  const pode = autorizado("fecharODia");

  if (jaFechado) {
    return (
      <Secao
        id={ANCORA}
        className={RECUO_DA_ANCORA}
        titulo="Dia fechado"
        descricao="O serviço virou histórico e o modelo já pode usar este dia nas próximas previsões."
        acao={<Etiqueta cor="fogo">{dataLonga(data)}</Etiqueta>}
      >
        <p className="text-[13px] leading-relaxed text-marfim/70">
          A partir de agora, quando um dia parecido com este aparecer, este
          serviço entra entre os vizinhos que o KNN consulta.
        </p>
      </Secao>
    );
  }

  if (contas.length === 0) {
    return (
      <Secao
        id={ANCORA}
        className={RECUO_DA_ANCORA}
        titulo="Fechamento do dia"
        descricao="Compara o previsto com o que realmente saiu e devolve o dia para o modelo aprender."
      >
        <Vazio>
          Nenhuma conta fechada neste dia ainda. O fechamento aparece quando o
          serviço começar a girar.
        </Vazio>
      </Secao>
    );
  }

  const acertos = apuracao.pratos.filter((p) => p.dentroDaFaixa).length;
  const pendencia = avisoDePendencia(
    ocupacoes.length,
    pedidosAbertos(pedidos).length
  );

  return (
    <Secao
      id={ANCORA}
      className={RECUO_DA_ANCORA}
      titulo="Fechamento do dia"
      descricao="Compara o previsto com o que realmente saiu e devolve o dia para o modelo aprender."
      acao={
        <span className="text-[13px] text-marfim/62">
          {apuracao.contas} conta{apuracao.contas === 1 ? "" : "s"} ·{" "}
          {apuracao.pessoas} pessoa{apuracao.pessoas === 1 ? "" : "s"} ·{" "}
          <strong className="tabular font-semibold text-marfim">
            {dinheiro(apuracao.faturamento)}
          </strong>
        </span>
      }
    >
      <ul className="tabular">
        {apuracao.pratos.map((p) => {
          const teto = Math.max(p.previsto, p.realizado, 1);
          return (
            <li
              key={p.pratoId}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-white/[0.07] py-2.5 md:grid-cols-[minmax(110px,1fr)_minmax(0,2fr)_auto]"
            >
              <span className="truncate text-[13px] font-semibold text-marfim">
                {p.nome}
              </span>

              {/* Duas barras empilhadas: previsto por baixo, realizado por cima. */}
              <span className="order-3 col-span-2 md:order-none md:col-span-1">
                <span className="block h-1.5 rounded-full bg-white/[0.06]">
                  <span
                    className="block h-1.5 rounded-full bg-white/20"
                    style={{ width: `${(p.previsto / teto) * 100}%` }}
                  />
                </span>
                <span className="mt-1 block h-1.5 rounded-full bg-white/[0.06]">
                  <span
                    className={`block h-1.5 rounded-full ${
                      p.dentroDaFaixa ? "bg-nevoa-500" : "bg-ambar-500"
                    }`}
                    style={{ width: `${(p.realizado / teto) * 100}%` }}
                  />
                </span>
              </span>

              <span className="flex items-baseline justify-end gap-2.5 text-[13px]">
                <span className="text-marfim/50">{numero(p.previsto)}</span>
                <span className="text-marfim/35">→</span>
                <span className="font-semibold text-marfim">{p.realizado}</span>
                <span
                  className={`w-12 text-right text-[11px] ${
                    p.dentroDaFaixa ? "text-nevoa-300" : "text-ambar-300"
                  }`}
                >
                  {p.erro > 0 ? "+" : ""}
                  {numero(p.erro)}
                </span>
                <span className="sr-only">
                  {p.dentroDaFaixa ? "dentro da faixa" : "fora da faixa"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <p className="text-[13px] leading-relaxed text-marfim/68">
          <strong className="font-semibold text-marfim">
            {acertos} de {apuracao.pratos.length}
          </strong>{" "}
          dentro da faixa prevista · erro médio de{" "}
          <strong className="tabular font-semibold text-marfim">
            {numero(apuracao.maeDoDia, 2)}
          </strong>{" "}
          porções por prato
        </p>

        {!pode ? (
          <p className="vidro-ambar rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed text-ambar-200">
            {motivoDaNegativa(operador, "fecharODia")}
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-3">
            {pendencia && (
              <p className="vidro-ambar max-w-sm rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed text-ambar-200">
                {pendencia}
              </p>
            )}

            {!confirmando ? (
              <button
                type="button"
                onClick={() => setConfirmando(true)}
                className={`${BOTAO_PRIMARIO} px-4 py-2 text-[13px]`}
              >
                Fechar o dia
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-marfim/70">
                  Fechar {pendencia ? "mesmo assim " : ""}e mandar para o
                  histórico?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    fecharODia(apuracao.registro);
                    setConfirmando(false);
                  }}
                  className={`${BOTAO_PRIMARIO} px-4 py-2 text-[13px]`}
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmando(false)}
                  className={`${BOTAO_SECUNDARIO} px-3 py-2 text-[13px]`}
                >
                  Voltar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Secao>
  );
}
