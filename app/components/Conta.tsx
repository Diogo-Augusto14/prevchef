"use client";

import { useState } from "react";
import { Etiqueta } from "./ui";
import { dinheiro } from "@/lib/dados";
import { TAXA_DE_SERVICO, calcularConta } from "@/lib/conta";
import type { Mesa, Ocupacao, Pedido } from "@/lib/tipos";

/**
 * Fechamento da conta. Mostra o que a mesa consumiu, a taxa de serviço e a
 * divisão por pessoa, e só então libera a mesa de volta para o salão.
 */
export default function Conta({
  mesa,
  ocupacao,
  pedidosDaMesa,
  agora,
  aoFechar,
}: {
  mesa: Mesa;
  ocupacao: Ocupacao;
  pedidosDaMesa: Pedido[];
  agora: Date;
  aoFechar: (comServico: boolean) => void;
}) {
  const [comServico, setComServico] = useState(true);
  const [confirmando, setConfirmando] = useState(false);

  const conta = calcularConta(pedidosDaMesa, ocupacao, agora, comServico);

  if (conta.itens.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-[13px] text-marfim/62">
          A mesa ainda não consumiu nada.
        </p>
        <button
          type="button"
          onClick={() => aoFechar(false)}
          className="w-full rounded-xl border border-white/12 px-4 py-2 text-[13px] font-semibold text-marfim/80 transition hover:border-brasa-300/50 hover:text-brasa-300"
        >
          Liberar mesa {mesa.numero}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="tabular">
        {conta.itens.map((item) => (
          <li
            key={item.pratoId}
            className="flex items-baseline justify-between gap-3 border-b border-white/[0.06] py-2 text-[13px]"
          >
            <span className="min-w-0 truncate text-marfim/85">
              <span className="text-marfim/50">{item.quantidade}×</span>{" "}
              {item.nome}
            </span>
            <span className="shrink-0 text-marfim/70">{dinheiro(item.total)}</span>
          </li>
        ))}
      </ul>

      <div className="space-y-1.5 text-[13px]">
        <div className="flex justify-between text-marfim/62">
          <span>Subtotal</span>
          <span className="tabular">{dinheiro(conta.subtotal)}</span>
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-3 text-marfim/62">
          <span className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={comServico}
              onChange={(e) => setComServico(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-jade-400"
            />
            Serviço {Math.round(TAXA_DE_SERVICO * 100)}%
          </span>
          <span className="tabular">{dinheiro(conta.servico)}</span>
        </label>

        <div className="flex items-baseline justify-between border-t border-white/10 pt-2.5">
          <span className="font-semibold text-marfim">Total</span>
          <span className="tabular font-display text-[26px] font-light text-jade-100">
            {dinheiro(conta.total)}
          </span>
        </div>

        <div className="flex justify-between text-[11px] text-marfim/50">
          <span>
            {conta.pessoas} pessoa{conta.pessoas > 1 ? "s" : ""} · {conta.minutosNaMesa} min
            na mesa
          </span>
          <span className="tabular">{dinheiro(conta.porPessoa)} por pessoa</span>
        </div>
      </div>

      {conta.pendentes > 0 && (
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-ambar-300/90">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
            className="mt-0.5 shrink-0"
          >
            <path d="M12 4l9 16H3Z" />
            <path d="M12 10v4M12 17h.01" />
          </svg>
          {conta.pendentes} pedido{conta.pendentes > 1 ? "s" : ""} ainda na
          cozinha. Fechar agora cancela o que não saiu.
        </p>
      )}

      {!confirmando ? (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="w-full rounded-xl bg-gradient-to-b from-jade-400 to-jade-500 px-4 py-2.5 text-[13px] font-bold text-tinta"
        >
          Fechar conta da mesa {mesa.numero}
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-[12px] text-marfim/70">
            Fechar em {dinheiro(conta.total)} e liberar a mesa?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => aoFechar(comServico)}
              className="flex-1 rounded-xl bg-gradient-to-b from-jade-400 to-jade-500 px-4 py-2 text-[13px] font-bold text-tinta"
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="rounded-xl border border-white/12 px-4 py-2 text-[13px] font-semibold text-marfim/70 transition hover:border-white/30"
            >
              Voltar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Etiqueta do caixa do dia, para a faixa de números. */
export function EtiquetaDoCaixa({ contas }: { contas: number }) {
  return <Etiqueta cor="jadeSuave">{contas} conta{contas > 1 ? "s" : ""}</Etiqueta>;
}
