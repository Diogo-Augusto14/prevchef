import {
  CABECALHO_TABELA,
  CELULA,
  Etiqueta,
  Heroi,
  LinhaDeNumeros,
  Secao,
  TituloDaTela,
} from "../components/ui";
import { DIA_PADRAO, dataLonga, dinheiro, numero } from "@/lib/dados";
import { DIAS_ALERTA_VALIDADE, estoqueComValidade } from "@/lib/previsao";

export const metadata = { title: "Estoque — PrevChef" };

/** A régua da linha do tempo: 30 dias. O que passa disso encosta no fim. */
const HORIZONTE = 30;

export default function EstoquePage() {
  const itens = estoqueComValidade(DIA_PADRAO);
  const urgentes = itens.filter((i) => i.diasParaVencer <= DIAS_ALERTA_VALIDADE);
  const valorTotal = itens.reduce((s, i) => s + i.quantidade * i.custoUnitario, 0);
  const valorEmRisco = urgentes.reduce(
    (s, i) => s + i.quantidade * i.custoUnitario,
    0
  );

  return (
    <div className="space-y-8">
      <TituloDaTela titulo="Estoque">
        Contando os dias a partir de {dataLonga(DIA_PADRAO)} — o próximo dia a
        planejar.
      </TituloDaTela>

      {/* Herói: o que precisa girar esta semana. */}
      <Heroi>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-6 pt-6">
          <h2 className="font-display text-xl font-normal text-marfim">
            Gire estes primeiro
          </h2>
          <p className="text-[13px] text-marfim/62">
            {urgentes.length} itens vencem em até {DIAS_ALERTA_VALIDADE} dias ·{" "}
            <span className="tabular font-semibold text-ambar-300">
              {dinheiro(valorEmRisco)}
            </span>{" "}
            em risco de perda
          </p>
        </div>

        <div className="mt-5 grid border-t border-white/10 sm:grid-cols-3">
          {urgentes.slice(0, 3).map((i, indice) => (
            <div
              key={i.id}
              className={`px-6 py-5 ${indice > 0 ? "sm:border-l sm:border-white/10" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-display text-lg font-normal text-marfim">
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
              <p className="tabular mt-2 font-display text-[30px] font-light leading-none tracking-tight text-ambar-200">
                {numero(i.quantidade, 2)}
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
      </Heroi>

      <LinhaDeNumeros
        className="border-y border-white/10 py-4"
        itens={[
          {
            rotulo: "Itens cadastrados",
            valor: String(itens.length),
            detalhe: "ingredientes na câmara",
          },
          {
            rotulo: "Perto de vencer",
            valor: String(urgentes.length),
            detalhe: `em até ${DIAS_ALERTA_VALIDADE} dias`,
            forte: true,
          },
          {
            rotulo: "Valor parado",
            valor: dinheiro(valorTotal),
            detalhe: "custo do que está na câmara",
          },
          {
            rotulo: "Vida útil mediana",
            valor: `${medianaDeDias(itens)} dias`,
            detalhe: "metade do estoque vence antes disso",
          },
        ]}
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
                  <span className="flex justify-between text-marfim/35">
                    <span>hoje</span>
                    <span>7</span>
                    <span>14</span>
                    <span>21</span>
                    <span>{HORIZONTE}+ dias</span>
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
                        urgente ? "text-ambar-200" : "text-marfim"
                      }`}
                    >
                      {i.nome}
                    </td>
                    <td className={`${CELULA} pr-4 text-right text-marfim/70`}>
                      {numero(i.quantidade, 2)} {i.unidade}
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
                                  : "bg-jade-400/45"
                            }`}
                            style={{ width: `${largura}%` }}
                          />
                        </span>
                        <span
                          className={`w-14 shrink-0 text-right text-[11px] ${
                            urgente ? "text-ambar-300" : "text-marfim/45"
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
    </div>
  );
}

function medianaDeDias(itens: { diasParaVencer: number }[]): number {
  if (itens.length === 0) return 0;
  const ordenados = itens.map((i) => i.diasParaVencer).sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2
    ? ordenados[meio]
    : Math.round((ordenados[meio - 1] + ordenados[meio]) / 2);
}
