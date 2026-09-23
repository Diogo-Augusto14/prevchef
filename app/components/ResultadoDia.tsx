"use client";

import {
  NOMES_DIAS_CURTOS,
  PRATOS,
  dataCurta,
  dataLonga,
  dinheiro,
  numero,
  quantidade,
} from "@/lib/dados";
import type { ResumoDoDia } from "@/lib/previsao";
import {
  BlocoDoTrilho,
  CABECALHO_TABELA,
  CELULA,
  Etiqueta,
  Heroi,
  Painel,
  Secao,
  Vazio,
} from "./ui";

/* ------------------------------------------------------------------ */
/* Instrumento: os 5 pratos numa lista densa, não em 5 cartões iguais   */
/* ------------------------------------------------------------------ */

export function InstrumentoDePratos({ resumo }: { resumo: ResumoDoDia }) {
  // Escala comum a todos, para as barras serem comparáveis entre si.
  const escala = Math.max(
    ...resumo.previsoes.map((p) => Math.max(p.maximo, p.mediaDoDiaSemana)),
    1
  );
  const pct = (v: number) => `${(v / escala) * 100}%`;

  return (
    <Heroi>
      {/* O Heroi não tem cabeçalho próprio: este segue o mesmo padrão do Secao. */}
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-6 pb-3 pt-5">
        <div className="min-w-0">
          <h2 className="font-display text-[19px] font-semibold tracking-tight text-marfim">
            Previsão por prato
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-marfim/55">
            Barra = faixa dos {resumo.diasParecidos.length} dias parecidos · ponto =
            previsão · traço = média do mesmo dia da semana
          </p>
        </div>
        <a
          href="#dias-parecidos"
          className="text-[12px] font-semibold text-fogo-300 transition hover:text-fogo-200"
        >
          ver os {resumo.diasParecidos.length} dias parecidos
        </a>
      </header>

      <ul className="px-6 pb-3">
        {resumo.previsoes
          .slice()
          .sort((a, b) => b.previsao - a.previsao)
          .map((p) => {
            const alta = p.variacao > 5;
            const baixa = p.variacao < -5;
            return (
              <li
                key={p.pratoId}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-white/[0.07] py-3.5 last:border-b-0 md:grid-cols-[minmax(130px,1.05fr)_minmax(0,2.3fr)_auto] md:gap-6"
              >
                <div className="min-w-0">
                  <p
                    className={`truncate font-display text-[17px] font-normal ${
                      alta ? "text-fogo-200" : "text-marfim"
                    }`}
                  >
                    {p.nome}
                  </p>
                  <p className="tabular mt-0.5 text-[11px] text-marfim/50">
                    faixa {p.minimo}–{p.maximo} · média {numero(p.mediaDoDiaSemana)}
                  </p>
                </div>

                <div className="order-3 col-span-2 md:order-none md:col-span-1">
                  <div className="trilho">
                    <div
                      className={`absolute h-[6px] rounded-full ${
                        alta ? "bg-fogo-500/35" : "bg-white/15"
                      }`}
                      style={{
                        left: pct(p.minimo),
                        width: `max(${pct(p.maximo - p.minimo)}, 2px)`,
                      }}
                    />
                    {/* Média do dia da semana: a régua contra a qual se lê o ponto. */}
                    <div
                      className="absolute top-1/2 h-3.5 w-px -translate-y-1/2 bg-marfim/35"
                      style={{ left: pct(p.mediaDoDiaSemana) }}
                      aria-hidden
                    />
                    <div
                      className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-tinta bg-fogo-500 shadow-[0_0_14px_rgba(255,122,72,0.75)]"
                      style={{ left: pct(p.previsao) }}
                    />
                  </div>
                </div>

                <div className="flex items-baseline justify-end gap-2.5">
                  <span
                    className={`tabular font-display text-[30px] font-medium leading-none tracking-tight ${
                      alta ? "text-fogo-100" : "text-marfim"
                    }`}
                  >
                    {numero(p.previsao)}
                  </span>
                  <span className="w-14 text-right">
                    <Etiqueta cor={alta ? "fogoSuave" : baixa ? "ambar" : "neutro"}>
                      {p.variacao > 0 ? "+" : ""}
                      {p.variacao}%
                    </Etiqueta>
                  </span>
                </div>
              </li>
            );
          })}
      </ul>
    </Heroi>
  );
}

/* ------------------------------------------------------------------ */
/* Decisão: o que servir e o que comprar                               */
/* ------------------------------------------------------------------ */

export function PratoDoDia({ resumo }: { resumo: ResumoDoDia }) {
  const p = resumo.pratoDoDia;
  if (!p) return null;

  return (
    <Painel>
      <p className="rotulo">Prato do dia sugerido</p>
      <p className="mt-2 font-display text-[26px] font-normal leading-tight tracking-tight text-fogo-300">
        {p.nome}
      </p>
      <p className="mt-2.5 text-[13px] leading-relaxed text-marfim/78">
        Aproveita <strong className="font-semibold text-marfim">{p.ingrediente}</strong>
        , que vence{" "}
        {p.diasParaVencer === 0
          ? "no próprio dia"
          : `em ${p.diasParaVencer} dia${p.diasParaVencer > 1 ? "s" : ""}`}{" "}
        — {quantidade(p.quantidadeEmEstoque, p.unidade)} parados, contra{" "}
        {numero(p.porcoesPrevistas)} porções previstas.
      </p>
    </Painel>
  );
}

export function ListaDeCompras({ resumo }: { resumo: ResumoDoDia }) {
  const aComprar = resumo.compras.filter((c) => c.comprar > 0);

  return (
    <Secao
      titulo="Lista de compras"
      descricao="Previsão × ficha técnica − estoque."
      acao={
        <span className="tabular font-display text-2xl font-medium text-marfim">
          {dinheiro(resumo.custoDaCompra)}
        </span>
      }
    >
      {aComprar.length === 0 ? (
        <Vazio>O estoque cobre toda a previsão deste cenário.</Vazio>
      ) : (
        <ul className="tabular">
          {aComprar.map((c) => (
            <li
              key={c.id}
              className="flex items-baseline justify-between gap-3 border-b border-white/[0.07] py-2.5 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-marfim">
                  {c.nome}
                  {c.vencido && (
                    <span className="ml-2 align-middle">
                      <Etiqueta cor="brasa">vencido</Etiqueta>
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[11px] text-marfim/50">
                  usar {quantidade(c.necessario, c.unidade)} · tem{" "}
                  {quantidade(c.emEstoque, c.unidade)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[13px] font-bold text-fogo-300">
                  {quantidade(
                    c.unidade === "un" ? Math.ceil(c.comprar) : c.comprar,
                    c.unidade
                  )}
                </p>
                <p className="mt-0.5 text-[11px] text-marfim/50">
                  {dinheiro(c.custoEstimado)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}

/* ------------------------------------------------------------------ */
/* Trilho: os dias parecidos em resumo e os alertas                    */
/* ------------------------------------------------------------------ */

export function DatasParecidas({ resumo }: { resumo: ResumoDoDia }) {
  return (
    <BlocoDoTrilho
      rotulo="Dias parecidos"
      acao={
        <a
          href="#dias-parecidos"
          className="text-[11px] font-semibold text-fogo-300 transition hover:text-fogo-200"
        >
          ver a tabela
        </a>
      }
    >
      <ul className="flex flex-wrap gap-1.5">
        {resumo.diasParecidos.map((v) => (
          <li
            key={v.registro.data}
            className="vidro-bloco tabular rounded-full px-2.5 py-1 text-[11px] font-semibold text-marfim/78"
          >
            {NOMES_DIAS_CURTOS[v.registro.diaSemana]} {dataCurta(v.registro.data)}
          </li>
        ))}
      </ul>
    </BlocoDoTrilho>
  );
}

const CORES_ALERTA = {
  alto: { pino: "bg-brasa-300", titulo: "text-brasa-300" },
  medio: { pino: "bg-ambar-500", titulo: "text-ambar-300" },
  info: { pino: "bg-nevoa-300", titulo: "text-nevoa-300" },
} as const;

export function Alertas({ resumo }: { resumo: ResumoDoDia }) {
  return (
    <BlocoDoTrilho>
      {/* Cabeçalho à mão, e não via `rotulo`, para ser h2: leitor de tela navega por títulos. */}
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 className="rotulo">Alertas</h2>
        {resumo.alertas.length > 0 && (
          <span className="tabular text-[11px] font-semibold text-marfim/50">
            {resumo.alertas.length}
          </span>
        )}
      </div>
      <p className="text-[12px] leading-relaxed text-marfim/50">
        O que pode dar errado no serviço.
      </p>
      {resumo.alertas.length === 0 ? (
        <p className="mt-2 text-[13px] leading-relaxed text-marfim/65">
          Nada urgente para este cenário.
        </p>
      ) : (
        <ul className="mt-1">
          {resumo.alertas.map((a, i) => {
            const cor = CORES_ALERTA[a.nivel];
            return (
              <li
                key={`${a.titulo}-${i}`}
                className="flex gap-3 border-b border-white/[0.07] py-2.5 last:border-b-0 last:pb-0"
              >
                <span
                  className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${cor.pino}`}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className={`text-[13px] font-bold leading-snug ${cor.titulo}`}>
                    {a.titulo}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-marfim/62">
                    {a.detalhe}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </BlocoDoTrilho>
  );
}

/* ------------------------------------------------------------------ */
/* Raciocínio: os vizinhos que geraram a previsão                      */
/* ------------------------------------------------------------------ */

export function DiasParecidos({ resumo }: { resumo: ResumoDoDia }) {
  // O cabeçalho só gruda a partir de lg, numa linha só; abaixo disso não há o que recuar.
  return (
    <Secao
      id="dias-parecidos"
      className="scroll-mt-4 lg:scroll-mt-28"
      titulo="Dias parecidos usados na previsão"
      descricao="Os vizinhos que o KNN encontrou. A previsão de cada prato é a média destas linhas."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left">
              <th className={`${CABECALHO_TABELA} pr-3`}>Data</th>
              <th className={`${CABECALHO_TABELA} pr-3`}>Dia</th>
              <th className={`${CABECALHO_TABELA} pr-3 text-right`}>Temp.</th>
              <th className={`${CABECALHO_TABELA} pr-3`}>Condições</th>
              <th className={`${CABECALHO_TABELA} pr-3 text-right`}>Dist.</th>
              {PRATOS.map((p) => (
                <th key={p.id} className={`${CABECALHO_TABELA} pr-3 text-right`}>
                  {p.nome.split(" ")[0]}
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
                <td className={`${CELULA} pr-3 text-marfim/70`}>
                  {NOMES_DIAS_CURTOS[v.registro.diaSemana]}
                </td>
                <td className={`${CELULA} pr-3 text-right text-marfim/70`}>
                  {numero(v.registro.temperatura)}°
                </td>
                <td className={`${CELULA} pr-3`}>
                  <span className="flex flex-wrap gap-1">
                    {v.registro.chuva && <Etiqueta cor="nevoa">chuva</Etiqueta>}
                    {v.registro.feriado && <Etiqueta cor="ambar">feriado</Etiqueta>}
                    {v.registro.inicioMes && (
                      <Etiqueta cor="neutro">início do mês</Etiqueta>
                    )}
                    {!v.registro.chuva &&
                      !v.registro.feriado &&
                      !v.registro.inicioMes && (
                        <span className="text-marfim/35">—</span>
                      )}
                  </span>
                </td>
                <td className={`${CELULA} pr-3 text-right text-marfim/50`}>
                  {numero(v.distancia, 3)}
                </td>
                {PRATOS.map((p) => (
                  <td key={p.id} className={`${CELULA} pr-3 text-right text-marfim/70`}>
                    {v.registro.vendas[p.id] ?? 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="pt-3 pr-3 text-xs font-semibold text-marfim/75">
                Média — a previsão
              </td>
              {PRATOS.map((p) => (
                <td
                  key={p.id}
                  className="tabular pt-3 pr-3 text-right text-[13px] font-bold text-fogo-300"
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
    </Secao>
  );
}
