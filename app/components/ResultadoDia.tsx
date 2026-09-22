"use client";

import { NOMES_DIAS_CURTOS, dataLonga, dinheiro, nomeDoPrato, numero } from "@/lib/dados";
import type { ResumoDoDia } from "@/lib/previsao";
import { PRATOS } from "@/lib/dados";
import { Cartao, Etiqueta, Vazio } from "./ui";

export default function ResultadoDia({ resumo }: { resumo: ResumoDoDia }) {
  return (
    <div className="space-y-5">
      <Destaques resumo={resumo} />
      <PrevisaoPorPrato resumo={resumo} />

      <div className="grid gap-5 lg:grid-cols-2">
        <PratoDoDia resumo={resumo} />
        <Alertas resumo={resumo} />
      </div>

      <ListaDeCompras resumo={resumo} />
      <DiasParecidos resumo={resumo} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Destaques({ resumo }: { resumo: ResumoDoDia }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Destaques do dia
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {resumo.destaques.map((d) => (
          <div
            key={d.rotulo}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {d.rotulo}
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{d.valor}</p>
            <p className="mt-1 text-sm text-slate-500">{d.detalhe}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function PrevisaoPorPrato({ resumo }: { resumo: ResumoDoDia }) {
  const escala = Math.max(...resumo.previsoes.map((p) => p.maximo), 1);

  return (
    <Cartao
      titulo="Previsão por prato"
      descricao={`KNN com os ${resumo.diasParecidos.length} dias mais parecidos do histórico. A faixa é o menor e o maior valor observado nesses dias.`}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {resumo.previsoes
          .slice()
          .sort((a, b) => b.previsao - a.previsao)
          .map((p) => {
            const alta = p.variacao > 5;
            const baixa = p.variacao < -5;
            return (
              <div
                key={p.pratoId}
                className="rounded-lg border border-slate-200 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">{p.nome}</h3>
                  <Etiqueta cor={alta ? "verde" : baixa ? "ambar" : "neutro"}>
                    {p.variacao > 0 ? "+" : ""}
                    {p.variacao}% vs. média
                  </Etiqueta>
                </div>

                <p className="mt-2 tabular text-3xl font-semibold text-slate-900">
                  {numero(p.previsao)}
                  <span className="ml-1 text-sm font-normal text-slate-500">
                    porções
                  </span>
                </p>

                <div className="mt-3">
                  <div className="relative h-2 rounded-full bg-slate-100">
                    <div
                      className="absolute h-2 rounded-full bg-marca-100"
                      style={{
                        left: `${(p.minimo / escala) * 100}%`,
                        width: `${Math.max(((p.maximo - p.minimo) / escala) * 100, 1.5)}%`,
                      }}
                    />
                    <div
                      className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-marca-600 shadow"
                      style={{ left: `${(p.previsao / escala) * 100}%` }}
                    />
                  </div>
                  <p className="mt-2 tabular text-xs text-slate-500">
                    Faixa dos dias parecidos: {p.minimo} a {p.maximo} porções ·
                    média do mesmo dia da semana: {numero(p.mediaDoDiaSemana)}
                  </p>
                </div>
              </div>
            );
          })}
      </div>
    </Cartao>
  );
}

/* ------------------------------------------------------------------ */

function PratoDoDia({ resumo }: { resumo: ResumoDoDia }) {
  const p = resumo.pratoDoDia;

  return (
    <Cartao
      titulo="Prato do dia sugerido"
      descricao="Escolhido pelo ingrediente mais perto do vencimento que ainda dá para aproveitar."
      className="h-full"
    >
      {p ? (
        <div>
          <p className="text-2xl font-semibold text-slate-900">{p.nome}</p>
          <p className="mt-2 text-sm text-slate-600">
            Usa <strong>{p.ingrediente}</strong>, que vence{" "}
            {p.diasParaVencer === 0
              ? "no próprio dia"
              : `em ${p.diasParaVencer} dia${p.diasParaVencer > 1 ? "s" : ""}`}{" "}
            — há {numero(p.quantidadeEmEstoque, 1)} {p.unidade} em estoque.
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Previsão de {numero(p.porcoesPrevistas)} porções. Destacar no cardápio
            ajuda a girar esse ingrediente antes de virar perda.
          </p>
        </div>
      ) : (
        <Vazio>Nenhum ingrediente perto do vencimento no estoque simulado.</Vazio>
      )}
    </Cartao>
  );
}

/* ------------------------------------------------------------------ */

const CORES_ALERTA = {
  alto: "border-red-200 bg-red-50 text-red-900",
  medio: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
} as const;

function Alertas({ resumo }: { resumo: ResumoDoDia }) {
  return (
    <Cartao
      titulo="Alertas"
      descricao="O que pode dar errado no serviço de amanhã."
      className="h-full"
    >
      {resumo.alertas.length === 0 ? (
        <Vazio>Nada urgente para este cenário.</Vazio>
      ) : (
        <ul className="space-y-2">
          {resumo.alertas.map((a, i) => (
            <li
              key={`${a.titulo}-${i}`}
              className={`rounded-lg border px-3 py-2 text-sm ${CORES_ALERTA[a.nivel]}`}
            >
              <p className="font-semibold">{a.titulo}</p>
              <p className="opacity-90">{a.detalhe}</p>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}

/* ------------------------------------------------------------------ */

function ListaDeCompras({ resumo }: { resumo: ResumoDoDia }) {
  const aComprar = resumo.compras.filter((c) => c.comprar > 0);
  const cobertos = resumo.compras.filter((c) => c.comprar === 0);

  return (
    <Cartao
      titulo="Lista de compras"
      descricao="Previsão × ficha técnica − estoque. Só entra na lista o que não fecha com o que já existe na câmara; o que estiver vencido na data escolhida não conta como disponível."
      acao={
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Custo estimado
          </p>
          <p className="tabular text-lg font-semibold text-slate-900">
            {dinheiro(resumo.custoDaCompra)}
          </p>
        </div>
      }
    >
      {aComprar.length === 0 ? (
        <Vazio>O estoque cobre toda a previsão deste cenário.</Vazio>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">Ingrediente</th>
                <th className="py-2 pr-3 text-right font-medium">Vai usar</th>
                <th className="py-2 pr-3 text-right font-medium">Em estoque</th>
                <th className="py-2 pr-3 text-right font-medium">Comprar</th>
                <th className="py-2 pr-3 text-right font-medium">Custo</th>
                <th className="py-2 font-medium">Validade do que já tem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {aComprar.map((c) => (
                <tr key={c.id}>
                  <td className="py-2 pr-3 font-medium text-slate-900">{c.nome}</td>
                  <td className="tabular py-2 pr-3 text-right text-slate-600">
                    {numero(c.necessario, 2)} {c.unidade}
                  </td>
                  <td className="tabular py-2 pr-3 text-right text-slate-600">
                    {numero(c.emEstoque, 2)} {c.unidade}
                    {c.vencido && (
                      <span className="ml-1 align-middle">
                        <Etiqueta cor="vermelho">vencido</Etiqueta>
                      </span>
                    )}
                  </td>
                  <td className="tabular py-2 pr-3 text-right font-semibold text-marca-700">
                    {numero(c.comprar, 2)} {c.unidade}
                  </td>
                  <td className="tabular py-2 pr-3 text-right text-slate-600">
                    {dinheiro(c.custoEstimado)}
                  </td>
                  <td className="py-2 text-slate-500">
                    {c.validade ? (
                      <>
                        {dataLonga(c.validade)}{" "}
                        {c.diasParaVencer !== null &&
                          c.diasParaVencer >= 0 &&
                          c.diasParaVencer <= 3 && (
                            <Etiqueta cor={c.diasParaVencer <= 1 ? "vermelho" : "ambar"}>
                              {c.diasParaVencer === 0
                                ? "vence no dia"
                                : `${c.diasParaVencer}d`}
                            </Etiqueta>
                          )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cobertos.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          <strong className="font-medium text-slate-600">Já coberto pelo estoque:</strong>{" "}
          {cobertos.map((c) => c.nome).join(", ")}.
        </p>
      )}
    </Cartao>
  );
}

/* ------------------------------------------------------------------ */

function DiasParecidos({ resumo }: { resumo: ResumoDoDia }) {
  return (
    <Cartao
      titulo="Dias parecidos usados na previsão"
      descricao="São os vizinhos que o KNN encontrou. A previsão de cada prato é a média destas linhas."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3 font-medium">Data</th>
              <th className="py-2 pr-3 font-medium">Dia</th>
              <th className="py-2 pr-3 text-right font-medium">Temp.</th>
              <th className="py-2 pr-3 font-medium">Condições</th>
              <th className="py-2 pr-3 text-right font-medium">Distância</th>
              {PRATOS.map((p) => (
                <th key={p.id} className="py-2 pr-3 text-right font-medium">
                  {p.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {resumo.diasParecidos.map((v) => (
              <tr key={v.registro.data}>
                <td className="tabular py-2 pr-3 font-medium text-slate-900">
                  {dataLonga(v.registro.data)}
                </td>
                <td className="py-2 pr-3 text-slate-600">
                  {NOMES_DIAS_CURTOS[v.registro.diaSemana]}
                </td>
                <td className="tabular py-2 pr-3 text-right text-slate-600">
                  {numero(v.registro.temperatura)} °C
                </td>
                <td className="py-2 pr-3">
                  <span className="flex flex-wrap gap-1">
                    {v.registro.chuva && <Etiqueta cor="azul">chuva</Etiqueta>}
                    {v.registro.feriado && <Etiqueta cor="ambar">feriado</Etiqueta>}
                    {v.registro.inicioMes && (
                      <Etiqueta cor="verde">início do mês</Etiqueta>
                    )}
                    {!v.registro.chuva &&
                      !v.registro.feriado &&
                      !v.registro.inicioMes && (
                        <span className="text-slate-400">dia comum</span>
                      )}
                  </span>
                </td>
                <td className="tabular py-2 pr-3 text-right text-slate-500">
                  {v.distancia.toFixed(3)}
                </td>
                {PRATOS.map((p) => (
                  <td
                    key={p.id}
                    className="tabular py-2 pr-3 text-right text-slate-600"
                  >
                    {v.registro.vendas[p.id] ?? 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 text-sm">
              <td colSpan={5} className="py-2 pr-3 font-medium text-slate-700">
                Média (= previsão)
              </td>
              {PRATOS.map((p) => (
                <td
                  key={p.id}
                  className="tabular py-2 pr-3 text-right font-semibold text-marca-700"
                >
                  {numero(
                    resumo.previsoes.find((x) => x.pratoId === p.id)?.previsao ?? 0
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Distância 0 seria um dia idêntico ao cenário escolhido. Pratos:{" "}
        {PRATOS.map((p) => nomeDoPrato(p.id)).join(", ")}.
      </p>
    </Cartao>
  );
}
