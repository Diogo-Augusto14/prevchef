import { Cartao, Etiqueta, AvisoSimulado } from "../components/ui";
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
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Estoque
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Quantidade e validade de cada ingrediente, contando os dias a partir
            de {dataLonga(DIA_PADRAO)} — o próximo dia a planejar.
          </p>
        </div>
        <AvisoSimulado />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Resumo
          rotulo="Itens cadastrados"
          valor={String(itens.length)}
          detalhe="ingredientes na câmara"
        />
        <Resumo
          rotulo="Perto de vencer"
          valor={String(vencendo.length + vencidos.length)}
          detalhe={`vencem em até ${DIAS_ALERTA_VALIDADE} dias${
            vencidos.length ? ` (${vencidos.length} já vencido[s])` : ""
          }`}
        />
        <Resumo
          rotulo="Valor parado"
          valor={dinheiro(valorTotal)}
          detalhe="custo do que está na câmara"
        />
      </div>

      <Cartao
        titulo="Ingredientes"
        descricao="Ordenado do que vence primeiro para o que vence por último."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">Ingrediente</th>
                <th className="py-2 pr-3 text-right font-medium">Quantidade</th>
                <th className="py-2 pr-3 font-medium">Validade</th>
                <th className="py-2 pr-3 font-medium">Situação</th>
                <th className="py-2 pr-3 text-right font-medium">Custo unitário</th>
                <th className="py-2 font-medium">Usado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itens.map((i) => (
                <tr key={i.id}>
                  <td className="py-2 pr-3 font-medium text-slate-900">{i.nome}</td>
                  <td className="tabular py-2 pr-3 text-right text-slate-600">
                    {numero(i.quantidade, 2)} {i.unidade}
                  </td>
                  <td className="tabular py-2 pr-3 text-slate-600">
                    {dataLonga(i.validade)}
                  </td>
                  <td className="py-2 pr-3">
                    {i.diasParaVencer < 0 ? (
                      <Etiqueta cor="vermelho">vencido</Etiqueta>
                    ) : i.diasParaVencer === 0 ? (
                      <Etiqueta cor="vermelho">vence no dia</Etiqueta>
                    ) : i.diasParaVencer <= DIAS_ALERTA_VALIDADE ? (
                      <Etiqueta cor="ambar">
                        {i.diasParaVencer} dia{i.diasParaVencer > 1 ? "s" : ""}
                      </Etiqueta>
                    ) : (
                      <span className="text-slate-500">
                        {i.diasParaVencer} dias
                      </span>
                    )}
                  </td>
                  <td className="tabular py-2 pr-3 text-right text-slate-600">
                    {dinheiro(i.custoUnitario)}/{i.unidade}
                  </td>
                  <td className="py-2 text-slate-500">
                    {i.usadoEm.length ? i.usadoEm.join(", ") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>
    </div>
  );
}

function Resumo({
  rotulo,
  valor,
  detalhe,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {rotulo}
      </p>
      <p className="tabular mt-1 text-2xl font-semibold text-slate-900">{valor}</p>
      <p className="mt-1 text-sm text-slate-500">{detalhe}</p>
    </div>
  );
}
