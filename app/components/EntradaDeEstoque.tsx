"use client";

import { useState } from "react";
import { Etiqueta, Secao } from "./ui";
import { ESTOQUE, dataLonga, dinheiro, numero } from "@/lib/dados";
import { MOTIVOS_DE_PERDA } from "@/lib/estoque";
import type { MovimentoDeEstoque } from "@/lib/tipos";

/** AAAA-MM-DD de hoje, para o valor inicial do campo de validade. */
function hojeMaisDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

const SINAL = {
  entrada: { rotulo: "Entrada", cor: "jadeSuave", simbolo: "+" },
  baixa: { rotulo: "Venda", cor: "neutro", simbolo: "−" },
  perda: { rotulo: "Perda", cor: "brasa", simbolo: "−" },
} as const;

export default function EntradaDeEstoque({
  movimentos,
  aoEntrar,
  aoPerder,
}: {
  movimentos: MovimentoDeEstoque[];
  aoEntrar: (entrada: {
    ingredienteId: string;
    quantidade: number;
    validade: string;
    custoUnitario: number;
    fornecedor?: string;
  }) => void;
  aoPerder: (ingredienteId: string, quantidade: number, motivo: string) => void;
}) {
  const [aba, setAba] = useState<"entrada" | "perda">("entrada");

  const [ingredienteId, setIngredienteId] = useState(ESTOQUE[0]?.id ?? "");
  const [quantidade, setQuantidade] = useState(0);
  const [validade, setValidade] = useState(hojeMaisDias(7));
  const [custo, setCusto] = useState(0);
  const [fornecedor, setFornecedor] = useState("");
  const [motivo, setMotivo] = useState<string>(MOTIVOS_DE_PERDA[0]);

  const ingrediente = ESTOQUE.find((e) => e.id === ingredienteId);
  const recentes = [...movimentos].sort((a, b) => b.em.localeCompare(a.em)).slice(0, 12);

  function limpar() {
    setQuantidade(0);
    setCusto(0);
    setFornecedor("");
  }

  return (
    <Secao
      titulo="Movimentar estoque"
      descricao="O saldo não é editado à mão: ele é o resultado do que entrou, do que foi vendido e do que se perdeu."
      acao={
        <div className="flex gap-1.5" role="group" aria-label="Tipo de movimento">
          {(["entrada", "perda"] as const).map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => setAba(op)}
              aria-pressed={aba === op}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                aba === op
                  ? "bg-jade-400 text-tinta"
                  : "border border-white/12 text-marfim/70 hover:border-white/25"
              }`}
            >
              {op === "entrada" ? "Entrada" : "Perda"}
            </button>
          ))}
        </div>
      }
    >
      <form
        className="flex flex-wrap items-end gap-2.5 border-b border-white/[0.06] pb-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (quantidade <= 0) return;

          if (aba === "entrada") {
            aoEntrar({
              ingredienteId,
              quantidade,
              validade,
              custoUnitario: custo,
              fornecedor,
            });
          } else {
            aoPerder(ingredienteId, quantidade, motivo);
          }
          limpar();
        }}
      >
        <div className="min-w-0 flex-1 basis-48">
          <label htmlFor="ingrediente" className="rotulo">
            Ingrediente
          </label>
          <select
            id="ingrediente"
            value={ingredienteId}
            onChange={(e) => setIngredienteId(e.target.value)}
            className="campo mt-1.5 !py-2 !text-[13px]"
          >
            {ESTOQUE.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="quantidade" className="rotulo">
            Quantidade ({ingrediente?.unidade ?? "un"})
          </label>
          <input
            id="quantidade"
            type="number"
            min={0}
            step="0.01"
            value={quantidade || ""}
            onChange={(e) => setQuantidade(Number(e.target.value))}
            className="campo tabular mt-1.5 !w-28 !py-2 !text-[13px]"
          />
        </div>

        {aba === "entrada" ? (
          <>
            <div>
              <label htmlFor="validade-entrada" className="rotulo">
                Validade do lote
              </label>
              <input
                id="validade-entrada"
                type="date"
                value={validade}
                onChange={(e) => setValidade(e.target.value)}
                className="campo tabular mt-1.5 !w-40 !py-2 !text-[13px]"
              />
            </div>
            <div>
              <label htmlFor="custo" className="rotulo">
                Custo por {ingrediente?.unidade ?? "un"}
              </label>
              <input
                id="custo"
                type="number"
                min={0}
                step="0.01"
                value={custo || ""}
                onChange={(e) => setCusto(Number(e.target.value))}
                placeholder={String(ingrediente?.custoUnitario ?? 0)}
                className="campo tabular mt-1.5 !w-28 !py-2 !text-[13px]"
              />
            </div>
            <div className="min-w-0 flex-1 basis-36">
              <label htmlFor="fornecedor" className="rotulo">
                Fornecedor
              </label>
              <input
                id="fornecedor"
                value={fornecedor}
                onChange={(e) => setFornecedor(e.target.value)}
                placeholder="opcional"
                className="campo mt-1.5 !py-2 !text-[13px]"
              />
            </div>
          </>
        ) : (
          <div className="min-w-0 flex-1 basis-44">
            <label htmlFor="motivo" className="rotulo">
              Motivo
            </label>
            <select
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="campo mt-1.5 !py-2 !text-[13px]"
            >
              {MOTIVOS_DE_PERDA.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="submit"
          disabled={quantidade <= 0}
          className={`rounded-xl px-3.5 py-2 text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-35 ${
            aba === "entrada"
              ? "bg-gradient-to-b from-jade-400 to-jade-500 text-tinta"
              : "border border-brasa-300/40 text-brasa-300 hover:bg-white/5"
          }`}
        >
          {aba === "entrada" ? "Registrar entrada" : "Lançar perda"}
        </button>
      </form>

      <div className="pt-1">
        <p className="rotulo mb-1">Últimos lançamentos</p>
        {recentes.length === 0 ? (
          <p className="py-4 text-[13px] text-marfim/50">
            Nenhum movimento ainda. A câmara está com a carga de abertura.
          </p>
        ) : (
          <ul className="tabular">
            {recentes.map((m) => {
              const base = ESTOQUE.find((e) => e.id === m.ingredienteId);
              const estilo = SINAL[m.tipo];

              return (
                <li
                  key={m.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-white/[0.06] py-2 text-[13px] last:border-b-0"
                >
                  <span className="flex min-w-0 items-baseline gap-2.5">
                    <span className="w-14 shrink-0 text-[11px] text-marfim/45">
                      {new Date(m.em).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <Etiqueta cor={estilo.cor}>{estilo.rotulo}</Etiqueta>
                    <span className="truncate text-marfim/85">
                      {base?.nome ?? m.ingredienteId}
                    </span>
                  </span>

                  <span className="flex shrink-0 items-baseline gap-3">
                    {(m.fornecedor || m.motivo) && (
                      <span className="text-[11px] text-marfim/45">
                        {m.fornecedor ?? m.motivo}
                      </span>
                    )}
                    {m.validade && (
                      <span className="text-[11px] text-marfim/45">
                        vence {dataLonga(m.validade)}
                      </span>
                    )}
                    {m.tipo === "entrada" && m.custoUnitario ? (
                      <span className="text-[11px] text-marfim/45">
                        {dinheiro(m.quantidade * m.custoUnitario)}
                      </span>
                    ) : null}
                    <span
                      className={`font-semibold ${
                        m.tipo === "entrada"
                          ? "text-jade-300"
                          : m.tipo === "perda"
                            ? "text-brasa-300"
                            : "text-marfim/70"
                      }`}
                    >
                      {estilo.simbolo}
                      {numero(m.quantidade, 2)} {base?.unidade ?? ""}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Secao>
  );
}
