import type { ReactNode } from "react";

/*
 * Toda tela tem a mesma planta: um trilho à esquerda com o contexto (o dia,
 * o clima, as respostas prontas, os alertas) e o conteúdo à direita. O
 * trilho diz "onde estou e o que está acontecendo"; o conteúdo, "o que
 * fazer". Em tela estreita o trilho sobe e vira o topo da página.
 *
 * O trilho rola junto com a página, sem rolagem própria: preso à janela, ele
 * escondia o fim (os alertas, o fechar do dia) quando passava da altura dela.
 *
 * Superfícies: tudo é vidro, e uma única peça por tela ganha o vidro de
 * fogo — o `Heroi`. Quando tudo é destaque, nada é hierarquia.
 */

/* ------------------------------------------------------------------ */
/* Planta da tela                                                      */
/* ------------------------------------------------------------------ */

export function TelaComTrilho({
  trilho,
  children,
}: {
  /** Blocos do trilho: `BlocoDoTrilho` e `TituloDoTrilho`. */
  trilho: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)] 2xl:gap-6">
      <aside className="vidro rounded-[22px] p-6">
        <div className="flex flex-col divide-y divide-white/[0.09]">{trilho}</div>
      </aside>
      <div className="min-w-0 space-y-5">{children}</div>
    </div>
  );
}

/** Um bloco do trilho. Os blocos se separam por um filete. */
export function BlocoDoTrilho({
  rotulo,
  acao,
  children,
  className = "",
}: {
  rotulo?: string;
  /** Algo pequeno alinhado à direita do rótulo (uma etiqueta, um link). */
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`py-4 first:pt-0 last:pb-0 ${className}`}>
      {(rotulo || acao) && (
        <div className="mb-2.5 flex items-center justify-between gap-3">
          {rotulo && <p className="rotulo">{rotulo}</p>}
          {acao}
        </div>
      )}
      {children}
    </section>
  );
}

/** Primeiro bloco do trilho: o nome da tela e uma linha do que ela faz. */
export function TituloDoTrilho({
  titulo,
  children,
}: {
  titulo: string;
  children?: ReactNode;
}) {
  return (
    <section className="py-4 first:pt-0 last:pb-0">
      <h1 className="font-display text-[26px] font-medium leading-[1.1] tracking-tight text-marfim">
        {titulo}
      </h1>
      {children && (
        <p className="mt-2 text-[13px] leading-relaxed text-marfim/60">{children}</p>
      )}
    </section>
  );
}

/** Tela abrindo: o estado vem do armazenamento e ainda não chegou. */
export function Carregando({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <TelaComTrilho trilho={<TituloDoTrilho titulo={titulo}>{children}</TituloDoTrilho>}>
      <div className="vidro-bloco h-64 animate-pulse rounded-[22px]" aria-hidden />
    </TelaComTrilho>
  );
}

/* ------------------------------------------------------------------ */
/* Superfícies                                                         */
/* ------------------------------------------------------------------ */

/** O destaque da tela — vidro de fogo. Um por tela. */
export function Heroi({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`vidro-fogo overflow-hidden rounded-[22px] ${className}`}>
      {children}
    </section>
  );
}

/** Cabeçalho comum de um cartão: título, uma linha de descrição e uma ação. */
function CabecalhoDoCartao({
  titulo,
  descricao,
  acao,
}: {
  titulo?: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  if (!titulo && !acao) return null;
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-6 pb-3 pt-5">
      <div className="min-w-0">
        {titulo && (
          <h2 className="font-display text-[19px] font-semibold tracking-tight text-marfim">
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
  );
}

/**
 * Cartão de vidro com título. É a superfície padrão do conteúdo: previsão,
 * listas, tabelas, formulários.
 */
export function Secao({
  titulo,
  descricao,
  acao,
  children,
  className = "",
  classeDoMiolo = "",
  id,
}: {
  titulo?: string;
  descricao?: string;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Classes do miolo, para o conteúdo ocupar a altura do cartão. */
  classeDoMiolo?: string;
  id?: string;
}) {
  const temCabecalho = Boolean(titulo || acao);
  return (
    <section id={id} className={`vidro rounded-[22px] ${className}`}>
      <CabecalhoDoCartao titulo={titulo} descricao={descricao} acao={acao} />
      <div className={`${temCabecalho ? "px-6 pb-6" : "p-6"} ${classeDoMiolo}`}>{children}</div>
    </section>
  );
}

/** Cartão de vidro sem cabeçalho, para peças curtas. */
export function Painel({
  children,
  className = "",
  semRespiro = false,
}: {
  children: ReactNode;
  className?: string;
  /** Deixa o conteúdo encostar na borda (gráfico sangrando). */
  semRespiro?: boolean;
}) {
  return (
    <section className={`vidro overflow-hidden rounded-[22px] ${className}`}>
      <div className={semRespiro ? "" : "p-6"}>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Números                                                             */
/* ------------------------------------------------------------------ */

type ItemDeNumero = {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  forte?: boolean;
};

const COLUNAS_XL: Record<number, string> = {
  1: "xl:grid-cols-1",
  2: "xl:grid-cols-2",
  3: "xl:grid-cols-3",
  4: "xl:grid-cols-4",
  5: "xl:grid-cols-5",
};

/**
 * Os números da tela. Por padrão, um cartão de vidro por número; em
 * `faixa`, uma linha separada por filetes, para ficar DENTRO de outro
 * cartão sem virar cartão dentro de cartão.
 */
export function LinhaDeNumeros({
  itens,
  className = "",
  variante = "cartoes",
}: {
  itens: ItemDeNumero[];
  className?: string;
  variante?: "cartoes" | "faixa";
}) {
  if (variante === "faixa") {
    return (
      <dl className={`flex flex-wrap items-stretch gap-y-4 ${className}`}>
        {itens.map((item, i) => (
          <div
            key={item.rotulo}
            className={`flex-1 basis-40 ${i > 0 ? "border-l border-white/10 pl-5" : ""} ${
              i < itens.length - 1 ? "pr-5" : ""
            }`}
          >
            <Numero item={item} />
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl
      className={`grid gap-5 sm:grid-cols-2 ${COLUNAS_XL[itens.length] ?? "xl:grid-cols-4"} ${className}`}
    >
      {itens.map((item, i) => (
        <div
          key={item.rotulo}
          className={`vidro rounded-[18px] px-5 py-4 ${
            itens.length % 2 === 1 && i === itens.length - 1 ? "sm:col-span-2 xl:col-span-1" : ""
          }`}
        >
          <Numero item={item} />
        </div>
      ))}
    </dl>
  );
}

function Numero({ item }: { item: ItemDeNumero }) {
  return (
    <>
      <dt className="rotulo">{item.rotulo}</dt>
      <dd
        className={`tabular mt-1.5 font-display text-[30px] font-medium leading-none tracking-tight ${
          item.forte ? "text-fogo-400" : "text-marfim"
        }`}
      >
        {item.valor}
      </dd>
      {item.detalhe && (
        <dd className="mt-2 text-xs leading-snug text-marfim/58">{item.detalhe}</dd>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Etiquetas e vazios                                                  */
/* ------------------------------------------------------------------ */

/*
 * Cor com significado fixo, igual em todas as telas:
 *   fogo      — a marca: destaque, previsão, o que foi escolhido
 *   nevoa     — livre, disponível, dentro do esperado; também a chuva
 *   ambar     — prazo chegando, risco
 *   brasa     — vencido, em falta, atrasado
 *   neutro    — informação sem juízo
 */
const CORES_ETIQUETA = {
  neutro: "bg-white/[0.07] text-marfim/78 ring-white/12",
  fogo: "bg-fogo-500 text-tinta ring-transparent font-bold",
  fogoSuave: "bg-fogo-500/12 text-fogo-300 ring-fogo-500/32",
  ambar: "bg-ambar-500/15 text-ambar-300 ring-ambar-500/34",
  nevoa: "bg-nevoa-500/14 text-nevoa-300 ring-nevoa-500/32",
  brasa: "bg-brasa-300/14 text-brasa-300 ring-brasa-300/32",
} as const;

export type CorDeEtiqueta = keyof typeof CORES_ETIQUETA;

export function Etiqueta({
  cor = "neutro",
  children,
}: {
  cor?: CorDeEtiqueta;
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

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-white/13 px-4 py-7 text-center text-sm leading-relaxed text-marfim/58">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Botões                                                              */
/* ------------------------------------------------------------------ */

/** Ação principal: o gradiente de fogo. Uma por contexto. */
export const BOTAO_PRIMARIO =
  "rounded-xl bg-gradient-to-b from-fogo-400 to-fogo-600 font-bold text-tinta shadow-[0_10px_24px_-12px_rgba(255,122,72,0.8)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:from-white/10 disabled:to-white/10 disabled:text-marfim/35 disabled:shadow-none";

/** Ação secundária: contorno discreto. */
export const BOTAO_SECUNDARIO =
  "rounded-xl border border-white/12 font-semibold text-marfim/80 transition hover:border-white/30 hover:text-marfim disabled:cursor-not-allowed disabled:opacity-35";

/* Tabelas densas: filete fino, linha baixa, número tabular. */
export const CABECALHO_TABELA =
  "border-b border-white/10 pb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-marfim/55";
export const CELULA = "py-2.5 border-b border-white/[0.05]";
