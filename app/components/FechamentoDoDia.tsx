"use client";

import { useMemo, useState } from "react";
import { Etiqueta, Secao, Vazio } from "./ui";
import { dataLonga, dinheiro, numero } from "@/lib/dados";
import { apurarODia, contasDoDia } from "@/lib/fechamento";
import { motivoDaNegativa } from "@/lib/equipe";
import { useOperacao } from "@/lib/operacao";
import type { Cenario } from "@/lib/tipos";
import type { PrevisaoDePrato } from "@/lib/previsao";

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
        titulo="Dia fechado"
        descricao="O serviço virou histórico e o modelo já pode usar este dia nas próximas previsões."
        acao={<Etiqueta cor="jade">{dataLonga(data)}</Etiqueta>}
      >
        <p className="text-[13px] leading-relaxed text-marfim/70">
          A partir de agora, quando um dia parecido com hoje aparecer, este
          serviço entra entre os vizinhos que o KNN consulta.
        </p>
      </Secao>
    );
  }

  if (contas.length === 0) {
    return (
      <Secao
        titulo="Fechamento do dia"
        descricao="Compara o previsto com o que realmente saiu e devolve o dia para o modelo aprender."
      >
        <Vazio>
          Nenhuma conta fechada hoje ainda. O fechamento aparece quando o
          serviço começar a girar.
        </Vazio>
      </Secao>
    );
  }

  const acertos = apuracao.pratos.filter((p) => p.dentroDaFaixa).length;

  return (
    <Secao
      titulo="Fechamento do dia"
      descricao="Compara o previsto com o que realmente saiu e devolve o dia para o modelo aprender."
      acao={
        <span className="text-[13px] text-marfim/62">
          {apuracao.contas} contas · {apuracao.pessoas} pessoas ·{" "}
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
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-white/[0.06] py-2.5 md:grid-cols-[minmax(110px,1fr)_minmax(0,2fr)_auto]"
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
                      p.dentroDaFaixa ? "bg-jade-400" : "bg-ambar-500"
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
                    p.dentroDaFaixa ? "text-jade-300" : "text-ambar-300"
                  }`}
                >
                  {p.erro > 0 ? "+" : ""}
                  {numero(p.erro)}
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
          <p className="text-[12px] text-ambar-300/90">
            {motivoDaNegativa(operador, "fecharODia")}
          </p>
        ) : !confirmando ? (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="rounded-xl bg-gradient-to-b from-jade-400 to-jade-500 px-4 py-2 text-[13px] font-bold text-tinta"
          >
            Fechar o dia
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-marfim/70">
              Fechar e mandar para o histórico?
            </span>
            <button
              type="button"
              onClick={() => {
                fecharODia(apuracao.registro);
                setConfirmando(false);
              }}
              className="rounded-xl bg-gradient-to-b from-jade-400 to-jade-500 px-4 py-2 text-[13px] font-bold text-tinta"
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="rounded-xl border border-white/12 px-3 py-2 text-[13px] font-semibold text-marfim/70 transition hover:border-white/30"
            >
              Voltar
            </button>
          </div>
        )}
      </div>
    </Secao>
  );
}
