/**
 * Alocação de mesas — calculada ANTES de o cliente chegar.
 *
 * A ideia: quando um grupo aparece na porta, a resposta já tem que existir.
 * Então, a cada mudança no salão, o sistema resolve de uma vez "e se entrar
 * um grupo de 1? de 2? ... de 6?" e guarda as seis respostas prontas. Na
 * chegada, a recepção só lê — não calcula nada.
 *
 * O critério é o melhor encaixe: entre as mesas livres que comportam o
 * grupo, vai a MENOR. Dar uma mesa de 8 para um casal queima 6 lugares que
 * o próximo grupo grande vai precisar.
 *
 * Conta pura, sem IA. Precisa ser instantânea e sempre igual.
 */

import { MESAS, TEMPO_MEDIO_DE_REFEICAO } from "./restaurante";
import type { ItemDaFila, Mesa, Ocupacao, Reserva } from "./tipos";

/** Tamanhos de grupo para os quais a resposta fica pronta de antemão. */
export const GRUPOS_PREVISTOS = [1, 2, 3, 4, 5, 6];

export type PlanoDeChegada = {
  pessoas: number;
  situacao: "livre" | "juntar" | "espera" | "sem-opcao";
  /** Mesa indicada, quando há uma livre. */
  mesa: Mesa | null;
  /** Mesas a juntar, quando nenhuma sozinha comporta o grupo. */
  juntar: Mesa[] | null;
  /** Minutos até liberar, quando é preciso esperar. */
  esperaMinutos: number | null;
  /** Lugares que sobram na mesa indicada. */
  sobra: number;
  explicacao: string;
};

/**
 * Quanto tempo depois do horário marcado a mesa continua guardada.
 * Passado isso, o sistema entende que não vieram e devolve a mesa.
 */
export const TOLERANCIA_DE_ATRASO = 20;

export type MesaReservada = {
  mesa: Mesa;
  reserva: Reserva;
  /** Minutos até o horário marcado (negativo se já passou). */
  emMinutos: number;
};

export type EstadoDoSalao = {
  /** Livres E sem reserva em cima: o que a recepção pode entregar agora. */
  mesasLivres: Mesa[];
  mesasOcupadas: { mesa: Mesa; ocupacao: Ocupacao; ha: number; liberaEm: number }[];
  /** Livres, mas guardadas para uma reserva que está chegando. */
  mesasReservadas: MesaReservada[];
  lugaresLivres: number;
  pessoasSentadas: number;
  ocupacaoPercentual: number;
};

const minutosDesde = (iso: string, agora: Date) =>
  Math.max(0, Math.round((agora.getTime() - new Date(iso).getTime()) / 60000));

const minutosAte = (iso: string, agora: Date) =>
  Math.round((new Date(iso).getTime() - agora.getTime()) / 60000);

/**
 * Reservas que já seguram a mesa neste instante.
 *
 * Uma reserva das 20h não bloqueia nada às 15h. Ela passa a segurar quando
 * falta menos que uma refeição inteira — entregar a mesa depois disso faria
 * o grupo anterior ainda estar comendo na hora da reserva.
 */
export function reservasQueSeguram(
  reservas: Reserva[],
  agora: Date
): { reserva: Reserva; emMinutos: number }[] {
  return reservas
    .map((reserva) => ({ reserva, emMinutos: minutosAte(reserva.para, agora) }))
    .filter(
      ({ emMinutos }) =>
        emMinutos <= TEMPO_MEDIO_DE_REFEICAO && emMinutos >= -TOLERANCIA_DE_ATRASO
    )
    .sort((a, b) => a.emMinutos - b.emMinutos);
}

/** Fotografia do salão neste instante. */
export function lerSalao(
  ocupacoes: Ocupacao[],
  reservas: Reserva[],
  agora: Date
): EstadoDoSalao {
  const ocupadasPorId = new Map(ocupacoes.map((o) => [o.mesaId, o]));

  const mesasOcupadas = MESAS.filter((m) => ocupadasPorId.has(m.id)).map((mesa) => {
    const ocupacao = ocupadasPorId.get(mesa.id)!;
    const ha = minutosDesde(ocupacao.desde, agora);
    return {
      mesa,
      ocupacao,
      ha,
      liberaEm: Math.max(0, TEMPO_MEDIO_DE_REFEICAO - ha),
    };
  });

  const vazias = MESAS.filter((m) => !ocupadasPorId.has(m.id));

  // Mesas vazias que estão guardadas para uma reserva chegando.
  const segurando = reservasQueSeguram(reservas, agora);
  const mesasReservadas: MesaReservada[] = [];
  const presas = new Set<string>();

  for (const { reserva, emMinutos } of segurando) {
    // Uma reserva de junção segura todas as suas mesas.
    for (const mesaId of reserva.mesaIds) {
      const mesa = vazias.find((m) => m.id === mesaId && !presas.has(m.id));
      if (!mesa) continue;

      presas.add(mesa.id);
      mesasReservadas.push({ mesa, reserva, emMinutos });
    }
  }

  const mesasLivres = vazias.filter((m) => !presas.has(m.id));
  const pessoasSentadas = ocupacoes.reduce((s, o) => s + o.pessoas, 0);
  const lugaresLivres = mesasLivres.reduce((s, m) => s + m.lugares, 0);

  return {
    mesasLivres,
    mesasOcupadas,
    mesasReservadas,
    lugaresLivres,
    pessoasSentadas,
    ocupacaoPercentual: MESAS.length
      ? Math.round((mesasOcupadas.length / MESAS.length) * 100)
      : 0,
  };
}

/** A menor mesa livre que comporta o grupo. */
function melhorEncaixe(livres: Mesa[], pessoas: number): Mesa | null {
  return (
    livres
      .filter((m) => m.lugares >= pessoas)
      .sort((a, b) => a.lugares - b.lugares || a.numero - b.numero)[0] ?? null
  );
}

/** Até quantas mesas a casa aceita juntar para um grupo só. */
export const MAXIMO_DE_MESAS_JUNTAS = 3;

/** "4, 7 e 9" — números de mesa em frase. */
export const listarNumeros = (mesas: Mesa[]) => {
  const numeros = mesas.map((m) => String(m.numero));
  return numeros.length <= 1
    ? numeros.join("")
    : `${numeros.slice(0, -1).join(", ")} e ${numeros[numeros.length - 1]}`;
};

/**
 * A melhor escolha com exatamente `tamanho` mesas: comporta o grupo com a
 * menor sobra. Olha todas as combinações — com 14 mesas são algumas
 * centenas, nada que se sinta.
 */
function melhorCombinacao(
  livres: Mesa[],
  pessoas: number,
  tamanho: number
): Mesa[] | null {
  const explorar = (
    aPartirDe: number,
    escolhidas: Mesa[],
    lugares: number
  ): { mesas: Mesa[]; sobra: number } | null => {
    if (escolhidas.length === tamanho) {
      return lugares >= pessoas
        ? { mesas: escolhidas, sobra: lugares - pessoas }
        : null;
    }

    let melhor: { mesas: Mesa[]; sobra: number } | null = null;
    for (let i = aPartirDe; i < livres.length; i++) {
      const achado = explorar(
        i + 1,
        [...escolhidas, livres[i]],
        lugares + livres[i].lugares
      );
      if (achado && (!melhor || achado.sobra < melhor.sobra)) melhor = achado;
    }
    return melhor;
  };

  return explorar(0, [], 0)?.mesas ?? null;
}

/**
 * Mesas livres que, juntas, comportam o grupo. Tenta duas; só parte para
 * três se nenhum par resolver — cada mesa a mais é mais arrasto no salão e
 * mais lugar queimado.
 */
function melhorJuncao(livres: Mesa[], pessoas: number): Mesa[] | null {
  for (let tamanho = 2; tamanho <= MAXIMO_DE_MESAS_JUNTAS; tamanho++) {
    const combinacao = melhorCombinacao(livres, pessoas, tamanho);
    if (combinacao) return combinacao;
  }
  return null;
}

/**
 * Divide o grupo pelas mesas de uma junção: enche cada mesa na ordem e o
 * resto senta na última. A junção só existe quando nenhuma combinação menor
 * comporta, então nenhuma mesa fica vazia e a última nunca estoura.
 */
export function dividirPelasMesas(
  mesas: Mesa[],
  pessoas: number
): { mesaId: string; pessoas: number }[] {
  let restante = pessoas;
  return mesas.map((mesa, i) => {
    const nesta =
      i === mesas.length - 1 ? restante : Math.min(mesa.lugares, restante);
    restante -= nesta;
    return { mesaId: mesa.id, pessoas: nesta };
  });
}

const numeroDaMesa = (mesaId: string) =>
  MESAS.find((m) => m.id === mesaId)?.numero ?? 0;

/**
 * Uma mesa ocupada e as que sentaram juntas com ela, em ordem de número.
 * Mesa sozinha volta só ela; mesa livre, nada.
 */
export function ocupacoesDaJuncao(ocupacoes: Ocupacao[], mesaId: string): Ocupacao[] {
  const propria = ocupacoes.find((o) => o.mesaId === mesaId);
  if (!propria) return [];
  if (!propria.grupo) return [propria];

  return ocupacoes
    .filter((o) => o.grupo === propria.grupo)
    .sort((a, b) => numeroDaMesa(a.mesaId) - numeroDaMesa(b.mesaId));
}

/**
 * A junção vista como uma mesa só, que é como a conta enxerga: as pessoas
 * somam e vale o horário de quem sentou primeiro.
 */
export function ocupacaoConjunta(juntas: Ocupacao[]): Ocupacao | null {
  if (juntas.length <= 1) return juntas[0] ?? null;

  return {
    ...juntas[0],
    pessoas: juntas.reduce((s, o) => s + o.pessoas, 0),
    desde: juntas.reduce((cedo, o) => (o.desde < cedo ? o.desde : cedo), juntas[0].desde),
  };
}

/** Resolve um tamanho de grupo. */
export function planejarGrupo(
  salao: EstadoDoSalao,
  pessoas: number
): PlanoDeChegada {
  const livre = melhorEncaixe(salao.mesasLivres, pessoas);

  if (livre) {
    const sobra = livre.lugares - pessoas;
    return {
      pessoas,
      situacao: "livre",
      mesa: livre,
      juntar: null,
      esperaMinutos: null,
      sobra,
      explicacao:
        sobra === 0
          ? `Mesa ${livre.numero} serve exato, sem lugar sobrando.`
          : `Mesa ${livre.numero} é a menor que comporta — sobra${sobra > 1 ? "m" : ""} ${sobra} lugar${sobra > 1 ? "es" : ""}.`,
    };
  }

  // Nenhuma mesa sozinha: dá para juntar duas ou três que estão livres?
  const juncao = melhorJuncao(salao.mesasLivres, pessoas);
  if (juncao) {
    const soma = juncao.reduce((s, m) => s + m.lugares, 0);
    return {
      pessoas,
      situacao: "juntar",
      mesa: null,
      juntar: juncao,
      esperaMinutos: null,
      sobra: soma - pessoas,
      explicacao: `Juntar as mesas ${listarNumeros(juncao)} — ${soma} lugares.`,
    };
  }

  // Ninguém livre: a que libera primeiro entre as que comportam.
  const proxima = salao.mesasOcupadas
    .filter((o) => o.mesa.lugares >= pessoas)
    .sort((a, b) => a.liberaEm - b.liberaEm || a.mesa.lugares - b.mesa.lugares)[0];

  if (proxima) {
    return {
      pessoas,
      situacao: "espera",
      mesa: proxima.mesa,
      juntar: null,
      esperaMinutos: proxima.liberaEm,
      sobra: proxima.mesa.lugares - pessoas,
      explicacao:
        proxima.liberaEm === 0
          ? `Mesa ${proxima.mesa.numero} já passou do tempo médio — deve liberar a qualquer momento.`
          : `Mesa ${proxima.mesa.numero} está há ${proxima.ha} min ocupada; libera em cerca de ${proxima.liberaEm} min.`,
    };
  }

  return {
    pessoas,
    situacao: "sem-opcao",
    mesa: null,
    juntar: null,
    esperaMinutos: null,
    sobra: 0,
    explicacao: `Nem juntando ${MAXIMO_DE_MESAS_JUNTAS} mesas o salão comporta esse grupo agora.`,
  };
}

/* ------------------------------------------------------------------ */
/* Fila de espera                                                      */
/* ------------------------------------------------------------------ */

export type ChamadoDaFila = {
  item: ItemDaFila;
  esperandoHa: number;
  /** Mesa livre agora para este grupo. */
  mesa: Mesa | null;
  /** Mesas livres a juntar agora, quando nenhuma sozinha comporta. */
  juntar: Mesa[] | null;
  /** Se não há mesa livre, quanto falta — e o que vai liberar. */
  esperaMinutos: number | null;
  mesaPrevista: Mesa | null;
  /** Junção prevista para o grupo grande, quando é preciso esperar vagar. */
  juntarPrevisto: Mesa[] | null;
};

export type SituacaoDaFila = {
  chamados: ChamadoDaFila[];
  /** Mesas que sobram para quem chegar sem estar na fila. */
  mesasLivresParaNovos: Mesa[];
  prontosParaSentar: number;
};

/**
 * Distribui as mesas entre quem já está esperando, por ordem de chegada.
 *
 * Isso vem ANTES de responder sobre quem entrar pela porta agora: uma mesa
 * prometida a quem está na fila há 20 minutos não pode ser oferecida a um
 * grupo que acabou de chegar. É por isso que a fila entra no mesmo cálculo,
 * e não numa lista separada.
 */
export function atenderFila(
  salao: EstadoDoSalao,
  fila: ItemDaFila[],
  agora: Date
): SituacaoDaFila {
  const livres = [...salao.mesasLivres];
  // As que vão vagando, da mais próxima para a mais distante.
  const vagando = [...salao.mesasOcupadas].sort((a, b) => a.liberaEm - b.liberaEm);

  const porOrdemDeChegada = [...fila].sort((a, b) =>
    a.desde.localeCompare(b.desde)
  );

  const chamados: ChamadoDaFila[] = porOrdemDeChegada.map((item) => {
    const semResposta: ChamadoDaFila = {
      item,
      esperandoHa: minutosDesde(item.desde, agora),
      mesa: null,
      juntar: null,
      esperaMinutos: null,
      mesaPrevista: null,
      juntarPrevisto: null,
    };

    const mesa = melhorEncaixe(livres, item.pessoas);
    if (mesa) {
      // Some da lista: esta mesa já tem dono.
      livres.splice(livres.indexOf(mesa), 1);
      return { ...semResposta, mesa };
    }

    // Nenhuma sozinha comporta: juntar livres resolve agora?
    const juncao = melhorJuncao(livres, item.pessoas);
    if (juncao) {
      for (const m of juncao) livres.splice(livres.indexOf(m), 1);
      return { ...semResposta, juntar: juncao };
    }

    // Esperar: a mesa que vaga primeiro e comporta o grupo sozinha...
    const indice = vagando.findIndex((o) => o.mesa.lugares >= item.pessoas);
    if (indice !== -1) {
      const [proxima] = vagando.splice(indice, 1);
      return {
        ...semResposta,
        esperaMinutos: proxima.liberaEm,
        mesaPrevista: proxima.mesa,
      };
    }

    /*
     * ...ou, para o grupo grande, o instante em que uma junção fecha:
     * solta na conta as mesas que vão vagando, na ordem, até dar. A
     * primeira junção que aparecer usa a mesa recém-solta, então a espera
     * é o tempo de liberação dela.
     */
    const combinaveis = [...livres];
    for (let i = 0; i < vagando.length; i++) {
      combinaveis.push(vagando[i].mesa);
      const futura = melhorJuncao(combinaveis, item.pessoas);
      if (!futura) continue;

      const espera = vagando[i].liberaEm;
      // Promete essas mesas: somem das livres e da lista de quem vaga.
      for (const m of futura) {
        const emLivres = livres.indexOf(m);
        if (emLivres !== -1) livres.splice(emLivres, 1);
        const emVagando = vagando.findIndex((v) => v.mesa.id === m.id);
        if (emVagando !== -1) vagando.splice(emVagando, 1);
      }

      return {
        ...semResposta,
        esperaMinutos: espera,
        // Em ordem de número para a tela — o cálculo mistura livres e ocupadas.
        juntarPrevisto: [...futura].sort((a, b) => a.numero - b.numero),
      };
    }

    return semResposta;
  });

  return {
    chamados,
    mesasLivresParaNovos: livres,
    prontosParaSentar: chamados.filter((c) => c.mesa || c.juntar).length,
  };
}

/**
 * Escolhe as mesas de uma reserva nova.
 *
 * Melhor encaixe entre as que não têm outra reserva perto do mesmo horário —
 * duas reservas na mesma mesa com 20 minutos de diferença não cabem. Grupo
 * que nenhuma mesa comporta sozinha recebe uma junção; vazio é "sem mesa".
 */
export function mesasParaReserva(
  reservas: Reserva[],
  pessoas: number,
  para: string
): Mesa[] {
  const alvo = new Date(para).getTime();

  const conflitantes = new Set(
    reservas
      .filter((r) => {
        const diferenca = Math.abs(new Date(r.para).getTime() - alvo) / 60000;
        return diferenca < TEMPO_MEDIO_DE_REFEICAO;
      })
      .flatMap((r) => r.mesaIds)
  );

  const candidatas = MESAS.filter((m) => !conflitantes.has(m.id));

  const sozinha = melhorEncaixe(candidatas, pessoas);
  if (sozinha) return [sozinha];

  return melhorJuncao(candidatas, pessoas) ?? [];
}

/**
 * As respostas prontas para todos os tamanhos de grupo.
 * É isto que fica calculado esperando alguém entrar pela porta.
 */
export function planejarChegadas(
  ocupacoes: Ocupacao[],
  fila: ItemDaFila[],
  reservas: Reserva[],
  agora: Date
): {
  salao: EstadoDoSalao;
  /** O salão como quem chega agora enxerga — para responder grupos avulsos. */
  salaoParaNovos: EstadoDoSalao;
  planos: PlanoDeChegada[];
  situacaoDaFila: SituacaoDaFila;
} {
  const salao = lerSalao(ocupacoes, reservas, agora);
  const situacaoDaFila = atenderFila(salao, fila, agora);

  // Quem chega agora só enxerga o que sobrou depois de atender a fila.
  const salaoParaNovos: EstadoDoSalao = {
    ...salao,
    mesasLivres: situacaoDaFila.mesasLivresParaNovos,
    lugaresLivres: situacaoDaFila.mesasLivresParaNovos.reduce(
      (s, m) => s + m.lugares,
      0
    ),
  };

  return {
    salao,
    salaoParaNovos,
    situacaoDaFila,
    planos: GRUPOS_PREVISTOS.map((pessoas) =>
      planejarGrupo(salaoParaNovos, pessoas)
    ),
  };
}
