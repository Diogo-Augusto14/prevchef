"use client";

import { useMemo } from "react";
import { Etiqueta, Secao } from "./ui";
import { dinheiro } from "@/lib/dados";
import { cardapioDoDia } from "@/lib/cardapio";
import { nomeDaEstacao } from "@/lib/restaurante";
import { motivoDaNegativa } from "@/lib/equipe";
import { useOperacao } from "@/lib/operacao";

/**
 * Cardápio de hoje: preço e disponibilidade na mão do gerente.
 *
 * A ficha do arquivo segue intocada; aqui muda o que vale HOJE. Pausar tira
 * o prato da venda sem mexer em estoque — serve para o "acabou a feijoada"
 * e para o "hoje a casa não serve isso".
 */
export default function Cardapio() {
  const { cardapio, mudarPreco, pausarPrato, autorizado, operador } =
    useOperacao();
  const pode = autorizado("editarCardapio");
  const pratos = useMemo(() => cardapioDoDia(cardapio), [cardapio]);

  return (
    <Secao
      titulo="Cardápio de hoje"
      descricao="Preço novo vale para os próximos pedidos — o que a mesa já pediu mantém o preço da hora. Pausar tira o prato da venda na hora."
    >
      {!pode && (
        <p className="vidro-ambar mb-3 rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed text-ambar-200">
          {motivoDaNegativa(operador, "editarCardapio")}
        </p>
      )}

      <ul>
        {pratos.map((prato) => {
          const mudado = prato.precoDeHoje !== prato.precoVenda;

          return (
            <li
              key={prato.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/[0.07] py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p
                  className={`flex items-center gap-2 text-[13px] font-semibold ${
                    prato.pausado ? "text-marfim/40" : "text-marfim"
                  }`}
                >
                  {prato.nome}
                  {prato.pausado && <Etiqueta cor="ambar">pausado</Etiqueta>}
                </p>
                <p className="tabular mt-0.5 text-[11px] text-marfim/55">
                  {nomeDaEstacao(prato.estacao)} · {prato.tempoPreparoMinutos} min
                  {mudado && ` · tabela ${dinheiro(prato.precoVenda)}`}
                </p>
              </div>

              <label className="flex shrink-0 items-center gap-1.5">
                <span className="rotulo">R$</span>
                <input
                  // Remonta quando o preço muda por fora (desfazer, outro
                  // navegador); enquanto digita, o campo é de quem digita.
                  key={`${prato.id}-${prato.precoDeHoje}`}
                  type="number"
                  min={1}
                  step="0.01"
                  defaultValue={prato.precoDeHoje}
                  disabled={!pode}
                  aria-label={`Preço de ${prato.nome}`}
                  onBlur={(e) => {
                    // Fora de um <form> o min={1} não vale: a checagem é aqui.
                    const valor = Math.round(Number(e.target.value) * 100) / 100;
                    if (valor >= 1 && valor !== prato.precoDeHoje) {
                      mudarPreco(prato.id, valor);
                    } else {
                      e.target.value = String(prato.precoDeHoje);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  className="campo tabular !w-24 !py-1.5 !text-[13px] disabled:opacity-40"
                />
              </label>

              <button
                type="button"
                disabled={!pode}
                aria-label={
                  prato.pausado
                    ? `Voltar ao cardápio: ${prato.nome}`
                    : `Pausar: ${prato.nome}`
                }
                onClick={() => pausarPrato(prato.id, !prato.pausado)}
                className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${
                  prato.pausado
                    ? "border-fogo-400/40 text-fogo-200 hover:border-fogo-400/70"
                    : "border-white/12 text-marfim/60 hover:border-ambar-500/50 hover:text-ambar-300"
                }`}
              >
                {prato.pausado ? "Voltar ao cardápio" : "Pausar"}
              </button>
            </li>
          );
        })}
      </ul>
    </Secao>
  );
}
