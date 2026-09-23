"use client";

import { useMemo, type ReactNode } from "react";
import {
  BlocoDoTrilho,
  CABECALHO_TABELA,
  CELULA,
  Carregando,
  Etiqueta,
  Heroi,
  Secao,
  TelaComTrilho,
  TituloDoTrilho,
  Vazio,
} from "../components/ui";
import { dataLocal, dataLonga, dinheiro, numero, quantidade } from "@/lib/dados";
import { useOperacao } from "@/lib/operacao";
import { resumoDosMovimentos } from "@/lib/estoque";
import EntradaDeEstoque from "../components/EntradaDeEstoque";
import { DIAS_ALERTA_VALIDADE, estoqueComValidade } from "@/lib/previsao";

/** A régua da linha do tempo: 30 dias. O que passa disso encosta no fim. */
const HORIZONTE = 30;

export default function EstoquePage() {
  const {
    pronto,
    estoqueAtual,
    movimentos,
    agora,
    registrarEntrada,
    registrarPerda,
  } = useOperacao();

  const hoje = dataLocal(agora);
  const itens = useMemo(
    () => estoqueComValidade(hoje, estoqueAtual),
    [hoje, estoqueAtual]
  );

  const doDia = useMemo(() => {
    const inicio = new Date(agora);
    inicio.setHours(0, 0, 0, 0);
    return resumoDosMovimentos(movimentos, inicio);
  }, [movimentos, agora]);

  if (!pronto) {
    return <Carregando titulo="Estoque">Abrindo a câmara…</Carregando>;
  }

  const urgentes = itens.filter((i) => i.diasParaVencer <= DIAS_ALERTA_VALIDADE);
  const valorTotal = itens.reduce((s, i) => s + i.quantidade * i.custoUnitario, 0);
  const valorEmRisco = urgentes.reduce(
    (s, i) => s + i.quantidade * i.custoUnitario,
    0
  );

  const trilho = (
    <>
      <TituloDoTrilho titulo="Estoque">
        Contando os dias a partir de hoje, {dataLonga(hoje)}.
      </TituloDoTrilho>

      <BlocoDoTrilho rotulo="Perto de vencer">
        <p
          className={`tabular font-display text-[44px] font-medium leading-none tracking-tight ${
            urgentes.length > 0 ? "text-ambar-200" : "text-marfim"
          }`}
        >
          {urgentes.length}
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-marfim/60">
          em até {DIAS_ALERTA_VALIDADE} dias ·{" "}
          <span
            className={`tabular font-semibold ${
              urgentes.length > 0 ? "text-ambar-300" : "text-marfim/75"
            }`}
          >
            {dinheiro(valorEmRisco)}
          </span>{" "}
          em risco de perda
        </p>
      </BlocoDoTrilho>

      <BlocoDoTrilho rotulo="Na câmara">
        <dl>
          <NumeroDoTrilho
            rotulo="Itens cadastrados"
            valor={String(itens.length)}
            detalhe="ingredientes na câmara"
          />
          <NumeroDoTrilho
            rotulo="Valor parado"
            valor={dinheiro(valorTotal)}
            detalhe="custo do que está na câmara"
          />
        </dl>
      </BlocoDoTrilho>

      <BlocoDoTrilho rotulo="Hoje">
        <dl>
          <NumeroDoTrilho
            rotulo="Movimento do dia"
            valor={`${doDia.entradas + doDia.baixas + doDia.perdas}`}
            detalhe={`${plural(doDia.entradas, "entrada", "entradas")} · ${plural(doDia.baixas, "venda", "vendas")} · ${plural(doDia.perdas, "perda", "perdas")}`}
          />
          <NumeroDoTrilho
            rotulo="Perdido hoje"
            valor={dinheiro(doDia.custoDasPerdas)}
            corDoValor={doDia.custoDasPerdas > 0 ? "text-brasa-300" : "text-marfim"}
            detalhe={
              doDia.custoDasPerdas > 0
                ? "custo do que foi descartado"
                : "nada descartado até agora"
            }
          />
        </dl>
      </BlocoDoTrilho>
    </>
  );

  return (
    <TelaComTrilho trilho={trilho}>
      {/* Herói: o que precisa girar esta semana. */}
      <Heroi>
        <header className="px-6 pb-4 pt-5">
          <h2 className="font-display text-[19px] font-semibold tracking-tight text-marfim">
            Gire estes primeiro
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-marfim/55">
            {urgentes.length} {urgentes.length === 1 ? "item vence" : "itens vencem"} em até{" "}
            {DIAS_ALERTA_VALIDADE} dias ·{" "}
            <span
              className={`tabular font-semibold ${
                urgentes.length > 0 ? "text-ambar-300" : "text-marfim/75"
              }`}
            >
              {dinheiro(valorEmRisco)}
            </span>{" "}
            em risco de perda
          </p>
        </header>

        {urgentes.length === 0 ? (
          <div className="px-6 pb-6">
            <Vazio>
              Nada vence nos próximos {DIAS_ALERTA_VALIDADE} dias. A câmara está
              com folga.
            </Vazio>
          </div>
        ) : (
          <div className="grid border-t border-white/10 sm:grid-cols-3">
            {urgentes.slice(0, 3).map((i, indice) => (
              <div
                key={i.id}
                className={`px-6 py-5 ${
                  indice > 0
                    ? "border-t border-white/10 sm:border-l sm:border-t-0"
                    : ""
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 font-display text-lg font-medium text-marfim">
                    {i.nome}
                  </p>
                  {i.diasParaVencer < 0 ? (
                    <Etiqueta cor="brasa">vencido</Etiqueta>
                  ) : i.diasParaVencer === 0 ? (
                    <Etiqueta cor="brasa">vence no dia</Etiqueta>
                  ) : (
                    <Etiqueta cor="ambar">
                      {i.diasParaVencer} dia{i.diasParaVencer > 1 ? "s" : ""}
                    </Etiqueta>
                  )}
                </div>
                <p className="tabular mt-2 font-display text-[30px] font-medium leading-none tracking-tight text-ambar-200">
                  {numero(i.quantidade, i.unidade === "un" ? 0 : 2)}
                  <span className="ml-1.5 font-corpo text-sm font-medium text-marfim/55">
                    {i.unidade}
                  </span>
                </p>
                <p className="mt-2 text-xs leading-snug text-marfim/58">
                  {i.usadoEm.length ? `Entra em ${i.usadoEm.join(" e ")}.` : "Sem prato associado."}{" "}
                  Vale {dinheiro(i.quantidade * i.custoUnitario)}.
                </p>
              </div>
            ))}
          </div>
        )}
      </Heroi>

      <EntradaDeEstoque
        movimentos={movimentos}
        aoEntrar={registrarEntrada}
        aoPerder={registrarPerda}
      />

      <Secao
        titulo="Linha do tempo do estoque"
        descricao="A barra mede quantos dias faltam. Quanto mais curta, mais urgente."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="text-left">
                <th className={`${CABECALHO_TABELA} pr-4`}>Ingrediente</th>
                <th className={`${CABECALHO_TABELA} pr-4 text-right`}>Qtd.</th>
                <th className={`${CABECALHO_TABELA} w-[38%] pr-4`}>
                  {/* mr-[66px] = rótulo "Nd" (w-14) + gap-2.5 da linha: a régua mede só a barra. */}
                  <span className="relative mr-[66px] block text-marfim/55">
                    <span>hoje</span>
                    {[7, 14, 21].map((d) => (
                      <span
                        key={d}
                        className="absolute top-0 -translate-x-1/2"
                        style={{ left: `${(d / HORIZONTE) * 100}%` }}
                      >
                        {d}
                      </span>
                    ))}
                    <span className="absolute right-0 top-0">{HORIZONTE}+ dias</span>
                  </span>
                </th>
                <th className={`${CABECALHO_TABELA} pr-4`}>Validade</th>
                <th className={`${CABECALHO_TABELA} pr-4 text-right`}>Custo un.</th>
                <th className={CABECALHO_TABELA}>Usado em</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {itens.map((i) => {
                const dias = Math.max(0, Math.min(i.diasParaVencer, HORIZONTE));
                const largura = Math.max((dias / HORIZONTE) * 100, 1.5);
                const vencido = i.diasParaVencer < 0;
                const urgente = i.diasParaVencer <= DIAS_ALERTA_VALIDADE;

                return (
                  <tr key={i.id}>
                    <td
                      className={`${CELULA} pr-4 font-semibold ${
                        vencido
                          ? "text-brasa-300"
                          : urgente
                            ? "text-ambar-200"
                            : "text-marfim"
                      }`}
                    >
                      {i.nome}
                    </td>
                    <td className={`${CELULA} pr-4 text-right text-marfim/70`}>
                      {quantidade(i.quantidade, i.unidade)}
                    </td>
                    <td className={`${CELULA} pr-4`}>
                      <span className="flex items-center gap-2.5">
                        <span className="relative h-1.5 flex-1 rounded-full bg-white/[0.06]">
                          <span
                            className={`absolute inset-y-0 left-0 rounded-full ${
                              vencido
                                ? "bg-brasa-300"
                                : urgente
                                  ? "bg-ambar-500"
                                  : "bg-nevoa-500/45"
                            }`}
                            style={{ width: `${largura}%` }}
                          />
                        </span>
                        <span
                          className={`w-14 shrink-0 text-right text-[11px] ${
                            vencido
                              ? "text-brasa-300"
                              : urgente
                                ? "text-ambar-300"
                                : "text-marfim/45"
                          }`}
                        >
                          {vencido
                            ? "vencido"
                            : i.diasParaVencer > HORIZONTE
                              ? `${HORIZONTE}+`
                              : `${i.diasParaVencer}d`}
                        </span>
                      </span>
                    </td>
                    <td className={`${CELULA} pr-4 text-marfim/70`}>
                      {dataLonga(i.validade)}
                    </td>
                    <td className={`${CELULA} pr-4 text-right text-marfim/70`}>
                      {dinheiro(i.custoUnitario)}
                    </td>
                    <td className={`${CELULA} text-marfim/58`}>
                      {i.usadoEm.length ? i.usadoEm.join(", ") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Secao>
    </TelaComTrilho>
  );
}

/** Um número do trilho: rótulo, valor e a linha que explica o valor. */
function NumeroDoTrilho({
  rotulo,
  valor,
  detalhe,
  corDoValor = "text-marfim",
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe: ReactNode;
  corDoValor?: string;
}) {
  return (
    <div className="border-b border-white/[0.07] py-3 first:pt-0 last:border-b-0 last:pb-0">
      <dt className="text-[12px] text-marfim/60">{rotulo}</dt>
      <dd
        className={`tabular mt-1 font-display text-[26px] font-medium leading-none tracking-tight ${corDoValor}`}
      >
        {valor}
      </dd>
      <dd className="mt-1.5 text-xs leading-snug text-marfim/55">{detalhe}</dd>
    </div>
  );
}

/** "1 entrada", "2 entradas". */
function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}
