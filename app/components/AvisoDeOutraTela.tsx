"use client";

import { useOperacao, type MudancaDeFora } from "@/lib/operacao";

/**
 * Quando outra tela (outra aba, outro aparelho) muda o serviço, esta se
 * atualiza sozinha — e avisa, para ninguém achar que a mesa sumiu por
 * mágica. Se alguma ação feita aqui não coube mais depois da mudança (as
 * duas sentaram gente na mesma mesa, por exemplo), o aviso diz qual e fica
 * até alguém fechar.
 *
 * Flutua no canto em vez de entrar no cabeçalho: aparecer e sumir lá dentro
 * empurraria a página inteira.
 */
export default function AvisoDeOutraTela() {
  const { deFora, dispensarAviso } = useOperacao();

  return (
    // A região existe sempre: leitor de tela só anuncia o que muda dentro dela.
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-30 flex justify-center sm:inset-x-auto sm:right-6 sm:justify-end"
    >
      {deFora && <Aviso {...deFora} aoFechar={dispensarAviso} />}
    </div>
  );
}

function Aviso({
  rotulo,
  quem,
  descartadas,
  aoFechar,
}: MudancaDeFora & { aoFechar: () => void }) {
  const naoEntrou = descartadas.length > 0;

  return (
    // O cartão pega o toque: tocar nele para tirá-lo da frente não pode
    // acertar o botão que está escondido embaixo.
    <div
      className={`pointer-events-auto flex max-w-[420px] items-start gap-3 rounded-2xl border bg-tinta-2/95 px-4 py-3 text-[13px] leading-snug shadow-[0_18px_40px_-18px_rgba(0,0,0,0.9)] backdrop-blur-xl ${
        naoEntrou ? "border-ambar-500/45" : "border-nevoa-500/35"
      }`}
    >
      <p className="min-w-0 flex-1">
        <span
          className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] ${
            naoEntrou ? "text-ambar-300" : "text-nevoa-300"
          }`}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
            <path d="M3 21v-5h5" />
            <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
          {naoEntrou ? "Outra tela mexeu antes" : "Atualizado por outra tela"}
        </span>
        <span className="mt-1 block text-marfim/80">
          {naoEntrou
            ? `Não entrou: ${descartadas.join("; ")}. Confira e refaça se ainda fizer sentido.`
            : rotulo
              ? `${quem ? `${quem}: ` : ""}${rotulo}.`
              : "O serviço desta tela já está em dia."}
        </span>
      </p>
      <button
        type="button"
        onClick={aoFechar}
        className={
          naoEntrou
            ? "shrink-0 self-center rounded-lg border border-ambar-500/40 px-2.5 py-1 text-[12px] font-semibold text-ambar-200 transition hover:border-ambar-500/70"
            : "-mr-1 shrink-0 rounded-lg px-1.5 text-lg leading-none text-marfim/50 transition hover:text-marfim"
        }
        aria-label={naoEntrou ? undefined : "Fechar aviso"}
      >
        {naoEntrou ? "Entendi" : "×"}
      </button>
    </div>
  );
}
