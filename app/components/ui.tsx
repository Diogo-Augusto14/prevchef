import type { ReactNode } from "react";

export function Cartao({
  titulo,
  descricao,
  acao,
  children,
  className = "",
  destaque = false,
}: {
  titulo?: string;
  descricao?: string;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Véu de jade — no máximo um por tela. */
  destaque?: boolean;
}) {
  return (
    <section
      className={`rounded-3xl ${destaque ? "vidro-jade" : "vidro"} ${className}`}
    >
      {(titulo || acao) && (
        <header className="flex flex-wrap items-start justify-between gap-4 px-6 pb-4 pt-6">
          <div>
            {titulo && (
              <h2 className="font-display text-[22px] font-normal text-marfim">
                {titulo}
              </h2>
            )}
            {descricao && (
              <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-marfim/58">
                {descricao}
              </p>
            )}
          </div>
          {acao}
        </header>
      )}
      <div className={titulo || acao ? "px-6 pb-6" : "p-6"}>{children}</div>
    </section>
  );
}

const CORES_ETIQUETA = {
  neutro: "bg-white/[0.07] text-marfim/78 ring-white/12",
  jade: "bg-jade-400 text-tinta ring-transparent font-bold",
  jadeSuave: "bg-jade-400/12 text-jade-300 ring-jade-400/32",
  ambar: "bg-ambar-500/15 text-ambar-300 ring-ambar-500/34",
  nevoa: "bg-[rgba(86,150,200,0.16)] text-nevoa-300 ring-[rgba(120,180,225,0.34)]",
  brasa: "bg-brasa-300/14 text-brasa-300 ring-brasa-300/32",
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
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${CORES_ETIQUETA[cor]}`}
    >
      {children}
    </span>
  );
}

/** Aviso fixo de que o histórico não vem de um restaurante de verdade. */
export function AvisoSimulado({ className = "" }: { className?: string }) {
  return (
    <div
      className={`vidro-ambar flex items-start gap-3 rounded-2xl px-[18px] py-3.5 ${className}`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        aria-hidden
        className="mt-0.5 shrink-0 text-ambar-500"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8h.01M12 11v5" />
      </svg>
      <p className="text-[13px] leading-relaxed text-ambar-200/92">
        <strong className="font-bold text-ambar-300">Dados simulados.</strong> O
        histórico de vendas, o estoque e as fichas técnicas foram gerados por um
        script de exemplo (
        <code className="font-mono text-ambar-300/90">scripts/gerar-dados.mjs</code>
        ) e não vêm de um restaurante real. Só duas coisas são reais: a{" "}
        <strong className="font-semibold">previsão do tempo</strong> (Open-Meteo)
        e a <strong className="font-semibold">análise escrita pela IA</strong>.
      </p>
    </div>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-white/13 px-5 py-9 text-center text-sm leading-relaxed text-marfim/58">
      {children}
    </p>
  );
}

/** Cartão de número, usado nas faixas de resumo das três telas. */
export function Indicador({
  rotulo,
  valor,
  detalhe,
  destaque = false,
  tom = "jade",
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe: ReactNode;
  destaque?: boolean;
  tom?: "jade" | "ambar";
}) {
  const jade = tom === "jade";
  return (
    <div
      className={`rounded-[20px] px-[22px] py-5 ${
        destaque
          ? jade
            ? "vidro-jade"
            : "vidro-ambar"
          : "vidro"
      }`}
    >
      <p
        className={`text-[11px] font-bold uppercase tracking-[0.08em] ${
          destaque
            ? jade
              ? "text-jade-300/78"
              : "text-ambar-300/82"
            : "text-marfim/52"
        }`}
      >
        {rotulo}
      </p>
      <p
        className={`tabular mt-2.5 font-display text-[32px] font-light leading-tight tracking-tight ${
          destaque ? (jade ? "text-jade-100" : "text-ambar-200") : "text-marfim"
        }`}
      >
        {valor}
      </p>
      <p
        className={`tabular mt-1 text-[13px] leading-snug ${
          destaque
            ? jade
              ? "text-jade-200/82"
              : "text-ambar-200/82"
            : "text-marfim/62"
        }`}
      >
        {detalhe}
      </p>
    </div>
  );
}

/** Cabeçalho padrão das três telas. */
export function TituloDaTela({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-[44px] font-light leading-[1.05] tracking-tight text-marfim">
          {titulo}
        </h1>
        <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed text-marfim/68">
          {children}
        </p>
      </div>
      <AvisoSimulado />
    </div>
  );
}

/* Estilos de tabela reaproveitados nas três telas. */
export const CABECALHO_TABELA =
  "border-b border-white/10 pb-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-marfim/50";
export const CELULA = "py-3.5 border-b border-white/[0.06]";
