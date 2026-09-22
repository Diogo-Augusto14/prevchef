import {
  CABECALHO_TABELA,
  CELULA,
  Cartao,
  Etiqueta,
  Indicador,
  TituloDaTela,
} from "../components/ui";
import { DIA_PADRAO, dataLonga, dinheiro, numero } from "@/lib/dados";
import { DIAS_ALERTA_VALIDADE, estoqueComValidade } from "@/lib/previsao";

export const metadata = { title: "Estoque — PrevChef" };

export default function EstoquePage() {
  const itens = estoqueComValidade(DIA_PADRAO);
  const vencendo = itens.filter(
    (i) => i.diasParaVencer >= 0 && i.diasParaVencer <= DIAS_ALERTA_VALIDADE
  );
  const vencidos = itens.filter((i) => i.diasParaVencer < 0);
  const valorTotal = itens.reduce((s, i) => s + i.quantidade * i.custoUnitario, 0);

  return (
    <div className="space-y-7">
      <TituloDaTela titulo="Estoque">
        Quantidade e validade de cada ingrediente, contando os dias a partir de{" "}
        {dataLonga(DIA_PADRAO)} — o próximo dia a planejar.
      </TituloDaTela>

      <div className="grid gap-[18px] sm:grid-cols-3">
        <Indicador
          rotulo="Itens cadastrados"
          valor={String(itens.length)}
          detalhe="ingredientes na câmara"
        />
        <Indicador
          rotulo="Perto de vencer"
          valor={String(vencendo.length + vencidos.length)}
          detalhe={`vencem em até ${DIAS_ALERTA_VALIDADE} dias${
            vencidos.length ? ` · ${vencidos.length} já vencido(s)` : ""
          }`}
          destaque
          tom="ambar"
        />
        <Indicador
          rotulo="Valor parado"
          valor={dinheiro(valorTotal)}
          detalhe="custo do que está na câmara"
        />
      </div>

      <Cartao
        titulo="Ingredientes"
        descricao="Do que vence primeiro para o que vence por último."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className={`${CABECALHO_TABELA} pr-3`}>Ingrediente</th>
                <th className={`${CABECALHO_TABELA} pr-3 text-right`}>Quantidade</th>
                <th className={`${CABECALHO_TABELA} pl-6 pr-3`}>Validade</th>
                <th className={`${CABECALHO_TABELA} pr-3`}>Situação</th>
                <th className={`${CABECALHO_TABELA} pr-3 text-right`}>
                  Custo unitário
                </th>
                <th className={`${CABECALHO_TABELA} pl-6`}>Usado em</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {itens.map((i) => {
                const urgente =
                  i.diasParaVencer >= 0 && i.diasParaVencer <= DIAS_ALERTA_VALIDADE;
                return (
                  <tr
                    key={i.id}
                    className={
                      i.diasParaVencer < 0
                        ? "bg-brasa-300/[0.06]"
                        : urgente
                          ? "bg-ambar-500/[0.06]"
                          : undefined
                    }
                  >
                    <td className={`${CELULA} pl-2.5 pr-3 font-semibold text-marfim`}>
                      {i.nome}
                    </td>
                    <td className={`${CELULA} pr-3 text-right text-marfim/74`}>
                      {numero(i.quantidade, 2)} {i.unidade}
                    </td>
                    <td className={`${CELULA} pl-6 pr-3 text-marfim/74`}>
                      {dataLonga(i.validade)}
                    </td>
                    <td className={`${CELULA} pr-3`}>
                      {i.diasParaVencer < 0 ? (
                        <Etiqueta cor="brasa">vencido</Etiqueta>
                      ) : i.diasParaVencer === 0 ? (
                        <Etiqueta cor="brasa">vence no dia</Etiqueta>
                      ) : urgente ? (
                        <Etiqueta cor="ambar">
                          {i.diasParaVencer} dia{i.diasParaVencer > 1 ? "s" : ""}
                        </Etiqueta>
                      ) : (
                        <span className="text-marfim/55">
                          {i.diasParaVencer} dias
                        </span>
                      )}
                    </td>
                    <td className={`${CELULA} pr-3 text-right text-marfim/74`}>
                      {dinheiro(i.custoUnitario)}/{i.unidade}
                    </td>
                    <td className={`${CELULA} pl-6 pr-2.5 text-marfim/62`}>
                      {i.usadoEm.length ? i.usadoEm.join(", ") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Cartao>
    </div>
  );
}
