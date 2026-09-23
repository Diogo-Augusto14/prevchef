"use client";

import { useState } from "react";
import { Etiqueta, Secao, Vazio } from "./ui";
import { TOLERANCIA_DE_ATRASO } from "@/lib/salao";
import { mesaPorId } from "@/lib/restaurante";
import type { Reserva } from "@/lib/tipos";

/** Monta o ISO da próxima vez que der esse horário: hoje, ou amanhã se já passou. */
function proximoHorario(hhmm: string, agora: Date): string {
  const [hora, minuto] = hhmm.split(":").map(Number);
  const alvo = new Date(agora);
  alvo.setHours(hora, minuto, 0, 0);

  if (alvo.getTime() < agora.getTime() - 60_000) {
    alvo.setDate(alvo.getDate() + 1);
  }
  return alvo.toISOString();
}

const relogio = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function Reservas({
  reservas,
  agora,
  aoReservar,
  aoCancelar,
  aoChegar,
}: {
  reservas: Reserva[];
  agora: Date;
  aoReservar: (nome: string, pessoas: number, para: string, obs?: string) => void;
  aoCancelar: (id: string) => void;
  aoChegar: (id: string) => void;
}) {
  const [nome, setNome] = useState("");
  const [pessoas, setPessoas] = useState(2);
  const [horario, setHorario] = useState("20:00");
  const [observacao, setObservacao] = useState("");

  const ordenadas = [...reservas].sort((a, b) => a.para.localeCompare(b.para));

  return (
    <Secao
      titulo="Reservas"
      descricao={`A mesa marcada fica guardada a partir de uma hora antes e é devolvida ${TOLERANCIA_DE_ATRASO} min depois do horário, se não aparecerem.`}
      acao={
        ordenadas.length > 0 ? (
          <span className="text-[13px] text-marfim/62">
            {ordenadas.length} marcada{ordenadas.length > 1 ? "s" : ""}
          </span>
        ) : undefined
      }
    >
      <form
        className="flex flex-wrap items-end gap-2.5 border-b border-white/[0.06] pb-4"
        onSubmit={(e) => {
          e.preventDefault();
          aoReservar(nome, pessoas, proximoHorario(horario, agora), observacao);
          setNome("");
          setPessoas(2);
          setObservacao("");
        }}
      >
        <div className="min-w-0 flex-1 basis-40">
          <label htmlFor="nome-reserva" className="rotulo">
            Nome
          </label>
          <input
            id="nome-reserva"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Em nome de quem"
            className="campo mt-1.5 !py-2 !text-[13px]"
          />
        </div>
        <div>
          <label htmlFor="pessoas-reserva" className="rotulo">
            Pessoas
          </label>
          <input
            id="pessoas-reserva"
            type="number"
            min={1}
            max={20}
            value={pessoas}
            onChange={(e) => setPessoas(Number(e.target.value))}
            className="campo tabular mt-1.5 !w-20 !py-2 !text-[13px]"
          />
        </div>
        <div>
          <label htmlFor="hora-reserva" className="rotulo">
            Horário
          </label>
          <input
            id="hora-reserva"
            type="time"
            value={horario}
            onChange={(e) => setHorario(e.target.value)}
            className="campo tabular mt-1.5 !w-28 !py-2 !text-[13px]"
          />
        </div>
        <div className="min-w-0 flex-1 basis-32">
          <label htmlFor="obs-reserva" className="rotulo">
            Observação
          </label>
          <input
            id="obs-reserva"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="opcional"
            className="campo mt-1.5 !py-2 !text-[13px]"
          />
        </div>
        <button
          type="submit"
          disabled={!nome.trim()}
          className="rounded-xl border border-white/12 px-3.5 py-2 text-[13px] font-semibold text-marfim/85 transition hover:border-jade-400/50 hover:text-jade-200 disabled:cursor-not-allowed disabled:opacity-35"
        >
          Marcar
        </button>
      </form>

      {ordenadas.length === 0 ? (
        <div className="pt-4">
          <Vazio>Nenhuma reserva marcada.</Vazio>
        </div>
      ) : (
        <ul className="pt-1">
          {ordenadas.map((r) => {
            const emMinutos = Math.round(
              (new Date(r.para).getTime() - agora.getTime()) / 60000
            );
            const mesa = r.mesaId ? mesaPorId(r.mesaId) : null;
            const chegando = emMinutos <= 60 && emMinutos > 0;
            const atrasada = emMinutos <= 0;
            const podeSentar = emMinutos <= 15 && Boolean(mesa);

            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/[0.06] py-3 last:border-b-0"
              >
                <span
                  className={`tabular w-14 shrink-0 font-display text-lg ${
                    atrasada ? "text-ambar-200" : chegando ? "text-jade-200" : "text-marfim"
                  }`}
                >
                  {relogio(r.para)}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-marfim">
                    {r.nome}
                    <span className="ml-2 font-normal text-marfim/55">
                      {r.pessoas} pessoa{r.pessoas > 1 ? "s" : ""}
                    </span>
                    {r.observacao && (
                      <span className="ml-2 font-normal text-marfim/45">
                        · {r.observacao}
                      </span>
                    )}
                  </p>
                  <p className="tabular mt-0.5 text-[11px] text-marfim/50">
                    {mesa ? `mesa ${mesa.numero}` : "sem mesa disponível nesse horário"}
                    {atrasada
                      ? ` · ${Math.abs(emMinutos)} min de atraso`
                      : ` · em ${emMinutos} min`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {atrasada && Math.abs(emMinutos) > TOLERANCIA_DE_ATRASO && (
                    <Etiqueta cor="brasa">mesa devolvida</Etiqueta>
                  )}
                  {chegando && <Etiqueta cor="jadeSuave">mesa guardada</Etiqueta>}

                  {podeSentar && (
                    <button
                      type="button"
                      onClick={() => aoChegar(r.id)}
                      className="rounded-lg bg-gradient-to-b from-jade-400 to-jade-500 px-3 py-1.5 text-[11px] font-bold text-tinta"
                    >
                      Chegaram
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => aoCancelar(r.id)}
                    aria-label={`Cancelar a reserva de ${r.nome}`}
                    className="rounded-lg border border-white/12 px-2 py-1.5 text-[11px] font-semibold text-marfim/60 transition hover:border-brasa-300/50 hover:text-brasa-300"
                  >
                    Cancelar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Secao>
  );
}
