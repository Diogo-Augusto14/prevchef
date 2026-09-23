"use client";

import { useState } from "react";
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, Etiqueta, Secao, Vazio } from "./ui";
import { TOLERANCIA_DE_ATRASO, listarNumeros } from "@/lib/salao";
import { TEMPO_MEDIO_DE_REFEICAO, mesaPorId } from "@/lib/restaurante";
import { duracao } from "@/lib/dados";
import { motivoDaNegativa } from "@/lib/equipe";
import { useOperacao } from "@/lib/operacao";
import {
  apenasDigitos,
  cpfMascarado,
  cpfValido,
  formatarCpf,
  formatarTelefone,
  telefoneValido,
} from "@/lib/documento";
import type { Mesa, Reserva } from "@/lib/tipos";

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

/** Dia no fuso local como número (20260923), para comparar datas. */
const diaLocal = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

export default function Reservas({
  reservas,
  agora,
  aoReservar,
  aoCancelar,
  aoChegar,
}: {
  reservas: Reserva[];
  agora: Date;
  aoReservar: (dados: {
    nome: string;
    pessoas: number;
    para: string;
    cpf: string;
    telefone: string;
    observacao?: string;
  }) => void;
  aoCancelar: (id: string) => void;
  aoChegar: (id: string) => void;
}) {
  const [nome, setNome] = useState("");
  const [pessoas, setPessoas] = useState(2);
  const [horario, setHorario] = useState("20:00");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [observacao, setObservacao] = useState("");

  const { operador, autorizado, ocupacoes } = useOperacao();
  const podeSalao = autorizado("gerenciarSalao");

  // A reserva só é aceita com identificação conferida: sem isso qualquer
  // nome segura mesa e some na hora do movimento.
  const cpfOk = cpfValido(cpf);
  const cpfErrado = cpf.length === 11 && !cpfOk;
  const telefoneOk = telefoneValido(telefone);
  const podeMarcar =
    podeSalao &&
    Boolean(nome.trim()) &&
    cpfOk &&
    telefoneOk &&
    /^\d{2}:\d{2}/.test(horario);

  // Reserva de dia anterior, já vencida, sai da lista: não segura mais mesa.
  const hoje = diaLocal(agora);
  const ordenadas = [...reservas]
    .filter(
      (r) =>
        diaLocal(new Date(r.para)) >= hoje ||
        new Date(r.para).getTime() >= agora.getTime() - TOLERANCIA_DE_ATRASO * 60000
    )
    .sort((a, b) => a.para.localeCompare(b.para));

  return (
    <Secao
      titulo="Reservas"
      descricao={`A mesa marcada fica guardada a partir de ${TEMPO_MEDIO_DE_REFEICAO} min antes e é devolvida ${TOLERANCIA_DE_ATRASO} min depois do horário, se não aparecerem.`}
      acao={
        ordenadas.length > 0 ? (
          <span className="text-[13px] text-marfim/62">
            {ordenadas.length} marcada{ordenadas.length > 1 ? "s" : ""}
          </span>
        ) : undefined
      }
    >
      {!podeSalao && (
        <p className="vidro-ambar mb-4 rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed text-ambar-200">
          {motivoDaNegativa(operador, "gerenciarSalao")}
        </p>
      )}
      <form
        className="grid gap-x-2.5 gap-y-3 border-b border-white/[0.07] pb-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!podeMarcar) return;
          aoReservar({
            nome,
            pessoas,
            para: proximoHorario(horario, agora),
            cpf: apenasDigitos(cpf),
            telefone: apenasDigitos(telefone),
            observacao,
          });
          setNome("");
          setPessoas(2);
          setCpf("");
          setTelefone("");
          setObservacao("");
        }}
      >
        <div className="min-w-0 sm:col-span-2">
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
        <div className="min-w-0">
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
            className="campo tabular mt-1.5 !py-2 !text-[13px]"
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="hora-reserva" className="rotulo">
            Horário
          </label>
          <input
            id="hora-reserva"
            type="time"
            value={horario}
            onChange={(e) => setHorario(e.target.value)}
            className="campo tabular mt-1.5 !py-2 !text-[13px]"
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="cpf-reserva" className="rotulo">
            CPF
          </label>
          <input
            id="cpf-reserva"
            inputMode="numeric"
            value={formatarCpf(cpf)}
            onChange={(e) => setCpf(apenasDigitos(e.target.value))}
            placeholder="000.000.000-00"
            aria-invalid={cpfErrado}
            aria-describedby={cpfErrado ? "cpf-reserva-erro" : undefined}
            className={`campo tabular mt-1.5 !py-2 !text-[13px] ${
              cpfErrado ? "!border-brasa-300/60" : ""
            }`}
          />
          {cpfErrado && (
            <p id="cpf-reserva-erro" className="mt-1 text-[11px] text-brasa-300">
              Dígito verificador não fecha.
            </p>
          )}
        </div>

        <div className="min-w-0">
          <label htmlFor="tel-reserva" className="rotulo">
            Telefone
          </label>
          <input
            id="tel-reserva"
            inputMode="numeric"
            value={formatarTelefone(telefone)}
            onChange={(e) => setTelefone(apenasDigitos(e.target.value, 11))}
            placeholder="(00) 00000-0000"
            aria-describedby={
              telefone.length > 0 && !telefoneOk ? "tel-reserva-dica" : undefined
            }
            className="campo tabular mt-1.5 !py-2 !text-[13px]"
          />
          {telefone.length > 0 && !telefoneOk && (
            <p id="tel-reserva-dica" className="mt-1 text-[11px] text-marfim/55">
              Com DDD: 10 ou 11 dígitos.
            </p>
          )}
        </div>

        <div className="min-w-0 sm:col-span-2">
          <label htmlFor="obs-reserva" className="rotulo">
            Observação
          </label>
          <div className="mt-1.5 flex items-center gap-2.5">
            <input
              id="obs-reserva"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="opcional"
              className="campo min-w-0 !py-2 !text-[13px]"
            />
            <button
              type="submit"
              disabled={!podeMarcar}
              className={BOTAO_SECUNDARIO + " shrink-0 px-3.5 py-2 text-[13px]"}
            >
              Marcar
            </button>
          </div>
        </div>
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
            const mesas = r.mesaIds
              .map((id) => mesaPorId(id))
              .filter((m): m is Mesa => Boolean(m));
            const chegando = emMinutos <= TEMPO_MEDIO_DE_REFEICAO && emMinutos > 0;
            const atrasada = emMinutos <= 0;
            const amanha = diaLocal(new Date(r.para)) > hoje;
            const podeSentar =
              emMinutos <= 15 && emMinutos >= -TOLERANCIA_DE_ATRASO && mesas.length > 0;
            // Sentar a reserva por cima de quem está comendo tiraria esse grupo da mesa.
            const ocupadas = mesas.filter((m) => ocupacoes.some((o) => o.mesaId === m.id));

            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/[0.07] py-3 last:border-b-0"
              >
                <span
                  className={`tabular w-14 shrink-0 font-display text-lg font-medium ${
                    atrasada ? "text-brasa-300" : chegando ? "text-ambar-200" : "text-marfim"
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
                    {r.cpf ? cpfMascarado(r.cpf) : "sem CPF"}
                    {r.telefone && ` · ${formatarTelefone(r.telefone)}`}
                  </p>
                  <p className="tabular mt-0.5 text-[11px] text-marfim/50">
                    {mesas.length
                      ? `${mesas.length > 1 ? "mesas" : "mesa"} ${listarNumeros(mesas)}`
                      : "sem mesa disponível nesse horário"}
                    {atrasada
                      ? ` · ${duracao(Math.abs(emMinutos))} de atraso`
                      : ` · ${amanha ? "amanhã, " : ""}em ${duracao(emMinutos)}`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {atrasada && Math.abs(emMinutos) > TOLERANCIA_DE_ATRASO && (
                    <Etiqueta cor="brasa">mesa devolvida</Etiqueta>
                  )}
                  {chegando && ocupadas.length === 0 && (
                    <Etiqueta cor="ambar">mesa guardada</Etiqueta>
                  )}
                  {(chegando || podeSentar) && ocupadas.length > 0 && (
                    <Etiqueta cor="ambar">
                      {`${ocupadas.length > 1 ? "mesas" : "mesa"} ${listarNumeros(ocupadas)} ocupada${
                        ocupadas.length > 1 ? "s" : ""
                      }`}
                    </Etiqueta>
                  )}
                  {podeSentar && ocupadas.length === 0 && (
                    <button
                      type="button"
                      onClick={() => aoChegar(r.id)}
                      disabled={!podeSalao}
                      className={BOTAO_PRIMARIO + " px-3 py-1.5 text-[11px]"}
                    >
                      Chegaram
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => aoCancelar(r.id)}
                    disabled={!podeSalao}
                    aria-label={`Cancelar a reserva de ${r.nome}`}
                    className="rounded-lg border border-white/12 px-2 py-1.5 text-[11px] font-semibold text-marfim/60 transition enabled:hover:border-brasa-300/50 enabled:hover:text-brasa-300 disabled:cursor-not-allowed disabled:opacity-35"
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
