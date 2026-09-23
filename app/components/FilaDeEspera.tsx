"use client";

import { useState } from "react";
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, Etiqueta, Secao, Vazio } from "./ui";
import { listarNumeros, type SituacaoDaFila } from "@/lib/salao";
import { duracao } from "@/lib/dados";
import { motivoDaNegativa } from "@/lib/equipe";
import { useOperacao } from "@/lib/operacao";

/** Espera 0 = a mesa prevista já passou do tempo médio de refeição. */
function quando(esperaMinutos: number | null) {
  return esperaMinutos === 0 ? "a qualquer momento" : `em ~${esperaMinutos} min`;
}

export default function FilaDeEspera({
  situacao,
  aoEntrar,
  aoSair,
  aoSentar,
}: {
  situacao: SituacaoDaFila;
  aoEntrar: (nome: string, pessoas: number) => void;
  aoSair: (id: string) => void;
  /** Uma mesa só, ou as mesas de uma junção. */
  aoSentar: (id: string, mesaIds: string[]) => void;
}) {
  const { operador, autorizado } = useOperacao();
  const podeSalao = autorizado("gerenciarSalao");

  const [nome, setNome] = useState("");
  const [pessoas, setPessoas] = useState(2);

  return (
    <Secao
      titulo="Fila de espera"
      descricao="Por ordem de chegada. Mesa prometida à fila não é oferecida a quem chega depois."
      acao={
        situacao.prontosParaSentar > 0 ? (
          <Etiqueta cor="fogoSuave">
            {situacao.prontosParaSentar} pronto
            {situacao.prontosParaSentar > 1 ? "s" : ""} para sentar
          </Etiqueta>
        ) : undefined
      }
    >
      <form
        className="flex flex-wrap items-end gap-2.5 border-b border-white/[0.07] pb-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!podeSalao) return;
          aoEntrar(nome, pessoas);
          setNome("");
          setPessoas(2);
        }}
      >
        <div className="min-w-0 flex-1 basis-40">
          <label htmlFor="nome-fila" className="rotulo block">
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
          <label htmlFor="pessoas-fila" className="rotulo block">
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
          disabled={!nome.trim() || !podeSalao}
          className={BOTAO_SECUNDARIO + " px-3.5 py-2 text-[13px]"}
        >
          Anotar
        </button>
      </form>

      {!podeSalao && (
        <p className="vidro-ambar mt-3 rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed text-ambar-200">
          {motivoDaNegativa(operador, "gerenciarSalao")}
        </p>
      )}

      {situacao.chamados.length === 0 ? (
        <div className="pt-4">
          <Vazio>Ninguém esperando. O salão atende na hora.</Vazio>
        </div>
      ) : (
        <ol className="pt-1">
          {situacao.chamados.map((chamado, i) => (
            <li
              key={chamado.item.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/[0.07] py-3 last:border-b-0"
            >
              <span className="tabular w-5 shrink-0 font-display text-sm text-marfim/55">
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
                  esperando há {duracao(chamado.esperandoHa)}
                  {chamado.mesa
                    ? ` · mesa ${chamado.mesa.numero} livre agora`
                    : chamado.juntar
                      ? ` · juntar as mesas ${listarNumeros(chamado.juntar)}, livres agora`
                      : chamado.mesaPrevista
                        ? ` · mesa ${chamado.mesaPrevista.numero} ${quando(chamado.esperaMinutos)}`
                        : chamado.juntarPrevisto
                          ? ` · mesas ${listarNumeros(chamado.juntarPrevisto)} juntas ${quando(chamado.esperaMinutos)}`
                          : " · a casa não comporta nem juntando mesas"}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {chamado.mesa ? (
                  <button
                    type="button"
                    onClick={() => aoSentar(chamado.item.id, [chamado.mesa!.id])}
                    disabled={!podeSalao}
                    className={BOTAO_PRIMARIO + " px-3 py-1.5 text-[11px]"}
                  >
                    Sentar na {chamado.mesa.numero}
                  </button>
                ) : chamado.juntar ? (
                  <button
                    type="button"
                    onClick={() =>
                      aoSentar(chamado.item.id, chamado.juntar!.map((m) => m.id))
                    }
                    disabled={!podeSalao}
                    className={BOTAO_PRIMARIO + " px-3 py-1.5 text-[11px]"}
                  >
                    Sentar nas {chamado.juntar.map((m) => m.numero).join("+")}
                  </button>
                ) : (
                  <Etiqueta cor={chamado.esperaMinutos === null ? "brasa" : "ambar"}>
                    {chamado.esperaMinutos === null
                      ? "sem mesa"
                      : chamado.esperaMinutos === 0
                        ? "a qualquer momento"
                        : `~${chamado.esperaMinutos} min`}
                  </Etiqueta>
                )}
                <button
                  type="button"
                  onClick={() => aoSair(chamado.item.id)}
                  disabled={!podeSalao}
                  aria-label={`Desistiu: ${chamado.item.nome}`}
                  className="rounded-lg border border-white/12 px-2 py-1.5 text-[11px] font-semibold text-marfim/60 transition hover:border-brasa-300/50 hover:text-brasa-300 disabled:cursor-not-allowed disabled:opacity-35"
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
