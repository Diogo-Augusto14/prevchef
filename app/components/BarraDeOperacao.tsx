"use client";

import { useOperacao } from "@/lib/operacao";
import { EQUIPE, NOME_DO_PAPEL, motivoDaNegativa } from "@/lib/equipe";

/**
 * Quem está operando e o desfazer da última ação.
 *
 * Fica no cabeçalho porque vale para o sistema inteiro: a troca de operador
 * muda o que as telas deixam fazer, e o desfazer precisa estar à mão de
 * qualquer lugar — erro de caixa não espera você achar o botão.
 */
export default function BarraDeOperacao() {
  const { pronto, operador, trocarOperador, autorizado, ultimoPasso, desfazer } =
    useOperacao();

  const podeDesfazer = ultimoPasso !== null && autorizado(ultimoPasso.permissao);

  return (
    // Quebra no celular: desfazer com rótulo e o seletor não cabem numa linha.
    <div className="flex flex-wrap items-center gap-2">
      {ultimoPasso && (
        <button
          type="button"
          onClick={desfazer}
          disabled={!podeDesfazer}
          title={
            podeDesfazer
              ? `Desfazer: ${ultimoPasso.rotulo}`
              : motivoDaNegativa(operador, ultimoPasso.permissao)
          }
          aria-label={`Desfazer: ${ultimoPasso.rotulo}`}
          className="flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-2 text-[12px] font-medium text-marfim/75 transition enabled:hover:border-ambar-500/50 enabled:hover:text-ambar-300 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3 7v6h6" />
            <path d="M3 13a9 9 0 1 0 3-7.7L3 8" />
          </svg>
          <span>Desfazer</span>
          <span className="max-w-[12ch] truncate sm:max-w-[28ch]">
            · {ultimoPasso.rotulo}
          </span>
        </button>
      )}

      <label className="flex items-center gap-2">
        <span className="sr-only">Quem está operando</span>
        <select
          value={operador.id}
          onChange={(e) => trocarOperador(e.target.value)}
          // Antes de carregar fica no lugar, travado, para o cabeçalho não pular.
          disabled={!pronto}
          className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 text-base font-medium text-marfim/85 disabled:opacity-60 sm:text-[12px]"
        >
          {EQUIPE.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome} · {NOME_DO_PAPEL[o.papel]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
