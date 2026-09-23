"use client";

import { useState } from "react";
import { BOTAO_PRIMARIO, Etiqueta, Secao, Vazio } from "./ui";
import {
  ESTOQUE,
  dataLocal,
  dataLonga,
  dinheiro,
  numero,
  quantidade as emUnidade,
  somarDias,
} from "@/lib/dados";
import { MOTIVOS_DE_PERDA, saldoDe } from "@/lib/estoque";
import { operadorPorId, motivoDaNegativa } from "@/lib/equipe";
import { useOperacao } from "@/lib/operacao";
import type { MovimentoDeEstoque } from "@/lib/tipos";

/** AAAA-MM-DD de hoje + dias, no fuso local, para o campo de validade. */
function hojeMaisDias(dias: number): string {
  return somarDias(dataLocal(), dias);
}

const SINAL = {
  entrada: { rotulo: "Entrada", cor: "nevoa", simbolo: "+" },
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
  const { operador, autorizado, lotes } = useOperacao();
  const podeMovimentar = autorizado("movimentarEstoque");

  const [aba, setAba] = useState<"entrada" | "perda">("entrada");

  const [ingredienteId, setIngredienteId] = useState(ESTOQUE[0]?.id ?? "");
  // Quantidade e custo ficam como texto para aceitar "0,5" digitado a partir do zero.
  const [quantidade, setQuantidade] = useState("");
  const [validade, setValidade] = useState(hojeMaisDias(7));
  const [custo, setCusto] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [motivo, setMotivo] = useState<string>(MOTIVOS_DE_PERDA[0]);

  const ingrediente = ESTOQUE.find((e) => e.id === ingredienteId);
  const unidade = ingrediente?.unidade ?? "un";
  const recentes = [...movimentos].sort((a, b) => b.em.localeCompare(a.em)).slice(0, 12);

  const hoje = dataLocal();
  const qtd = Number(quantidade);
  const saldo = saldoDe(lotes, ingredienteId);
  const perdaExcede = aba === "perda" && qtd > saldo;
  // Perda acima do saldo não trava: o razão guarda o movimento como foi lançado.
  const podeRegistrar =
    qtd > 0 &&
    podeMovimentar &&
    (aba === "entrada" ? !!validade && validade >= hoje : true);

  function limpar() {
    setQuantidade("");
    setCusto("");
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
              className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                aba === op
                  ? "border-fogo-500 bg-fogo-500 font-bold text-tinta"
                  : "border-white/12 font-semibold text-marfim/70 hover:border-white/25"
              }`}
            >
              {op === "entrada" ? "Entrada" : "Perda"}
            </button>
          ))}
        </div>
      }
    >
      <form
        className="flex flex-wrap items-end gap-2.5 border-b border-white/[0.07] pb-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!podeRegistrar) return;

          if (aba === "entrada") {
            const custoDigitado = Number(custo);
            aoEntrar({
              ingredienteId,
              quantidade: qtd,
              validade,
              // Em branco vale o custo de referência que o placeholder mostra.
              custoUnitario:
                custoDigitado > 0 ? custoDigitado : (ingrediente?.custoUnitario ?? 0),
              fornecedor,
            });
          } else {
            aoPerder(ingredienteId, qtd, motivo);
          }
          limpar();
        }}
      >
        <div className="min-w-0 flex-1 basis-48">
          <label htmlFor="ingrediente" className="rotulo block">
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
          <label htmlFor="quantidade" className="rotulo block">
            Quantidade ({unidade})
          </label>
          <input
            id="quantidade"
            type="number"
            min={0}
            step="0.01"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            aria-describedby={perdaExcede ? "perda-excede" : undefined}
            className="campo tabular mt-1.5 !w-28 !py-2 !text-[13px]"
          />
        </div>

        {aba === "entrada" ? (
          <>
            <div>
              <label htmlFor="validade-entrada" className="rotulo block">
                Validade do lote
              </label>
              <input
                id="validade-entrada"
                type="date"
                min={hoje}
                value={validade}
                onChange={(e) => setValidade(e.target.value)}
                className="campo tabular mt-1.5 !w-40 !py-2 !text-[13px]"
              />
            </div>
            <div>
              <label htmlFor="custo" className="rotulo block">
                Custo por {unidade}
              </label>
              <input
                id="custo"
                type="number"
                min={0}
                step="0.01"
                value={custo}
                onChange={(e) => setCusto(e.target.value)}
                placeholder={numero(ingrediente?.custoUnitario ?? 0, 2)}
                className="campo tabular mt-1.5 !w-28 !py-2 !text-[13px]"
              />
            </div>
            <div className="min-w-0 flex-1 basis-36">
              <label htmlFor="fornecedor" className="rotulo block">
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
          <>
            <div>
              <p className="rotulo">Na câmara</p>
              <p
                className={`tabular mt-1.5 py-2 text-[13px] ${
                  perdaExcede ? "font-semibold text-ambar-200" : "text-marfim/80"
                }`}
              >
                {emUnidade(saldo, unidade)}
              </p>
            </div>
            {perdaExcede && (
              <p
                id="perda-excede"
                role="status"
                className="vidro-ambar order-last basis-full rounded-xl px-3.5 py-2 text-[12px] leading-relaxed text-ambar-200"
              >
                Maior que o saldo de {emUnidade(saldo, unidade)} — o saldo para em zero, mas
                a perda entra como lançada.
              </p>
            )}
            <div className="min-w-0 flex-1 basis-44">
              <label htmlFor="motivo" className="rotulo block">
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
          </>
        )}

        <button
          type="submit"
          disabled={!podeRegistrar}
          className={
            aba === "entrada"
              ? BOTAO_PRIMARIO + " px-3.5 py-2 text-[13px]"
              : "rounded-xl border border-brasa-300/40 px-3.5 py-2 text-[13px] font-bold text-brasa-300 transition hover:bg-brasa-300/10 disabled:cursor-not-allowed disabled:opacity-35"
          }
        >
          {aba === "entrada" ? "Registrar entrada" : "Lançar perda"}
        </button>
      </form>

      {!podeMovimentar && (
        <p className="vidro-ambar mt-3 rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed text-ambar-200">
          {motivoDaNegativa(operador, "movimentarEstoque")}
        </p>
      )}

      <div className="pt-4">
        <p className="rotulo mb-1">Últimos lançamentos</p>
        {recentes.length === 0 ? (
          <Vazio>Nenhum movimento ainda. A câmara está com a carga de abertura.</Vazio>
        ) : (
          <ul className="tabular">
            {recentes.map((m) => {
              const base = ESTOQUE.find((e) => e.id === m.ingredienteId);
              const estilo = SINAL[m.tipo];

              return (
                <li
                  key={m.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-white/[0.07] py-2 text-[13px] last:border-b-0"
                >
                  <span className="flex min-w-0 items-baseline gap-2.5">
                    <span className="w-14 shrink-0 text-[11px] text-marfim/55">
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

                  <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:shrink-0">
                    {m.operadorId && (
                      <span className="text-[11px] text-marfim/55">
                        {operadorPorId(m.operadorId)?.nome.split(" ")[0] ?? "—"}
                      </span>
                    )}
                    {(m.fornecedor || m.motivo) && (
                      <span className="text-[11px] text-marfim/55">
                        {m.fornecedor ?? m.motivo}
                      </span>
                    )}
                    {m.validade && (
                      <span className="text-[11px] text-marfim/55">
                        vence {dataLonga(m.validade)}
                      </span>
                    )}
                    {m.tipo === "entrada" && m.custoUnitario ? (
                      <span className="text-[11px] text-marfim/55">
                        {dinheiro(m.quantidade * m.custoUnitario)}
                      </span>
                    ) : null}
                    <span
                      className={`font-semibold ${
                        m.tipo === "entrada"
                          ? "text-nevoa-300"
                          : m.tipo === "perda"
                            ? "text-brasa-300"
                            : "text-marfim/70"
                      }`}
                    >
                      {estilo.simbolo}
                      {emUnidade(m.quantidade, base?.unidade ?? "")}
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
