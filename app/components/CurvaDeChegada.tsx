"use client";

import { Etiqueta, Secao } from "./ui";
import type { PrevisaoDeChegada } from "@/lib/chegadas";
import { K_PADRAO } from "@/lib/knn";

/**
 * Quantas pessoas chegam em cada hora. A barra clara é a faixa entre o
 * mínimo e o máximo dos dias parecidos; a barra cheia é a média — a mesma
 * lógica das previsões de prato, porque vem dos mesmos vizinhos.
 */
export default function CurvaDeChegada({
  chegadas,
  horaAtual,
}: {
  chegadas: PrevisaoDeChegada;
  /** Destaca a hora corrente quando o serviço está aberto. */
  horaAtual?: number | null;
}) {
  if (chegadas.horas.length === 0) return null;

  const teto = Math.max(...chegadas.horas.map((h) => h.maximo), 1);
  const mostraAgora = chegadas.horas.some((h) => h.hora === horaAtual);

  return (
    <Secao
      titulo="Chegada por horário"
      descricao={`Previsão de pessoas por hora, tirada dos mesmos ${K_PADRAO} dias parecidos que o KNN usou para os pratos.`}
      className="flex flex-col"
      classeDoMiolo="flex flex-1 flex-col"
      acao={
        chegadas.pico ? (
          <span className="text-[13px] text-marfim/62">
            Pico às{" "}
            <strong className="font-semibold text-fogo-300">
              {chegadas.pico.rotulo}
            </strong>{" "}
            · {chegadas.totalDePessoas} pessoas no dia
          </span>
        ) : undefined
      }
    >
      <div className="flex flex-1 items-stretch gap-1.5">
        {chegadas.horas.map((h) => {
          const ehPico = chegadas.pico?.hora === h.hora;
          const agora = horaAtual === h.hora;

          return (
            <div key={h.hora} className="flex min-w-0 flex-1 flex-col items-center">
              {/* Trilho com a faixa mínimo–máximo e a média por cima. */}
              <div className="relative min-h-32 w-full flex-1">
                <div
                  className="absolute bottom-0 w-full rounded-t bg-white/[0.06]"
                  style={{ height: `${(h.maximo / teto) * 100}%` }}
                />
                <div
                  className="absolute bottom-0 w-full rounded-t bg-white/[0.04]"
                  style={{ height: `${(h.minimo / teto) * 100}%` }}
                />
                <div
                  className={`absolute bottom-0 w-full rounded-t ${
                    ehPico ? "bg-fogo-500" : agora ? "bg-nevoa-500/70" : "bg-fogo-500/35"
                  }`}
                  style={{ height: `${Math.max((h.pessoas / teto) * 100, 1.5)}%` }}
                />
              </div>

              <span
                className={`tabular mt-2 text-[11px] font-semibold ${
                  ehPico ? "text-fogo-300" : "text-marfim/70"
                }`}
              >
                {h.pessoas}
              </span>
              <span
                className={`mt-0.5 text-[10px] ${
                  agora ? "text-nevoa-300" : "text-marfim/55"
                }`}
              >
                {h.hora}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.07] pt-3 text-[11px] text-marfim/50">
        <span className="flex items-center gap-2">
          <span className="h-2 w-4 rounded-sm bg-fogo-500/35" />
          média dos dias parecidos
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-4 rounded-sm bg-white/[0.06] ring-1 ring-inset ring-white/10" />
          faixa entre o menor e o maior
        </span>
        {mostraAgora && (
          <span className="flex items-center gap-2">
            <span className="h-2 w-4 rounded-sm bg-nevoa-500/70" />
            hora atual
          </span>
        )}
        {chegadas.pico && (
          <span className="ml-auto">
            <Etiqueta cor="fogoSuave">
              <span className="h-1.5 w-1.5 rounded-full bg-fogo-500" aria-hidden />
              maior movimento às {chegadas.pico.rotulo}
            </Etiqueta>
          </span>
        )}
      </div>
    </Secao>
  );
}
