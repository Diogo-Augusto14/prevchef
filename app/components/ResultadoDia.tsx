"use client";

import {
  NOMES_DIAS_CURTOS,
  PRATOS,
  dataLonga,
  dinheiro,
  numero,
} from "@/lib/dados";
import type { ResumoDoDia } from "@/lib/previsao";
import { CABECALHO_TABELA, CELULA, Cartao, Etiqueta, Indicador, Vazio } from "./ui";

export default function ResultadoDia({ resumo }: { resumo: ResumoDoDia }) {
  return (
    <div className="space-y-7">
      <Destaques resumo={resumo} />
      <PrevisaoPorPrato resumo={resumo} />

      <div className="grid gap-[18px] lg:grid-cols-2">
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
      <h2 className="rotulo mb-3">Destaques do dia</h2>
      <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
        {resumo.destaques.map((d, i) => (
          <Indicador
            key={d.rotulo}
            rotulo={d.rotulo}
            valor={d.valor}
            detalhe={d.detalhe}
            destaque={i === 2}
          />
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
      descricao={`KNN com os ${resumo.diasParecidos.length} dias mais parecidos do histórico · a faixa é o menor e o maior valor observado nesses dias`}
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
                className={`rounded-[18px] px-5 py-[18px] ${
                  alta ? "vidro-jade" : "vidro-bloco"
                }`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <h3
                    className={`font-display text-[19px] font-medium ${
                      alta ? "text-jade-200" : "text-marfim"
                    }`}
                  >
                    {p.nome}
                  </h3>
                  <Etiqueta cor={alta ? "jade" : baixa ? "ambar" : "neutro"}>
                    {p.variacao > 0 ? "+" : ""}
                    {p.variacao}%
                  </Etiqueta>
                </div>

                <p
                  className={`tabular mt-3 font-display text-[40px] font-light leading-none tracking-tight ${
                    alta ? "text-jade-100" : "text-marfim"
                  }`}
                >
                  {numero(p.previsao)}
                </p>

                <div className="trilho mt-4">
                  <div
                    className="absolute h-[6px] rounded-full bg-jade-400/35"
                    style={{
                      left: `${(p.minimo / escala) * 100}%`,
                      width: `${Math.max(((p.maximo - p.minimo) / escala) * 100, 1.5)}%`,
                    }}
                  />
                  <div
                    className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-tinta/85 bg-jade-300 shadow-[0_0_16px_rgba(155,235,203,0.85)]"
                    style={{ left: `${(p.previsao / escala) * 100}%` }}
                  />
                </div>

                <p
                  className={`tabular mt-3 text-xs leading-snug ${
                    alta ? "text-jade-200/72" : "text-marfim/58"
                  }`}
                >
                  faixa {p.minimo}–{p.maximo} · média do mesmo dia da semana{" "}
                  {numero(p.mediaDoDiaSemana)}
                </p>
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
          <p className="font-display text-[32px] font-normal tracking-tight text-jade-200">
            {p.nome}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-marfim/84">
            Usa <strong className="font-bold text-marfim">{p.ingrediente}</strong>
            , que vence{" "}
            {p.diasParaVencer === 0
              ? "no próprio dia"
              : `em ${p.diasParaVencer} dia${p.diasParaVencer > 1 ? "s" : ""}`}{" "}
            — há {numero(p.quantidadeEmEstoque, 1)} {p.unidade} em estoque.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-marfim/68">
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
  alto: { caixa: "vidro-brasa", titulo: "text-brasa-300", texto: "text-brasa-300/82" },
  medio: { caixa: "vidro-ambar", titulo: "text-ambar-300", texto: "text-ambar-200/82" },
  info: { caixa: "vidro-nevoa", titulo: "text-nevoa-300", texto: "text-nevoa-300/82" },
} as const;

function Alertas({ resumo }: { resumo: ResumoDoDia }) {
  return (
    <Cartao
      titulo="Alertas"
      descricao="O que pode dar errado no serviço."
      className="h-full"
    >
      {resumo.alertas.length === 0 ? (
        <Vazio>Nada urgente para este cenário.</Vazio>
      ) : (
        <ul className="space-y-2.5">
          {resumo.alertas.map((a, i) => {
            const cor = CORES_ALERTA[a.nivel];
            return (
              <li
                key={`${a.titulo}-${i}`}
                className={`${cor.caixa} rounded-2xl px-4 py-3.5`}
              >
                <p className={`text-sm font-bold ${cor.titulo}`}>{a.titulo}</p>
                <p className={`mt-1 text-[12.5px] leading-relaxed ${cor.texto}`}>
                  {a.detalhe}
                </p>
              </li>
            );
          })}
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
      descricao="Previsão × ficha técnica − estoque. O que está vencido na data escolhida não conta como disponível."
      acao={
        <div className="text-right">
          <p className="rotulo">Custo estimado</p>
          <p className="tabular mt-1 font-display text-[26px] font-normal text-marfim">
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
              <tr className="text-left">
                <th className={`${CABECALHO_TABELA} pr-3`}>Ingrediente</th>
                <th className={`${CABECALHO_TABELA} pr-3 text-right`}>Vai usar</th>
                <th className={`${CABECALHO_TABELA} pr-3 text-right`}>Em estoque</th>
                <th className={`${CABECALHO_TABELA} pr-3 text-right`}>Comprar</th>
                <th className={`${CABECALHO_TABELA} pr-3 text-right`}>Custo</th>
                <th className={`${CABECALHO_TABELA} pl-5`}>Validade</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {aComprar.map((c) => (
                <tr key={c.id}>
                  <td className={`${CELULA} pr-3 font-semibold text-marfim`}>
                    {c.nome}
                  </td>
                  <td className={`${CELULA} pr-3 text-right text-marfim/72`}>
                    {numero(c.necessario, 2)} {c.unidade}
                  </td>
                  <td className={`${CELULA} pr-3 text-right text-marfim/72`}>
                    {numero(c.emEstoque, 2)} {c.unidade}
                    {c.vencido && (
                      <span className="ml-1.5 align-middle">
                        <Etiqueta cor="brasa">vencido</Etiqueta>
                      </span>
                    )}
                  </td>
                  <td className={`${CELULA} pr-3 text-right font-bold text-jade-300`}>
                    {numero(c.comprar, 2)} {c.unidade}
                  </td>
                  <td className={`${CELULA} pr-3 text-right text-marfim/72`}>
                    {dinheiro(c.custoEstimado)}
                  </td>
                  <td className={`${CELULA} pl-5 text-marfim/62`}>
                    {c.validade ? (
                      <>
                        {dataLonga(c.validade)}{" "}
                        {c.diasParaVencer !== null &&
                          c.diasParaVencer >= 0 &&
                          c.diasParaVencer <= 3 && (
                            <Etiqueta cor={c.diasParaVencer <= 1 ? "brasa" : "ambar"}>
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
        <p className="mt-4 text-xs leading-relaxed text-marfim/52">
          <strong className="font-semibold text-marfim/68">
            Já coberto pelo estoque:
          </strong>{" "}
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
            <tr className="text-left">
              <th className={`${CABECALHO_TABELA} pr-3`}>Data</th>
              <th className={`${CABECALHO_TABELA} pr-3`}>Dia</th>
              <th className={`${CABECALHO_TABELA} pr-3 text-right`}>Temp.</th>
              <th className={`${CABECALHO_TABELA} pr-3`}>Condições</th>
              <th className={`${CABECALHO_TABELA} pr-3 text-right`}>Distância</th>
              {PRATOS.map((p) => (
                <th key={p.id} className={`${CABECALHO_TABELA} pr-3 text-right`}>
                  {p.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular">
            {resumo.diasParecidos.map((v) => (
              <tr key={v.registro.data}>
                <td className={`${CELULA} pr-3 font-semibold text-marfim`}>
                  {dataLonga(v.registro.data)}
                </td>
                <td className={`${CELULA} pr-3 text-marfim/72`}>
                  {NOMES_DIAS_CURTOS[v.registro.diaSemana]}
                </td>
                <td className={`${CELULA} pr-3 text-right text-marfim/72`}>
                  {numero(v.registro.temperatura)} °C
                </td>
                <td className={`${CELULA} pr-3`}>
                  <span className="flex flex-wrap gap-1.5">
                    {v.registro.chuva && <Etiqueta cor="nevoa">chuva</Etiqueta>}
                    {v.registro.feriado && <Etiqueta cor="ambar">feriado</Etiqueta>}
                    {v.registro.inicioMes && (
                      <Etiqueta cor="jadeSuave">início do mês</Etiqueta>
                    )}
                    {!v.registro.chuva &&
                      !v.registro.feriado &&
                      !v.registro.inicioMes && (
                        <span className="text-marfim/40">dia comum</span>
                      )}
                  </span>
                </td>
                <td className={`${CELULA} pr-3 text-right text-marfim/55`}>
                  {v.distancia.toFixed(3)}
                </td>
                {PRATOS.map((p) => (
                  <td key={p.id} className={`${CELULA} pr-3 text-right text-marfim/72`}>
                    {v.registro.vendas[p.id] ?? 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="pt-3.5 pr-3 font-semibold text-marfim/82">
                Média (= previsão)
              </td>
              {PRATOS.map((p) => (
                <td
                  key={p.id}
                  className="tabular pt-3.5 pr-3 text-right font-bold text-jade-300"
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
      <p className="mt-4 text-xs leading-relaxed text-marfim/52">
        Distância 0 seria um dia idêntico ao cenário atual.
      </p>
    </Cartao>
  );
}
