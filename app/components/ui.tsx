import type { ReactNode } from "react";

export function Cartao({
  titulo,
  descricao,
  acao,
  children,
  className = "",
}: {
  titulo?: string;
  descricao?: string;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {(titulo || acao) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {titulo && (
              <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
            )}
            {descricao && (
              <p className="mt-0.5 text-sm text-slate-500">{descricao}</p>
            )}
          </div>
          {acao}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

const CORES_ETIQUETA = {
  neutro: "bg-slate-100 text-slate-700 ring-slate-200",
  verde: "bg-marca-50 text-marca-900 ring-marca-100",
  ambar: "bg-amber-50 text-amber-800 ring-amber-200",
  vermelho: "bg-red-50 text-red-700 ring-red-200",
  azul: "bg-sky-50 text-sky-800 ring-sky-200",
} as const;

export function Etiqueta({
  cor = "neutro",
  children,
}: {
  cor?: keyof typeof CORES_ETIQUETA;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${CORES_ETIQUETA[cor]}`}
    >
      {children}
    </span>
  );
}

/** Aviso fixo de que nada aqui vem de um restaurante de verdade. */
export function AvisoSimulado({ className = "" }: { className?: string }) {
  return (
    <p
      className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 ${className}`}
    >
      <strong className="font-semibold">Dados simulados.</strong> O histórico de
      vendas, o estoque e as fichas técnicas foram gerados por um script de
      exemplo (<code className="font-mono">scripts/gerar-dados.mjs</code>) e não
      vêm de um restaurante real. Só duas coisas são reais: a{" "}
      <strong className="font-semibold">previsão do tempo</strong> (Open-Meteo) e
      a <strong className="font-semibold">análise escrita pela IA</strong>.
    </p>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
      {children}
    </p>
  );
}
