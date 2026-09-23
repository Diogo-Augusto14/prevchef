"use client";

import type { EstadoDaAnalise } from "@/lib/analise";
import { Etiqueta, Secao } from "./ui";

/**
 * A análise vem partida em dois: a frase de leitura entra na faixa do topo,
 * junto do clima, e o detalhe fica na coluna do raciocínio. Assim o resumo
 * não aparece duas vezes.
 */

export function ResumoDaIA({ estado }: { estado: EstadoDaAnalise }) {
  if (estado.estado === "carregando" || estado.estado === "ocioso") {
    return (
      <p className="flex items-center gap-3 text-sm text-marfim/50" aria-live="polite">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-jade-400" />
        A IA está lendo o clima, o histórico e o estoque…
      </p>
    );
  }

  if (estado.estado === "erro") {
    return (
      <p className="text-sm leading-relaxed text-ambar-300/90">
        A leitura automática não rodou: {estado.mensagem}
      </p>
    );
  }

  return (
    <p className="max-w-4xl font-display text-[22px] font-light leading-[1.45] tracking-tight text-marfim">
      {estado.analise.resumo}
    </p>
  );
}

export function DetalheDaIA({
  estado,
  aoTentarDeNovo,
}: {
  estado: EstadoDaAnalise;
  aoTentarDeNovo: () => void;
}) {
  return (
    <Secao
      titulo="Leitura da IA"
      descricao="Gerada sozinha assim que o clima e a previsão ficam prontos — sem pergunta, sem chat."
      acao={
        <Etiqueta cor="jadeSuave">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7Z" />
          </svg>
          gpt-oss
        </Etiqueta>
      }
    >
      {estado.estado === "carregando" && <Esqueleto />}

      {estado.estado === "ocioso" && (
        <p className="text-sm text-marfim/55">
          Aguardando a previsão do tempo para analisar o dia.
        </p>
      )}

      {estado.estado === "erro" && (
        <div className="text-sm">
          <p className="leading-relaxed text-ambar-200/90">{estado.mensagem}</p>
          {estado.configuracaoAusente && (
            <p className="mt-1.5 text-xs leading-relaxed text-marfim/55">
              O resto do painel — previsão, compras, alertas — continua
              funcionando. Só este texto depende da chave.
            </p>
          )}
          <button
            type="button"
            onClick={aoTentarDeNovo}
            className="mt-3 rounded-lg border border-ambar-500/40 px-3 py-1.5 text-xs font-bold text-ambar-300 transition hover:bg-white/5"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {estado.estado === "pronto" && <Conteudo analise={estado.analise} />}
    </Secao>
  );
}

function Esqueleto() {
  return (
    <div className="space-y-2.5" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-3 animate-pulse rounded-full bg-white/[0.06]"
          style={{ width: `${100 - i * 16}%` }}
        />
      ))}
    </div>
  );
}

function Conteudo({
  analise,
}: {
  analise: Extract<EstadoDaAnalise, { estado: "pronto" }>["analise"];
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {analise.clima && (
          <div>
            <p className="rotulo">Leitura do clima</p>
            <p className="mt-1.5 text-sm leading-relaxed text-marfim/84">
              {analise.clima}
            </p>
          </div>
        )}
        {analise.padrao && (
          <div className="sm:border-l sm:border-white/10 sm:pl-8">
            <p className="rotulo">O que é comum vender</p>
            <p className="mt-1.5 text-sm leading-relaxed text-marfim/84">
              {analise.padrao}
            </p>
          </div>
        )}
      </div>

      {analise.sugestoes.length > 0 && (
        <ol className="border-t border-white/10 pt-1">
          {analise.sugestoes.map((s, i) => (
            <li
              key={`${s.titulo}-${i}`}
              className="flex gap-4 border-b border-white/[0.06] py-3 last:border-b-0"
            >
              <span className="tabular mt-0.5 shrink-0 font-display text-sm text-jade-400/70">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="text-sm font-bold text-marfim">{s.titulo}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-marfim/80">
                  {s.acao}
                </p>
                {s.porque && (
                  <p className="mt-1 text-xs leading-relaxed text-marfim/52">
                    {s.porque}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {analise.atencao && (
        <p className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ambar-200/92">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden
            className="mt-0.5 shrink-0 text-ambar-500"
          >
            <path d="M12 4l9 16H3Z" />
            <path d="M12 10v4M12 17h.01" />
          </svg>
          <span>
            <strong className="font-bold text-ambar-300">Atenção:</strong>{" "}
            {analise.atencao}
          </span>
        </p>
      )}

      <p className="text-xs leading-relaxed text-marfim/45">
        Texto escrito por um modelo de linguagem a partir dos números do painel.
        Os números vêm do modelo de previsão; a interpretação é da IA e pode
        conter erro — confira antes de comprar.
      </p>
    </div>
  );
}
