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
      destaque
      titulo="Análise automática do dia"
      descricao="Gerada sozinha assim que o clima e a previsão ficam prontos — sem pergunta, sem chat."
      acao={
        <Etiqueta cor="jadeSuave">
          <svg
            width="13"
            height="13"
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
          IA · gpt-oss
        </Etiqueta>
      }
    >
      {estado.estado === "carregando" && <Carregando />}

      {estado.estado === "ocioso" && (
        <p className="text-sm text-marfim/58">
          Aguardando a previsão do tempo para analisar o dia.
        </p>
      )}

      {estado.estado === "erro" && (
        <div className="vidro-ambar rounded-2xl px-5 py-4 text-sm">
          <p className="font-bold text-ambar-300">
            A análise automática não rodou.
          </p>
          <p className="mt-1 leading-relaxed text-ambar-200/90">
            {estado.mensagem}
          </p>
          {estado.configuracaoAusente && (
            <p className="mt-2 text-xs leading-relaxed text-ambar-200/72">
              O resto do painel — previsão, compras, alertas — continua
              funcionando normalmente. Só o texto da IA depende dessa chave.
            </p>
          )}
          <button
            type="button"
            onClick={aoTentarDeNovo}
            className="mt-4 rounded-xl border border-ambar-500/40 bg-white/5 px-4 py-2 text-xs font-bold text-ambar-300 transition hover:bg-white/10"
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
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <p className="text-sm text-marfim/62">
        A IA está lendo o clima, o histórico e o estoque…
      </p>
      <div className="space-y-2.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-3 animate-pulse rounded-full bg-white/[0.07]"
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
  analise: Extract<EstadoDaAnalise, { estado: "pronto" }>["analise"];
}) {
  return (
    <div className="space-y-5">
      {analise.resumo && (
        <p className="max-w-4xl font-display text-[25px] font-light leading-[1.42] tracking-tight text-marfim">
          {analise.resumo}
        </p>
      )}

      <div className="grid gap-3.5 sm:grid-cols-2">
        {analise.clima && (
          <Bloco titulo="Leitura do clima" texto={analise.clima} />
        )}
        {analise.padrao && (
          <Bloco titulo="O que é comum vender" texto={analise.padrao} />
        )}
      </div>

      {analise.sugestoes.length > 0 && (
        <div>
          <h3 className="rotulo mb-2.5">Sugestões para hoje</h3>
          <ul className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {analise.sugestoes.map((s, i) => (
              <li
                key={`${s.titulo}-${i}`}
                className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"
              >
                <p className="text-[15px] font-bold text-marfim">{s.titulo}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-marfim/84">
                  {s.acao}
                </p>
                {s.porque && (
                  <p className="mt-2 text-xs leading-relaxed text-marfim/56">
                    {s.porque}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {analise.atencao && (
        <div className="vidro-ambar flex items-start gap-3 rounded-2xl px-4 py-3.5">
          <svg
            width="17"
            height="17"
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
          <p className="text-[13px] leading-relaxed text-ambar-200/94">
            <strong className="font-bold text-ambar-300">Atenção:</strong>{" "}
            {analise.atencao}
          </p>
        </div>
      )}

      <p className="border-t border-white/[0.08] pt-4 text-xs leading-relaxed text-marfim/50">
        Texto escrito por um modelo de linguagem a partir dos números do painel.
        Os números vêm do KNN e do histórico simulado; a interpretação é da IA e
        pode conter erro — confira antes de comprar.
      </p>
    </div>
  );
}

function Bloco({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="vidro-bloco rounded-2xl px-[18px] py-4">
      <p className="rotulo">{titulo}</p>
      <p className="mt-2 text-sm leading-relaxed text-marfim/86">{texto}</p>
    </div>
  );
}
