"use client";

import { useState } from "react";
import { Etiqueta, Secao, Vazio } from "./ui";
import type { SituacaoDaFila } from "@/lib/salao";

export default function FilaDeEspera({
  situacao,
  aoEntrar,
  aoSair,
  aoSentar,
}: {
  situacao: SituacaoDaFila;
  aoEntrar: (nome: string, pessoas: number) => void;
  aoSair: (id: string) => void;
  aoSentar: (id: string, mesaId: string) => void;
}) {
  const [nome, setNome] = useState("");
  const [pessoas, setPessoas] = useState(2);

  return (
    <Secao
      titulo="Fila de espera"
      descricao="Por ordem de chegada. Mesa prometida à fila não é oferecida a quem chega depois."
      acao={
        situacao.prontosParaSentar > 0 ? (
          <Etiqueta cor="jade">
            {situacao.prontosParaSentar} pronto
            {situacao.prontosParaSentar > 1 ? "s" : ""} para sentar
          </Etiqueta>
        ) : undefined
      }
    >
      <form
        className="flex flex-wrap items-end gap-2.5 border-b border-white/[0.06] pb-4"
        onSubmit={(e) => {
          e.preventDefault();
          aoEntrar(nome, pessoas);
          setNome("");
          setPessoas(2);
        }}
      >
        <div className="min-w-0 flex-1">
          <label htmlFor="nome-fila" className="rotulo">
            Nome
          </label>
          <input
            id="nome-fila"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Quem está esperando"
            className="campo mt-1.5 !py-2 !text-[13px]"
          />
        </div>
        <div>
          <label htmlFor="pessoas-fila" className="rotulo">
            Pessoas
          </label>
          <input
            id="pessoas-fila"
            type="number"
            min={1}
            max={20}
            value={pessoas}
            onChange={(e) => setPessoas(Number(e.target.value))}
            className="campo tabular mt-1.5 !w-20 !py-2 !text-[13px]"
          />
        </div>
        <button
          type="submit"
          disabled={!nome.trim()}
          className="rounded-xl border border-white/12 px-3.5 py-2 text-[13px] font-semibold text-marfim/85 transition hover:border-jade-400/50 hover:text-jade-200 disabled:cursor-not-allowed disabled:opacity-35"
        >
          Anotar
        </button>
      </form>

      {situacao.chamados.length === 0 ? (
        <div className="pt-4">
          <Vazio>Ninguém esperando. O salão atende na hora.</Vazio>
        </div>
      ) : (
        <ol className="pt-1">
          {situacao.chamados.map((chamado, i) => (
            <li
              key={chamado.item.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/[0.06] py-3 last:border-b-0"
            >
              <span className="tabular w-5 shrink-0 font-display text-sm text-marfim/35">
                {i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-marfim">
                  {chamado.item.nome}
                  <span className="ml-2 font-normal text-marfim/55">
                    {chamado.item.pessoas} pessoa
                    {chamado.item.pessoas > 1 ? "s" : ""}
                  </span>
                </p>
                <p className="tabular mt-0.5 text-[11px] text-marfim/50">
                  esperando há {chamado.esperandoHa} min
                  {chamado.mesa
                    ? ` · mesa ${chamado.mesa.numero} livre agora`
                    : chamado.mesaPrevista
                      ? ` · mesa ${chamado.mesaPrevista.numero} em ~${chamado.esperaMinutos} min`
                      : " · nenhuma mesa da casa comporta"}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {chamado.mesa ? (
                  <button
                    type="button"
                    onClick={() => aoSentar(chamado.item.id, chamado.mesa!.id)}
                    className="rounded-lg bg-gradient-to-b from-jade-400 to-jade-500 px-3 py-1.5 text-[11px] font-bold text-tinta"
                  >
                    Sentar na {chamado.mesa.numero}
                  </button>
                ) : (
                  <Etiqueta cor={chamado.esperaMinutos === null ? "brasa" : "ambar"}>
                    {chamado.esperaMinutos === null
                      ? "sem mesa"
                      : `~${chamado.esperaMinutos} min`}
                  </Etiqueta>
                )}
                <button
                  type="button"
                  onClick={() => aoSair(chamado.item.id)}
                  aria-label={`Tirar ${chamado.item.nome} da fila`}
                  className="rounded-lg border border-white/12 px-2 py-1.5 text-[11px] font-semibold text-marfim/60 transition hover:border-brasa-300/50 hover:text-brasa-300"
                >
                  Desistiu
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Secao>
  );
}
