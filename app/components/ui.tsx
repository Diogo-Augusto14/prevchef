import type { ReactNode } from "react";

/*
 * Três níveis de superfície. A regra: a maioria do conteúdo fica no nível 1,
 * assentado direto no fundo. Só o que precisa flutuar vira vidro, e há um
 * único herói por tela. Quando tudo é cartão, nada é hierarquia.
 */

/** Nível 3 — o herói. Um por tela. */
export function Heroi({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`vidro-jade overflow-hidden rounded-[28px] ${className}`}
    >
      {children}
    </section>
  );
}

/** Nível 2 — painel de vidro. */
export function Painel({
  titulo,
  descricao,
  acao,
  children,
  className = "",
  /** Deixa o conteúdo encostar na borda (gráfico sangrando). */
  semRespiro = false,
}: {
  titulo?: string;
  descricao?: string;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
  semRespiro?: boolean;
}) {
  return (
    <section className={`vidro overflow-hidden rounded-3xl ${className}`}>
      {(titulo || acao) && (
        <header className="flex flex-wrap items-start justify-between gap-4 px-5 pb-3 pt-5">
          <div>
            {titulo && (
              <h2 className="font-display text-lg font-normal text-marfim">
                {titulo}
              </h2>
            )}
            {descricao && (
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-marfim/55">
                {descricao}
              </p>
            )}
          </div>
          {acao}
        </header>
      )}
      <div className={semRespiro ? "" : titulo || acao ? "px-5 pb-5" : "p-5"}>
        {children}
      </div>
    </section>
  );
}

/** Nível 1 — assentado no fundo. Só tipografia e um filete. */
export function Secao({
  titulo,
  descricao,
  acao,
  children,
  className = "",
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-2.5">
        <div>
          <h2 className="font-display text-lg font-normal text-marfim">
            {titulo}
          </h2>
          {descricao && (
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-marfim/55">
              {descricao}
            </p>
          )}
        </div>
        {acao}
      </header>
      <div className="pt-4">{children}</div>
    </section>
  );
}

/**
 * Números em linha, separados por filete — substitui a fileira de cartões
 * idênticos, que é a assinatura de painel gerado automaticamente.
 */
export function LinhaDeNumeros({
  itens,
  className = "",
}: {
  itens: { rotulo: string; valor: ReactNode; detalhe?: ReactNode; forte?: boolean }[];
  className?: string;
}) {
  return (
    <dl className={`flex flex-wrap items-stretch ${className}`}>
      {itens.map((item, i) => (
        <div
          key={item.rotulo}
          className={`flex-1 basis-40 ${i > 0 ? "border-l border-white/10 pl-5" : ""} ${
            i < itens.length - 1 ? "pr-5" : ""
          }`}
        >
          <dt className="rotulo">{item.rotulo}</dt>
          <dd
            className={`tabular mt-1.5 font-display text-[28px] font-light leading-none tracking-tight ${
              item.forte ? "text-jade-200" : "text-marfim"
            }`}
          >
            {item.valor}
          </dd>
          {item.detalhe && (
            <dd className="mt-1.5 text-xs leading-snug text-marfim/58">
              {item.detalhe}
            </dd>
          )}
        </div>
      ))}
    </dl>
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
    <p
      className={`flex items-start gap-2.5 text-xs leading-relaxed text-marfim/55 ${className}`}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden
        className="mt-0.5 shrink-0 text-ambar-500"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8h.01M12 11v5" />
      </svg>
      <span>
        <strong className="font-semibold text-ambar-300">Dados simulados.</strong>{" "}
        Histórico de vendas, fichas técnicas e estoque saem de um script de
        exemplo e não vêm de um restaurante real. Reais são só a previsão do
        tempo, a sua localização e a análise escrita pela IA.
      </span>
    </p>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-white/13 px-4 py-7 text-center text-sm leading-relaxed text-marfim/58">
      {children}
    </p>
  );
}

/** Cabeçalho da tela: título grande e o aviso, sem caixa em volta. */
export function TituloDaTela({
  titulo,
  children,
  acao,
}: {
  titulo: string;
  children: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div>
        <h1 className="font-display text-[40px] font-light leading-[1.05] tracking-tight text-marfim">
          {titulo}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-marfim/68">
          {children}
        </p>
      </div>
      {acao}
    </div>
  );
}

/* Tabelas densas: filete fino, linha baixa, número tabular. */
export const CABECALHO_TABELA =
  "border-b border-white/10 pb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-marfim/45";
export const CELULA = "py-2.5 border-b border-white/[0.05]";
