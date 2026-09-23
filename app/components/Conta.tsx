"use client";

import { useState } from "react";
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO } from "./ui";
import { dinheiro } from "@/lib/dados";
import { TAXA_DE_SERVICO, calcularConta } from "@/lib/conta";
import type { Mesa, Ocupacao, Pedido } from "@/lib/tipos";
import { motivoDaNegativa } from "@/lib/equipe";
import { useOperacao } from "@/lib/operacao";
import { listarNumeros } from "@/lib/salao";

/**
 * Fechamento da conta. Mostra o que a mesa consumiu, a taxa de serviço e a
 * divisão por pessoa, e só então libera a mesa de volta para o salão.
 *
 * Numa junção a conta é uma só: `mesas` traz todas as mesas do grupo,
 * `ocupacao` já soma as pessoas e `pedidosDaMesa` junta o que foi lançado em
 * qualquer uma delas.
 */
export default function Conta({
  mesas,
  ocupacao,
  pedidosDaMesa,
  agora,
  aoFechar,
}: {
  mesas: Mesa[];
  ocupacao: Ocupacao;
  pedidosDaMesa: Pedido[];
  agora: Date;
  /** Recebe o total que o caixa viu, para a conta não fechar se mudar até gravar. */
  aoFechar: (comServico: boolean, total: number) => void;
}) {
  const { operador, autorizado } = useOperacao();
  const podeFechar = autorizado("fecharConta");

  const [comServico, setComServico] = useState(true);
  const [confirmando, setConfirmando] = useState(false);

  const conta = calcularConta(pedidosDaMesa, ocupacao, agora, comServico);
  const juntas = mesas.length > 1;
  // "mesa 5" ou "mesas 5 e 13".
  const nome = `${juntas ? "mesas" : "mesa"} ${listarNumeros(mesas)}`;

  if (conta.itens.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-[13px] text-marfim/62">
          {conta.pendentes > 0
            ? `Nada saiu da cozinha ainda. Liberar agora cancela ${conta.pendentes} pedido${conta.pendentes > 1 ? "s" : ""} ainda na cozinha.`
            : juntas
              ? "O grupo ainda não consumiu nada."
              : "A mesa ainda não consumiu nada."}
        </p>
        {!podeFechar ? (
          <p className="vidro-ambar rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed text-ambar-200">
            {motivoDaNegativa(operador, "fecharConta")}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => aoFechar(false, conta.total)}
            className="w-full rounded-xl border border-white/12 px-4 py-2 text-[13px] font-semibold text-marfim/80 transition hover:border-brasa-300/50 hover:text-brasa-300"
          >
            Liberar {nome}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="tabular">
        {conta.itens.map((item) => (
          <li
            key={item.pratoId}
            className="flex items-baseline justify-between gap-3 border-b border-white/[0.07] py-2 text-[13px]"
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
              className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-fogo-500"
            />
            Serviço {Math.round(TAXA_DE_SERVICO * 100)}%
          </span>
          <span className="tabular">{dinheiro(conta.servico)}</span>
        </label>

        <div className="flex items-baseline justify-between border-t border-white/10 pt-2.5">
          <span className="font-semibold text-marfim">Total</span>
          <span className="tabular font-display text-[26px] font-medium tracking-tight text-fogo-100">
            {dinheiro(conta.total)}
          </span>
        </div>

        <div className="flex justify-between text-[11px] text-marfim/50">
          <span>
            {conta.pessoas} pessoa{conta.pessoas > 1 ? "s" : ""} · {conta.minutosNaMesa} min{" "}
            {juntas ? "nas mesas" : "na mesa"}
          </span>
          <span className="tabular">{dinheiro(conta.porPessoa)} por pessoa</span>
        </div>
      </div>

      {conta.pendentes > 0 && (
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-ambar-300">
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

      {!podeFechar ? (
        <p className="vidro-ambar rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed text-ambar-200">
          {motivoDaNegativa(operador, "fecharConta")}
        </p>
      ) : !confirmando ? (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className={BOTAO_SECUNDARIO + " w-full px-4 py-2.5 text-[13px]"}
        >
          Fechar conta {juntas ? "das" : "da"} {nome}
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-[12px] text-marfim/70">
            Fechar em {dinheiro(conta.total)} e liberar {juntas ? `as ${nome}` : "a mesa"}?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => aoFechar(comServico, conta.total)}
              className={BOTAO_PRIMARIO + " flex-1 px-4 py-2 text-[13px]"}
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className={BOTAO_SECUNDARIO + " px-4 py-2 text-[13px]"}
            >
              Voltar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
