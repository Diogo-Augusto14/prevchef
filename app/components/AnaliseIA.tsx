"use client";

import type { EstadoDaAnalise } from "@/lib/analise";
import { Cartao, Etiqueta } from "./ui";

export default function AnaliseIA({
  estado,
  aoTentarDeNovo,
}: {
  estado: EstadoDaAnalise;
  aoTentarDeNovo: () => void;
}) {
  return (
    <Cartao
      titulo="Análise automática do dia"
      descricao="Gerada sozinha pela IA assim que o clima e a previsão ficam prontos — sem pergunta, sem chat."
      acao={<Etiqueta cor="azul">IA · gpt-oss</Etiqueta>}
    >
      {estado.estado === "carregando" && <Carregando />}

      {estado.estado === "ocioso" && (
        <p className="text-sm text-slate-500">
          Aguardando a previsão do tempo para analisar o dia.
        </p>
      )}

      {estado.estado === "erro" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">A análise automática não rodou.</p>
          <p className="mt-1">{estado.mensagem}</p>
          {estado.configuracaoAusente && (
            <p className="mt-2 text-xs">
              O resto do painel (previsão, compras, alertas) continua
              funcionando normalmente — só o texto da IA depende dessa chave.
            </p>
          )}
          <button
            type="button"
            onClick={aoTentarDeNovo}
            className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {estado.estado === "pronto" && <Resultado analise={estado.analise} />}
    </Cartao>
  );
}

function Carregando() {
  return (
    <div className="space-y-3" aria-live="polite" aria-busy="true">
      <p className="text-sm text-slate-500">
        A IA está lendo o clima, o histórico e o estoque…
      </p>
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-3 animate-pulse rounded bg-slate-100"
            style={{ width: `${100 - i * 18}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function Resultado({
  analise,
}: {
  analise: NonNullable<Extract<EstadoDaAnalise, { estado: "pronto" }>["analise"]>;
}) {
  return (
    <div className="space-y-4">
      {analise.resumo && (
        <p className="text-base leading-relaxed text-slate-800">{analise.resumo}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {analise.clima && (
          <Bloco titulo="Leitura do clima" texto={analise.clima} />
        )}
        {analise.padrao && (
          <Bloco titulo="O que é comum vender" texto={analise.padrao} />
        )}
      </div>

      {analise.sugestoes.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sugestões para hoje
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {analise.sugestoes.map((s, i) => (
              <li
                key={`${s.titulo}-${i}`}
                className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
              >
                <p className="text-sm font-semibold text-slate-900">{s.titulo}</p>
                <p className="mt-1 text-sm text-slate-700">{s.acao}</p>
                {s.porque && (
                  <p className="mt-1 text-xs text-slate-500">{s.porque}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {analise.atencao && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <strong className="font-semibold">Atenção:</strong> {analise.atencao}
        </div>
      )}

      <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">
        Texto gerado por um modelo de linguagem a partir dos números do painel.
        Os números vêm do KNN e do histórico simulado; a interpretação é da IA e
        pode conter erro — confira antes de comprar.
      </p>
    </div>
  );
}

function Bloco({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {titulo}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-slate-700">{texto}</p>
    </div>
  );
}
