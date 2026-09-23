"use client";

/**
 * Estado do serviço: quem está sentado, o que foi pedido, o que entrou e
 * saiu do estoque, e quem fez cada coisa.
 *
 * Três decisões estruturais:
 *
 * 1. `useReducer` com função pura. Desfazer precisa guardar o estado
 *    anterior de cada ação, e empilhar de dentro de um `setState` duplicaria
 *    a pilha no modo estrito do React. Com redutor puro, rodar duas vezes dá
 *    o mesmo resultado. Ids e horários nascem FORA do redutor, presos na
 *    closure, para a repetição não gerar valores diferentes.
 *
 * 2. Toda escrita passa por `aplicar`, que confere a permissão e empilha o
 *    estado anterior com um rótulo legível. Assim desfazer cobre tudo de
 *    graça, inclusive o que for escrito depois.
 *
 * 3. O estado de referência mora num arquivo do servidor (`/api/servico`),
 *    para o serviço sobreviver à troca de navegador ou de computador. O
 *    localStorage vira cópia local: segura o serviço se o servidor não
 *    responder.
 *
 * 4. Várias telas abertas ao mesmo tempo (duas abas, o caixa e o celular do
 *    salão) enxergam umas às outras e nenhuma grava por cima da outra. Cada
 *    tela sabe em que versão do servidor ela se baseia (`revisao`) e guarda
 *    as ações que ainda não subiram (`pendentes`). Se outra tela gravou
 *    antes, o servidor recusa, a tela recebe a versão nova e refaz as ações
 *    dela por cima — é aqui que o redutor puro paga de novo: a mesma
 *    mudança roda sobre outro estado e confere as condições outra vez.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { MESAS } from "./restaurante";
import { estaPausado, precoDe } from "./cardapio";
import { calcularConta } from "./conta";
import { dataLocal, dataLonga, nomeDoPrato } from "./dados";
import { baixasDaConta, calcularLotes, comoItensDeEstoque } from "./estoque";
import {
  dividirPelasMesas,
  listarNumeros,
  mesasParaReserva,
  ocupacaoConjunta,
  ocupacoesDaJuncao,
} from "./salao";
import {
  OPERADOR_PADRAO,
  operadorPorId,
  pode,
  type Operador,
  type Permissao,
} from "./equipe";
import type {
  AjustesDoCardapio,
  ContaFechada,
  ItemDaFila,
  ItemDePedido,
  ItemEstoque,
  Lote,
  Mesa,
  MovimentoDeEstoque,
  Ocupacao,
  Pedido,
  RegistroVenda,
  Reserva,
  SituacaoDoPedido,
} from "./tipos";

const CHAVE = "prevchef:operacao:v2";
/** Quem opera é de cada aba: o caixa numa, a cozinha na outra. */
const CHAVE_DO_OPERADOR = "prevchef:operador";
const INTERVALO_DO_RELOGIO = 30_000;
/** De quanto em quanto tempo a tela pergunta ao servidor se outra gravou. */
const INTERVALO_DA_SINCRONIA = 5_000;
/** Respiro antes de subir, para uma sequência de cliques virar uma gravação só. */
const RESPIRO_DO_ENVIO = 300;
/** O navegador recusa envio que sobrevive à aba acima de 64 KB; fica uma folga. */
const LIMITE_DO_ENVIO_NA_SAIDA = 60_000;
const PASSOS_GUARDADOS = 25;

type Guardado = {
  ocupacoes: Ocupacao[];
  pedidos: Pedido[];
  fila: ItemDaFila[];
  reservas: Reserva[];
  contasFechadas: ContaFechada[];
  movimentos: MovimentoDeEstoque[];
  /** Dias já apurados, que o modelo passa a consultar. */
  diasFechados: RegistroVenda[];
  /** Preço e pausa por prato, por cima da ficha do arquivo. */
  cardapio: AjustesDoCardapio;
};

/** O que vai para o servidor e para o localStorage, além do estado. */
type Persistido = {
  estado: Guardado;
  operadorId?: string;
  salvoEm: string;
  /** Versão do servidor em que o estado se baseia; 0 = nenhuma. */
  revisao: number;
  /** Só na cópia local: há ações feitas aqui que ainda não subiram, e os ids delas. */
  pendente: boolean;
  acoes: string[];
  /** Só no servidor: a última ação de quem gravou, e de que aba ela veio. */
  ultimaAcao: string | null;
  origem?: string;
  /** Só no servidor: ids das últimas ações que já entraram no arquivo. */
  aplicadas: string[];
};

const soTextos = (lista: unknown): string[] =>
  Array.isArray(lista) ? lista.filter((x): x is string => typeof x === "string") : [];

/** Reserva gravada antes da junção tinha uma mesa só (`mesaId`). */
function migrarReserva(bruta: Reserva & { mesaId?: string | null }): Reserva {
  if (Array.isArray(bruta.mesaIds)) return bruta;
  const { mesaId, ...semOCampoAntigo } = bruta;
  return { ...semOCampoAntigo, mesaIds: mesaId ? [mesaId] : [] };
}

/** Confere a forma e completa o que faltar (gravações de versões antigas). */
function interpretarPersistido(bruto: unknown): Persistido | null {
  const lido = bruto as
    | (Guardado & {
        operadorId?: string;
        salvoEm?: string;
        revisao?: unknown;
        pendente?: unknown;
        acoes?: unknown;
        ultimaAcao?: unknown;
        origem?: unknown;
        aplicadas?: unknown;
      })
    | null;
  if (!lido || !Array.isArray(lido.ocupacoes) || !Array.isArray(lido.pedidos)) {
    return null;
  }

  return {
    estado: {
      ocupacoes: lido.ocupacoes,
      pedidos: lido.pedidos,
      fila: lido.fila ?? [],
      reservas: (lido.reservas ?? []).map(migrarReserva),
      contasFechadas: lido.contasFechadas ?? [],
      movimentos: lido.movimentos ?? [],
      diasFechados: lido.diasFechados ?? [],
      cardapio: lido.cardapio ?? {},
    },
    operadorId: lido.operadorId,
    salvoEm: lido.salvoEm ?? "",
    revisao: typeof lido.revisao === "number" ? lido.revisao : 0,
    pendente: lido.pendente === true,
    acoes: soTextos(lido.acoes),
    ultimaAcao: typeof lido.ultimaAcao === "string" ? lido.ultimaAcao : null,
    origem: typeof lido.origem === "string" ? lido.origem : undefined,
    aplicadas: soTextos(lido.aplicadas),
  };
}

type Mudanca = (g: Guardado) => Guardado;

type Passo = {
  id: string;
  rotulo: string;
  estado: Guardado;
  em: string;
  permissao: Permissao;
};

/** Ação feita nesta tela que o servidor ainda não confirmou. */
type Pendente = { id: string; rotulo: string; mudanca: Mudanca };

/** O que chegou de outra tela, para o cabeçalho avisar. */
export type MudancaDeFora = {
  /** A última ação de quem gravou, quando veio junto. */
  rotulo: string | null;
  quem: string | null;
  /** Ações desta tela que não couberam mais depois do que chegou. */
  descartadas: string[];
  revisao: number;
};

type Interno = {
  atual: Guardado;
  pilha: Passo[];
  /** A última versão que o servidor confirmou; nula enquanto ele não tem nenhuma desta tela. */
  base: Guardado | null;
  revisao: number;
  pendentes: Pendente[];
  /**
   * Ids de ações que vieram prontas da cópia local, sem a mudança junto (de
   * antes de recarregar, ou de outra aba). Sobem na primeira gravação, para
   * quem ainda as tiver pendentes não refazer em dobro.
   */
  herdadas: string[];
  deFora: MudancaDeFora | null;
};

type Acao =
  | {
      tipo: "carregar";
      atual: Guardado;
      base: Guardado | null;
      revisao: number;
      herdadas: string[];
      /** O que a cópia local tinha e não deu para aproveitar na carga. */
      descartadas: string[];
    }
  | {
      tipo: "aplicar";
      id: string;
      rotulo: string;
      em: string;
      permissao: Permissao;
      mudanca: Mudanca;
    }
  | { tipo: "desfazer" }
  | {
      tipo: "confirmar";
      enviado: Guardado;
      revisao: number;
      /** Todos os ids que subiram, inclusive os herdados. */
      ids: string[];
      /** As ações desta tela que subiram, com o rótulo. */
      enviados: { id: string; rotulo: string }[];
    }
  | {
      tipo: "sincronizar";
      estado: Guardado;
      revisao: number;
      /** Ids de ação que a versão nova já contém. */
      aplicadas: string[];
      rotulo: string | null;
      quem: string | null;
      /** Falso quando a versão nova foi gravada por esta mesma aba. */
      avisar: boolean;
    }
  | { tipo: "perdeuBase" }
  | { tipo: "dispensarAviso" };

const PERDIDO_AO_RECARREGAR =
  "o que esta tela fez antes de recarregar, sem chegar ao servidor";

/** Redutor puro: mesma entrada, mesma saída, quantas vezes rodar. */
function reduzir(interno: Interno, acao: Acao): Interno {
  switch (acao.tipo) {
    case "carregar":
      return {
        atual: acao.atual,
        pilha: [],
        base: acao.base,
        revisao: acao.revisao,
        pendentes: [],
        herdadas: acao.herdadas,
        deFora: acao.descartadas.length
          ? { rotulo: null, quem: null, descartadas: acao.descartadas, revisao: acao.revisao }
          : null,
      };

    case "aplicar": {
      const proximo = acao.mudanca(interno.atual);
      if (proximo === interno.atual) return interno;

      return {
        ...interno,
        atual: proximo,
        pilha: [
          ...interno.pilha.slice(-(PASSOS_GUARDADOS - 1)),
          {
            id: acao.id,
            rotulo: acao.rotulo,
            estado: interno.atual,
            em: acao.em,
            permissao: acao.permissao,
          },
        ],
        pendentes: [
          ...interno.pendentes,
          { id: acao.id, rotulo: acao.rotulo, mudanca: acao.mudanca },
        ],
      };
    }

    case "desfazer": {
      const ultimo = interno.pilha[interno.pilha.length - 1];
      if (!ultimo) return interno;
      const depois = interno.atual;
      return {
        ...interno,
        atual: ultimo.estado,
        pilha: interno.pilha.slice(0, -1),
        // Ainda não tinha subido: sai da fila de envio. Já tinha: o desfazer
        // sobe como uma ação que só vale sobre o mesmo estado — refeita por
        // cima de outra tela, cai como "não entrou" em vez de apagar o que a
        // outra fez ou sumir calada.
        pendentes: interno.pendentes.some((p) => p.id === ultimo.id)
          ? interno.pendentes.filter((p) => p.id !== ultimo.id)
          : [
              ...interno.pendentes,
              {
                id: `desfazer-${ultimo.id}`,
                rotulo: `desfazer · ${ultimo.rotulo}`,
                mudanca: (g: Guardado) => (g === depois ? ultimo.estado : g),
              },
            ],
      };
    }

    case "confirmar": {
      // Resposta atrasada de uma versão que outra já passou: nada a fazer.
      if (acao.revisao <= interno.revisao) return interno;

      // Desfeita enquanto o envio viajava: a ação chegou ao servidor e o
      // desfazer ainda não. Ele sobe como ação que só vale sobre o que foi
      // enviado — se outra tela gravar antes, cai como "não entrou".
      const atualAgora = interno.atual;
      const desfeitasNaViagem = acao.enviados
        .filter((e) => !interno.pendentes.some((p) => p.id === e.id))
        .map((e) => ({
          id: `desfazer-${e.id}`,
          rotulo: `desfazer · ${e.rotulo}`,
          mudanca: (g: Guardado) => (g === acao.enviado ? atualAgora : g),
        }));

      return {
        ...interno,
        base: acao.enviado,
        revisao: acao.revisao,
        pendentes: [
          ...interno.pendentes.filter((p) => !acao.ids.includes(p.id)),
          ...desfeitasNaViagem,
        ],
        herdadas: interno.herdadas.filter((id) => !acao.ids.includes(id)),
      };
    }

    case "sincronizar": {
      // Só chega aqui versão lida depois do último envio desta tela, então
      // ela vale mesmo com número menor — o arquivo pode ter sido trocado por
      // uma cópia antiga. A mesma revisão não traz nada de novo.
      if (acao.revisao === interno.revisao) return interno;

      // Outra tela gravou antes. O que esta fez e ainda não subiu é refeito
      // por cima da versão nova, e cada mudança confere de novo as condições
      // (mesa ainda livre, pedido ainda na cozinha). A que não cabe mais cai.
      // A que a versão nova já contém (a gravação chegou, a resposta não)
      // não roda de novo: seria um pedido em dobro.
      let atual = acao.estado;
      const ficam: Pendente[] = [];
      const descartadas: string[] = [];
      for (const pendente of interno.pendentes) {
        if (acao.aplicadas.includes(pendente.id)) continue;
        const proximo = pendente.mudanca(atual);
        if (proximo === atual) {
          descartadas.push(pendente.rotulo);
        } else {
          ficam.push(pendente);
          atual = proximo;
        }
      }
      // Sem a mudança junto, o que veio da cópia local não tem como ser
      // refeito: vale a versão nova, e a tela avisa se ficou algo de fora.
      if (interno.herdadas.some((id) => !acao.aplicadas.includes(id))) {
        descartadas.push(PERDIDO_AO_RECARREGAR);
      }

      return {
        atual,
        // A pilha guardava estados de antes da outra tela: desfazer para
        // um deles apagaria o que ela fez.
        pilha: [],
        base: acao.estado,
        revisao: acao.revisao,
        pendentes: ficam,
        herdadas: [],
        deFora:
          acao.avisar || descartadas.length > 0
            ? {
                rotulo: acao.avisar ? acao.rotulo : null,
                quem: acao.avisar ? acao.quem : null,
                // O que não entrou antes continua no aviso até alguém ler:
                // a próxima mudança de outra tela não pode apagar isso.
                descartadas: [...(interno.deFora?.descartadas ?? []), ...descartadas],
                revisao: acao.revisao,
              }
            : interno.deFora,
      };
    }

    case "perdeuBase":
      // O servidor ficou sem o arquivo (apagado ou estragado): esta tela
      // sobe o que tem, e a primeira que subir recria o serviço para todas.
      return interno.base === null ? interno : { ...interno, base: null };

    case "dispensarAviso":
      return interno.deFora ? { ...interno, deFora: null } : interno;
  }
}

type Operacao = Guardado & {
  agora: Date;
  pronto: boolean;
  /** Lotes vivos, já com entradas, baixas e perdas aplicadas. */
  lotes: Lote[];
  /** O mesmo estoque no formato que as telas de previsão esperam. */
  estoqueAtual: ItemEstoque[];
  /** Quem está operando agora. */
  operador: Operador;
  trocarOperador: (id: string) => void;
  autorizado: (permissao: Permissao) => boolean;
  /** Rótulo da última ação, para o botão de desfazer. */
  ultimoPasso: Passo | null;
  desfazer: () => void;
  /**
   * Outra tela acabou de mudar o serviço. Some sozinho depois de uns
   * segundos, menos quando alguma ação desta tela não entrou.
   */
  deFora: MudancaDeFora | null;
  dispensarAviso: () => void;

  sentar: (mesaId: string, pessoas: number) => void;
  /** Grupo que nenhuma mesa comporta: senta nas mesas juntadas, com uma conta só. */
  sentarNaJuncao: (mesaIds: string[], pessoas: number) => void;
  /** Libera a mesa e, numa junção, as juntadas com ela. */
  liberar: (mesaId: string) => void;
  lancarPedido: (mesaId: string, itens: ItemDePedido[]) => void;
  cancelarItem: (pedidoId: string, pratoId: string) => void;
  entrarNaFila: (nome: string, pessoas: number) => void;
  sairDaFila: (id: string) => void;
  sentarDaFila: (id: string, mesaIds: string[]) => void;
  reservar: (dados: {
    nome: string;
    pessoas: number;
    para: string;
    cpf: string;
    telefone: string;
    observacao?: string;
  }) => void;
  cancelarReserva: (id: string) => void;
  sentarReserva: (id: string) => void;
  /**
   * Fecha a conta da mesa — numa junção, a conta única do grupo todo.
   * `totalVisto` é o total que o caixa confirmou: se a conta mudou até a
   * gravação (outra tela mexeu), ela não fecha e a tela avisa.
   */
  fecharConta: (mesaId: string, comServico?: boolean, totalVisto?: number) => void;
  registrarEntrada: (entrada: {
    ingredienteId: string;
    quantidade: number;
    validade: string;
    custoUnitario: number;
    fornecedor?: string;
  }) => void;
  registrarPerda: (ingredienteId: string, quantidade: number, motivo: string) => void;
  fecharODia: (registro: RegistroVenda) => void;
  mudarSituacao: (pedidoId: string, situacao: SituacaoDoPedido) => void;
  cancelarPedido: (pedidoId: string) => void;
  mudarPreco: (pratoId: string, preco: number) => void;
  pausarPrato: (pratoId: string, pausado: boolean) => void;
  reiniciarServico: () => void;
};

const Contexto = createContext<Operacao | null>(null);

const VAZIO: Guardado = {
  ocupacoes: [],
  pedidos: [],
  fila: [],
  reservas: [],
  contasFechadas: [],
  movimentos: [],
  diasFechados: [],
  cardapio: {},
};

const minutosAtras = (minutos: number) =>
  new Date(Date.now() - minutos * 60000).toISOString();

const daquiA = (minutos: number) =>
  new Date(Date.now() + minutos * 60000).toISOString();

const numeroDaMesa = (mesaId: string) =>
  MESAS.find((m) => m.id === mesaId)?.numero ?? "?";

const novoId = (prefixo: string) =>
  `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Senta um grupo nas mesas. Numa junção o grupo se divide pelas mesas e
 * todas levam o mesmo `grupo`: é ele que faz a conta sair uma só.
 */
function ocupar(mesas: Mesa[], pessoas: number, desde: string, grupo: string): Ocupacao[] {
  return dividirPelasMesas(mesas, pessoas).map((l) => ({
    mesaId: l.mesaId,
    pessoas: l.pessoas,
    desde,
    ...(mesas.length > 1 ? { grupo } : {}),
  }));
}

/**
 * O que identifica quem está sentado na mesa: o grupo da junção ou, na mesa
 * sozinha, a hora em que sentou. Mesa livre não tem. Uma ação refeita por
 * cima de outra tela confere isto para não cair no grupo seguinte.
 */
function quemEstaNaMesa(ocupacoes: Ocupacao[], mesaId: string): string | null {
  const ocupacao = ocupacoes.find((o) => o.mesaId === mesaId);
  return ocupacao ? (ocupacao.grupo ?? ocupacao.desde) : null;
}

/** As mesas que andam junto com esta: ela e as juntadas. Livre, só ela. */
function mesasDaConta(ocupacoes: Ocupacao[], mesaId: string): string[] {
  const juntas = ocupacoesDaJuncao(ocupacoes, mesaId);
  return juntas.length > 0 ? juntas.map((o) => o.mesaId) : [mesaId];
}

/** "mesa 5" ou "mesas 5 e 13", para o rótulo do desfazer. */
function nomeDasMesas(mesaIds: string[]): string {
  const mesas = mesaIds
    .map((id) => MESAS.find((m) => m.id === id))
    .filter((m): m is Mesa => Boolean(m));
  return mesas.length > 1 ? `mesas ${listarNumeros(mesas)}` : `mesa ${numeroDaMesa(mesaIds[0])}`;
}

/** Um serviço em andamento, para a tela não abrir vazia. */
function servicoDeExemplo(): Guardado {
  const mesa = (numero: number) =>
    MESAS.find((m) => m.numero === numero)?.id ?? `mesa-${numero}`;

  return {
    ...VAZIO,
    ocupacoes: [
      { mesaId: mesa(5), pessoas: 4, desde: minutosAtras(38) },
      { mesaId: mesa(1), pessoas: 2, desde: minutosAtras(22) },
      { mesaId: mesa(10), pessoas: 5, desde: minutosAtras(12) },
      { mesaId: mesa(8), pessoas: 3, desde: minutosAtras(6) },
    ],
    pedidos: [
      {
        id: "pedido-exemplo-1",
        mesaId: mesa(5),
        itens: [
          { pratoId: "parmegiana", quantidade: 2 },
          { pratoId: "salada", quantidade: 1 },
        ],
        lancadoEm: minutosAtras(9),
        situacao: "em-preparo",
        iniciadoEm: minutosAtras(6),
      },
      {
        id: "pedido-exemplo-2",
        mesaId: mesa(10),
        itens: [
          { pratoId: "feijoada", quantidade: 3 },
          { pratoId: "caldo-verde", quantidade: 2 },
        ],
        lancadoEm: minutosAtras(4),
        situacao: "na-fila",
      },
      {
        id: "pedido-exemplo-3",
        mesaId: mesa(8),
        itens: [{ pratoId: "frango-grelhado", quantidade: 3 }],
        lancadoEm: minutosAtras(1),
        situacao: "na-fila",
      },
    ],
    fila: [
      { id: "fila-exemplo-1", nome: "Ribeiro", pessoas: 2, desde: minutosAtras(14) },
      { id: "fila-exemplo-2", nome: "Tanaka", pessoas: 6, desde: minutosAtras(7) },
    ],
    reservas: [
      {
        id: "reserva-exemplo-1",
        nome: "Moreira",
        pessoas: 6,
        para: daquiA(40),
        mesaIds: [mesa(12)],
        cpf: "52998224725",
        telefone: "11987654321",
        observacao: "aniversário",
      },
      {
        id: "reserva-exemplo-2",
        nome: "Salgado",
        pessoas: 4,
        para: daquiA(150),
        mesaIds: [mesa(9)],
        cpf: "11144477735",
        telefone: "11912345678",
      },
    ],
  };
}

export function ProvedorDeOperacao({ children }: { children: ReactNode }) {
  const [interno, despachar] = useReducer(reduzir, {
    atual: VAZIO,
    pilha: [],
    base: VAZIO,
    revisao: 0,
    pendentes: [],
    herdadas: [],
    deFora: null,
  });
  const [operador, setOperador] = useState<Operador>(OPERADOR_PADRAO);
  const [pronto, setPronto] = useState(false);
  const [agora, setAgora] = useState(() => new Date(0));

  // Envio e busca rodam fora do render e precisam do estado de agora.
  const internoRef = useRef(interno);
  const operadorRef = useRef(operador);
  useEffect(() => {
    internoRef.current = interno;
    operadorRef.current = operador;
  });

  /** Marca as gravações desta aba, para ela não se avisar do que ela mesma fez. */
  const origem = useRef("");
  const enviando = useRef(false);
  const buscando = useRef(false);
  /** Conta os envios terminados: pergunta que cruzou com um envio é descartada. */
  const envios = useRef(0);

  /*
   * Lê o serviço salvo. Vale o do servidor; a cópia local só entra quando
   * guarda ações que não chegaram a subir, feitas sobre a mesma versão que o
   * servidor ainda tem — ou quando o servidor não responde. Na primeira
   * visita, abre com um serviço em curso.
   */
  useEffect(() => {
    let vivo = true;
    origem.current = novoId("aba");

    const doNavegador = (): Persistido | null => {
      try {
        const salvo = window.localStorage.getItem(CHAVE);
        return salvo ? interpretarPersistido(JSON.parse(salvo)) : null;
      } catch {
        return null; // localStorage bloqueado ou conteúdo inválido.
      }
    };

    const operadorDaAba = () => {
      try {
        return window.sessionStorage.getItem(CHAVE_DO_OPERADOR);
      } catch {
        return null;
      }
    };

    (async () => {
      let doServidor: Persistido | null = null;
      let servidorRespondeu = false;
      try {
        const resposta = await fetch("/api/servico", { cache: "no-store" });
        if (resposta.ok) {
          servidorRespondeu = true;
          doServidor = interpretarPersistido((await resposta.json()).estado);
        }
      } catch {
        // Servidor fora do ar: segue com o que o navegador tiver.
      }

      const local = doNavegador();
      if (!vivo) return;

      if (doServidor) {
        const localNaFrente =
          local !== null && local.pendente && local.revisao === doServidor.revisao;
        despachar({
          tipo: "carregar",
          atual: localNaFrente ? local.estado : doServidor.estado,
          base: doServidor.estado,
          revisao: doServidor.revisao,
          herdadas: localNaFrente ? local.acoes : [],
          // A cópia local tinha ações que não subiram, mas o servidor andou
          // desde então: sem as mudanças para refazer, vale o servidor — e a
          // tela avisa, em vez de sumir com elas calada.
          descartadas: local?.pendente && !localNaFrente ? [PERDIDO_AO_RECARREGAR] : [],
        });
      } else if (local) {
        // Sem arquivo no servidor, ou servidor fora do ar: vale a cópia
        // local, que sobe assim que der.
        despachar({
          tipo: "carregar",
          atual: local.estado,
          base: servidorRespondeu || local.pendente ? null : local.estado,
          revisao: local.revisao,
          herdadas: local.pendente ? local.acoes : [],
          descartadas: [],
        });
      } else {
        despachar({
          tipo: "carregar",
          atual: servicoDeExemplo(),
          base: null,
          revisao: 0,
          herdadas: [],
          descartadas: [],
        });
      }

      const guardado =
        operadorPorId(operadorDaAba() ?? "") ??
        operadorPorId(local?.operadorId ?? doServidor?.operadorId ?? "");
      if (guardado) setOperador(guardado);

      setAgora(new Date());
      setPronto(true);
    })();

    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), INTERVALO_DO_RELOGIO);
    return () => clearInterval(id);
  }, []);

  /** Chegou versão nova de outra tela: refaz por cima o que esta ainda não subiu. */
  const receber = useCallback((lido: Persistido | null) => {
    if (!lido) return;
    despachar({
      tipo: "sincronizar",
      estado: lido.estado,
      revisao: lido.revisao,
      aplicadas: lido.aplicadas,
      rotulo: lido.ultimaAcao,
      quem: operadorPorId(lido.operadorId ?? "")?.nome ?? null,
      avisar: lido.origem !== origem.current,
    });
  }, []);

  /**
   * Sobe o estado dizendo em que versão ele se baseia. Se outra tela gravou
   * antes, o servidor recusa com a versão dela; a tela refaz as próprias
   * ações por cima e a próxima tentativa sai sozinha, porque o estado mudou.
   */
  const enviar = useCallback(async (saindo = false) => {
    if (enviando.current) return;
    const { atual, base, revisao, pendentes, herdadas } = internoRef.current;
    if (atual === base) return;
    const ids = [...herdadas, ...pendentes.map((p) => p.id)];
    const corpo = JSON.stringify({
      ...atual,
      operadorId: operadorRef.current.id,
      salvoEm: new Date().toISOString(),
      revisaoBase: revisao,
      acoes: ids,
      ultimaAcao: pendentes[pendentes.length - 1]?.rotulo ?? null,
      origem: origem.current,
    });

    enviando.current = true;
    try {
      const resposta = await fetch("/api/servico", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // Aba fechando: o navegador termina o envio mesmo depois de a página
        // sumir — mas só aceita corpo de até 64 KB assim.
        keepalive: saindo && corpo.length < LIMITE_DO_ENVIO_NA_SAIDA,
        body: corpo,
      });

      if (resposta.ok) {
        const { revisao: nova } = await resposta.json();
        despachar({
          tipo: "confirmar",
          enviado: atual,
          revisao: nova,
          enviados: pendentes.map((p) => ({ id: p.id, rotulo: p.rotulo })),
          ids,
        });
      } else if (resposta.status === 409) {
        receber(interpretarPersistido((await resposta.json()).estado));
      }
      // Outro erro: continua pendente e o relógio da sincronia tenta de novo.
    } catch {
      // Servidor fora do ar: idem, e a cópia local segura enquanto isso.
    } finally {
      envios.current += 1;
      enviando.current = false;
    }
  }, [receber]);

  /** Pergunta ao servidor se outra tela gravou desde a versão que esta tem. */
  const buscar = useCallback(async () => {
    if (enviando.current || buscando.current) return;
    const { atual, base, revisao } = internoRef.current;
    // Com ação por subir, quem descobre se alguém gravou antes é o envio.
    if (atual !== base) {
      void enviar();
      return;
    }

    buscando.current = true;
    const enviosAntes = envios.current;
    try {
      const resposta = await fetch(`/api/servico?desde=${revisao}`, { cache: "no-store" });
      if (!resposta.ok) return;
      const corpo = await resposta.json();
      // Um envio saiu enquanto a pergunta viajava: a resposta pode ser de
      // antes dele, e quem vale é o envio. A próxima volta pergunta de novo.
      if (corpo.mudou === false || enviando.current || envios.current !== enviosAntes) {
        return;
      }
      const lido = interpretarPersistido(corpo.estado);
      if (lido) receber(lido);
      // Arquivo apagado ou estragado: esta tela sobe o que tem.
      else despachar({ tipo: "perdeuBase" });
    } catch {
      // Servidor fora do ar: pergunta de novo na próxima volta do relógio.
    } finally {
      buscando.current = false;
    }
  }, [enviar, receber]);

  /*
   * Toda mudança vai para o localStorage na hora e, se ainda não está no
   * servidor, sobe depois de um respiro.
   */
  const {
    atual: estadoAtual,
    base: estadoBase,
    revisao: revisaoAtual,
    pendentes: pendentesAgora,
    herdadas: herdadasAgora,
  } = interno;
  useEffect(() => {
    if (!pronto) return;

    const pendente = estadoAtual !== estadoBase;
    try {
      window.localStorage.setItem(
        CHAVE,
        JSON.stringify({
          ...estadoAtual,
          operadorId: operador.id,
          salvoEm: new Date().toISOString(),
          revisao: revisaoAtual,
          pendente,
          acoes: pendente ? [...herdadasAgora, ...pendentesAgora.map((p) => p.id)] : [],
        })
      );
    } catch {
      // Sem espaço ou sem permissão: ainda há o servidor.
    }

    if (!pendente) return;
    const espera = setTimeout(() => void enviar(), RESPIRO_DO_ENVIO);
    return () => clearTimeout(espera);
  }, [
    estadoAtual,
    estadoBase,
    revisaoAtual,
    pendentesAgora,
    herdadasAgora,
    operador,
    pronto,
    enviar,
  ]);

  /*
   * Como esta tela fica sabendo das outras: outra aba do mesmo navegador
   * avisa na hora pelo localStorage; outro aparelho aparece na próxima volta
   * do relógio, ou quando a tela volta a ficar visível.
   */
  useEffect(() => {
    if (!pronto) return;

    const aoGravarEmOutraAba = (evento: StorageEvent) => {
      if (evento.key !== CHAVE || !evento.newValue) return;
      try {
        const lido = interpretarPersistido(JSON.parse(evento.newValue));
        if (lido && !lido.pendente && lido.revisao !== internoRef.current.revisao) {
          void buscar();
        }
      } catch {
        // Conteúdo inválido: o relógio resolve.
      }
    };
    const seVisivel = () => {
      if (document.visibilityState === "visible") void buscar();
    };
    // Aba fechando ou indo para o fundo com ação ainda no respiro: sobe já,
    // senão a ação só apareceria quando a aba voltasse.
    const aoSair = () => {
      const { atual, base } = internoRef.current;
      if (atual !== base) void enviar(true);
    };
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === "visible") void buscar();
      else aoSair();
    };
    const relogio = setInterval(seVisivel, INTERVALO_DA_SINCRONIA);

    window.addEventListener("storage", aoGravarEmOutraAba);
    window.addEventListener("focus", seVisivel);
    window.addEventListener("pagehide", aoSair);
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => {
      clearInterval(relogio);
      window.removeEventListener("storage", aoGravarEmOutraAba);
      window.removeEventListener("focus", seVisivel);
      window.removeEventListener("pagehide", aoSair);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }, [pronto, buscar, enviar]);

  // "Atualizado por outra tela" fica uns segundos e some. Com ação que não
  // entrou, fica até alguém fechar: é o único registro de que ela se perdeu.
  useEffect(() => {
    if (!interno.deFora || interno.deFora.descartadas.length > 0) return;
    const espera = setTimeout(() => despachar({ tipo: "dispensarAviso" }), 7000);
    return () => clearTimeout(espera);
  }, [interno.deFora]);

  const dispensarAviso = useCallback(() => despachar({ tipo: "dispensarAviso" }), []);

  /**
   * Todo caminho de escrita passa por aqui: confere a permissão, empilha o
   * estado anterior com um rótulo e aplica a mudança.
   */
  const aplicar = useCallback(
    (permissao: Permissao, rotulo: string, mudanca: Mudanca) => {
      if (!pode(operador, permissao)) return;
      despachar({
        tipo: "aplicar",
        id: novoId("acao"),
        rotulo,
        em: new Date().toISOString(),
        permissao,
        mudanca,
      });
      setAgora(new Date());
    },
    [operador]
  );

  // Desfazer pede a mesma permissão da ação que ele reverte.
  const ultimoPasso = interno.pilha[interno.pilha.length - 1] ?? null;
  const podeDesfazer = ultimoPasso !== null && pode(operador, ultimoPasso.permissao);

  const desfazer = useCallback(() => {
    if (!podeDesfazer) return;
    despachar({ tipo: "desfazer" });
    setAgora(new Date());
  }, [podeDesfazer]);

  const trocarOperador = useCallback((id: string) => {
    const achado = operadorPorId(id);
    if (!achado) return;
    setOperador(achado);
    try {
      window.sessionStorage.setItem(CHAVE_DO_OPERADOR, achado.id);
    } catch {
      // Sem sessionStorage: a troca vale até recarregar.
    }
  }, []);

  const autorizado = useCallback(
    (permissao: Permissao) => pode(operador, permissao),
    [operador]
  );

  /* ---------------------------------------------------------------- */
  /* Salão                                                             */
  /* ---------------------------------------------------------------- */

  const sentar = useCallback(
    (mesaId: string, pessoas: number) => {
      const desde = new Date().toISOString();
      aplicar(
        "gerenciarSalao",
        `sentar ${pessoas} na mesa ${numeroDaMesa(mesaId)}`,
        (atual) => {
          // Já ocupada (outra tela sentou antes): sentar por cima apagaria o
          // grupo — e, numa junção, deixaria o resto dele sozinho.
          if (atual.ocupacoes.some((o) => o.mesaId === mesaId)) return atual;
          return {
            ...atual,
            ocupacoes: [...atual.ocupacoes, { mesaId, pessoas, desde }],
          };
        }
      );
    },
    [aplicar]
  );

  const sentarNaJuncao = useCallback(
    (mesaIds: string[], pessoas: number) => {
      const mesas = mesaIds
        .map((mesaId) => MESAS.find((m) => m.id === mesaId))
        .filter((m): m is Mesa => Boolean(m));
      if (mesas.length === 0 || !Number.isInteger(pessoas) || pessoas <= 0) return;

      const desde = new Date().toISOString();
      const grupo = novoId("grupo");

      aplicar(
        "gerenciarSalao",
        mesas.length === 1
          ? `sentar ${pessoas} na mesa ${mesas[0].numero}`
          : `sentar ${pessoas} juntando as mesas ${listarNumeros(mesas)}`,
        (atual) => {
          // Alguma já ocupada (outra tela sentou antes): não senta por cima.
          if (mesas.some((m) => atual.ocupacoes.some((o) => o.mesaId === m.id))) {
            return atual;
          }
          return {
            ...atual,
            ocupacoes: [...atual.ocupacoes, ...ocupar(mesas, pessoas, desde, grupo)],
          };
        }
      );
    },
    [aplicar]
  );

  const liberar = useCallback(
    (mesaId: string) => {
      const mesasAgora = mesasDaConta(internoRef.current.atual.ocupacoes, mesaId);
      const quem = quemEstaNaMesa(internoRef.current.atual.ocupacoes, mesaId);

      aplicar(
        "gerenciarSalao",
        `liberar ${mesasAgora.length > 1 ? "as" : "a"} ${nomeDasMesas(mesasAgora)}`,
        (atual) => {
          // Já saíram, ou quem está lá agora é outro grupo: não mexe.
          if (!quem || quemEstaNaMesa(atual.ocupacoes, mesaId) !== quem) return atual;
          // Numa junção, o grupo sai de todas as mesas de uma vez.
          const mesaIds = mesasDaConta(atual.ocupacoes, mesaId);
          return {
            ...atual,
            ocupacoes: atual.ocupacoes.filter((o) => !mesaIds.includes(o.mesaId)),
            pedidos: atual.pedidos.map((p) =>
              mesaIds.includes(p.mesaId) && p.situacao !== "entregue"
                ? { ...p, situacao: "entregue" as const }
                : p
            ),
          };
        }
      );
    },
    [aplicar]
  );

  const lancarPedido = useCallback(
    (mesaId: string, itens: ItemDePedido[]) => {
      const validos = itens.filter((i) => i.quantidade > 0);
      if (validos.length === 0) return;

      const id = `pedido-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const lancadoEm = new Date().toISOString();
      const total = validos.reduce((s, i) => s + i.quantidade, 0);
      const operadorId = operador.id;
      const naHora = internoRef.current.atual;
      const quem = quemEstaNaMesa(naHora.ocupacoes, mesaId);
      // O preço viaja com o item: é o combinado na hora do pedido, e uma
      // mudança de preço depois não reescreve o que a mesa já pediu.
      const precos = new Map(validos.map((i) => [i.pratoId, precoDe(naHora.cardapio, i.pratoId)]));

      aplicar(
        "lancarPedido",
        `lançar ${total} ${total > 1 ? "itens" : "item"} na mesa ${numeroDaMesa(mesaId)}`,
        (atual) => {
          // O grupo que pediu já foi embora (outra tela fechou a conta, ou
          // sentou outro): o pedido não pode cair na conta de quem chegou.
          if (!quem || quemEstaNaMesa(atual.ocupacoes, mesaId) !== quem) return atual;

          // Prato pausado não passa, mesmo que a tela deixe.
          const comPreco = validos
            .filter((i) => !estaPausado(atual.cardapio, i.pratoId))
            .map((i) => ({ ...i, precoUnitario: precos.get(i.pratoId) }));
          if (comPreco.length === 0) return atual;

          return {
            ...atual,
            pedidos: [
              ...atual.pedidos,
              { id, mesaId, itens: comPreco, lancadoEm, situacao: "na-fila", operadorId },
            ],
          };
        }
      );
    },
    [aplicar, operador]
  );

  const cancelarItem = useCallback(
    (pedidoId: string, pratoId: string) => {
      aplicar(
        "lancarPedido",
        `tirar 1 ${nomeDoPrato(pratoId)} do pedido`,
        (atual) => {
          // Pronto ou entregue já saiu da cozinha: aí não é cancelamento, é
          // conta a fechar ou perda a registrar. Sem nada a tirar, a ação
          // não muda nada — e, refeita por cima de outra tela, cai com aviso.
          const alvo = atual.pedidos.find((p) => p.id === pedidoId);
          if (
            !alvo ||
            (alvo.situacao !== "na-fila" && alvo.situacao !== "em-preparo") ||
            !alvo.itens.some((i) => i.pratoId === pratoId)
          ) {
            return atual;
          }

          return {
            ...atual,
            pedidos: atual.pedidos.flatMap((p) => {
              if (p.id !== pedidoId) return [p];

              const itens = p.itens
                .map((i) =>
                  i.pratoId === pratoId ? { ...i, quantidade: i.quantidade - 1 } : i
                )
                .filter((i) => i.quantidade > 0);

              // Cancelou a última porção: o pedido some da fila da cozinha.
              return itens.length ? [{ ...p, itens }] : [];
            }),
          };
        }
      );
    },
    [aplicar]
  );

  /* ---------------------------------------------------------------- */
  /* Fila                                                              */
  /* ---------------------------------------------------------------- */

  const entrarNaFila = useCallback(
    (nome: string, pessoas: number) => {
      const limpo = nome.trim();
      if (!limpo || pessoas <= 0) return;

      const id = `fila-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const desde = new Date().toISOString();

      aplicar("gerenciarSalao", `anotar ${limpo} na fila`, (atual) => ({
        ...atual,
        fila: [...atual.fila, { id, nome: limpo, pessoas, desde }],
      }));
    },
    [aplicar]
  );

  const sairDaFila = useCallback(
    (id: string) => {
      aplicar("gerenciarSalao", "tirar da fila", (atual) =>
        atual.fila.some((f) => f.id === id)
          ? { ...atual, fila: atual.fila.filter((f) => f.id !== id) }
          : atual
      );
    },
    [aplicar]
  );

  const sentarDaFila = useCallback(
    (id: string, mesaIds: string[]) => {
      const desde = new Date().toISOString();
      const grupo = novoId("grupo");
      const mesas = mesaIds
        .map((mesaId) => MESAS.find((m) => m.id === mesaId))
        .filter((m): m is Mesa => Boolean(m));
      if (mesas.length === 0) return;

      const rotulo =
        mesas.length === 1
          ? `sentar a fila na mesa ${mesas[0].numero}`
          : `sentar a fila juntando as mesas ${listarNumeros(mesas)}`;

      aplicar("gerenciarSalao", rotulo, (atual) => {
        const item = atual.fila.find((f) => f.id === id);
        if (!item) return atual;
        // Mesa já ocupada: sentar por cima apagaria o grupo e juntaria as contas.
        if (mesas.some((m) => atual.ocupacoes.some((o) => o.mesaId === m.id))) {
          return atual;
        }

        return {
          ...atual,
          fila: atual.fila.filter((f) => f.id !== id),
          ocupacoes: [...atual.ocupacoes, ...ocupar(mesas, item.pessoas, desde, grupo)],
        };
      });
    },
    [aplicar]
  );

  /* ---------------------------------------------------------------- */
  /* Reservas                                                          */
  /* ---------------------------------------------------------------- */

  const reservar = useCallback(
    (dados: {
      nome: string;
      pessoas: number;
      para: string;
      cpf: string;
      telefone: string;
      observacao?: string;
    }) => {
      const nome = dados.nome.trim();
      if (!nome || dados.pessoas <= 0 || !dados.para) return;

      const id = `reserva-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      aplicar("gerenciarSalao", `marcar a reserva de ${nome}`, (atual) => ({
        ...atual,
        reservas: [
          ...atual.reservas,
          {
            id,
            nome,
            pessoas: dados.pessoas,
            para: dados.para,
            cpf: dados.cpf,
            telefone: dados.telefone,
            mesaIds: mesasParaReserva(atual.reservas, dados.pessoas, dados.para).map(
              (m) => m.id
            ),
            observacao: dados.observacao?.trim() || undefined,
          },
        ],
      }));
    },
    [aplicar]
  );

  const cancelarReserva = useCallback(
    (id: string) => {
      aplicar("gerenciarSalao", "cancelar reserva", (atual) =>
        atual.reservas.some((r) => r.id === id)
          ? { ...atual, reservas: atual.reservas.filter((r) => r.id !== id) }
          : atual
      );
    },
    [aplicar]
  );

  const sentarReserva = useCallback(
    (id: string) => {
      const desde = new Date().toISOString();
      const grupo = novoId("grupo");
      aplicar("gerenciarSalao", "sentar a reserva", (atual) => {
        const reserva = atual.reservas.find((r) => r.id === id);
        if (!reserva) return atual;

        const mesas = reserva.mesaIds
          .map((mesaId) => MESAS.find((m) => m.id === mesaId))
          .filter((m): m is Mesa => Boolean(m));
        if (mesas.length === 0) return atual;
        // Mesa já ocupada: sentar por cima apagaria o grupo e juntaria as contas.
        if (mesas.some((m) => atual.ocupacoes.some((o) => o.mesaId === m.id))) {
          return atual;
        }

        // Reserva de junção: o grupo se divide pelas mesas guardadas.
        return {
          ...atual,
          reservas: atual.reservas.filter((r) => r.id !== id),
          ocupacoes: [...atual.ocupacoes, ...ocupar(mesas, reserva.pessoas, desde, grupo)],
        };
      });
    },
    [aplicar]
  );

  /* ---------------------------------------------------------------- */
  /* Caixa                                                             */
  /* ---------------------------------------------------------------- */

  const fecharConta = useCallback(
    (mesaId: string, comServico = true, totalVisto?: number) => {
      const momento = new Date();
      const em = momento.toISOString();
      const contaId = `conta-${momento.getTime()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`;
      const operadorId = operador.id;
      const naHora = internoRef.current.atual;
      const mesasAgora = mesasDaConta(naHora.ocupacoes, mesaId);
      const quem = quemEstaNaMesa(naHora.ocupacoes, mesaId);
      const pedidosDaConta = (g: Guardado, mesaIds: string[]) =>
        g.pedidos
          .filter((p) => mesaIds.includes(p.mesaId))
          .map((p) => p.id)
          .sort()
          .join();
      const pedidosVistos = pedidosDaConta(naHora, mesasAgora);

      aplicar(
        "fecharConta",
        `fechar a conta ${mesasAgora.length > 1 ? "das" : "da"} ${nomeDasMesas(mesasAgora)}`,
        (atual) => {
          // Numa junção a conta é do grupo: as pessoas de todas as mesas, os
          // pedidos lançados em qualquer uma delas, o horário de quem sentou
          // primeiro. Mesa sozinha é a junção de uma mesa só.
          const juntas = ocupacoesDaJuncao(atual.ocupacoes, mesaId);
          const mesaIds = mesasDaConta(atual.ocupacoes, mesaId);
          const ocupacao = ocupacaoConjunta(juntas);
          const daConta = atual.pedidos.filter((p) => mesaIds.includes(p.mesaId));
          const conta = calcularConta(daConta, ocupacao, momento, comServico);

          // Refeita por cima de outra tela, a conta só fecha se ainda for a
          // que o caixa confirmou: o mesmo grupo, os mesmos pedidos e o mesmo
          // total. Se a cozinha soltou um prato ou o garçom lançou outro no
          // meio, não fecha — cai como "não entrou" e o caixa confere de novo.
          if (
            !quem ||
            quemEstaNaMesa(atual.ocupacoes, mesaId) !== quem ||
            pedidosDaConta(atual, mesaIds) !== pedidosVistos ||
            (totalVisto !== undefined && Math.abs(conta.total - totalVisto) > 0.005)
          ) {
            return atual;
          }

          const semAsMesas = {
            ocupacoes: atual.ocupacoes.filter((o) => !mesaIds.includes(o.mesaId)),
            pedidos: atual.pedidos.filter((p) => !mesaIds.includes(p.mesaId)),
          };

          // Mesa sem nada cobrável só volta ao salão — o que estava na
          // cozinha é cancelado junto.
          if (conta.itens.length === 0) {
            return { ...atual, ...semAsMesas };
          }

          const numeros = mesaIds.map((id) => MESAS.find((m) => m.id === id)?.numero ?? 0);
          const fechada: ContaFechada = {
            id: contaId,
            mesaId: mesaIds[0],
            mesaNumero: numeros[0],
            ...(mesaIds.length > 1 ? { mesasNumeros: numeros } : {}),
            pessoas: conta.pessoas,
            itens: conta.itens,
            subtotal: conta.subtotal,
            servico: conta.servico,
            total: conta.total,
            abertaEm: ocupacao?.desde ?? em,
            fechadaEm: em,
            minutosNaMesa: conta.minutosNaMesa,
            operadorId,
          };

          // A venda dá baixa de verdade no estoque — só do que foi cobrado.
          // O que o fechamento cancelou não baixa; se a cozinha já tinha
          // gastado ingrediente nele, isso é perda a registrar, não venda.
          const baixas = baixasDaConta(conta.itens, contaId, em).map((b) => ({
            ...b,
            operadorId,
          }));

          return {
            ...atual,
            ...semAsMesas,
            contasFechadas: [...atual.contasFechadas, fechada],
            movimentos: [...atual.movimentos, ...baixas],
          };
        }
      );
    },
    [aplicar, operador]
  );

  /* ---------------------------------------------------------------- */
  /* Estoque                                                           */
  /* ---------------------------------------------------------------- */

  const registrarEntrada = useCallback(
    (entrada: {
      ingredienteId: string;
      quantidade: number;
      validade: string;
      custoUnitario: number;
      fornecedor?: string;
    }) => {
      if (!entrada.ingredienteId || entrada.quantidade <= 0) return;

      const id = `entrada-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const em = new Date().toISOString();
      const operadorId = operador.id;

      aplicar("movimentarEstoque", `entrada de estoque`, (atual) => ({
        ...atual,
        movimentos: [
          ...atual.movimentos,
          {
            id,
            tipo: "entrada",
            ingredienteId: entrada.ingredienteId,
            quantidade: entrada.quantidade,
            em,
            validade: entrada.validade,
            custoUnitario: entrada.custoUnitario,
            fornecedor: entrada.fornecedor?.trim() || undefined,
            operadorId,
          },
        ],
      }));
    },
    [aplicar, operador]
  );

  const registrarPerda = useCallback(
    (ingredienteId: string, quantidade: number, motivo: string) => {
      if (!ingredienteId || quantidade <= 0) return;

      const id = `perda-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const em = new Date().toISOString();
      const operadorId = operador.id;

      aplicar("movimentarEstoque", `perda de estoque`, (atual) => ({
        ...atual,
        movimentos: [
          ...atual.movimentos,
          { id, tipo: "perda", ingredienteId, quantidade, em, motivo, operadorId },
        ],
      }));
    },
    [aplicar, operador]
  );

  /* ---------------------------------------------------------------- */
  /* Fechamento do dia                                                 */
  /* ---------------------------------------------------------------- */

  const fecharODia = useCallback(
    (registro: RegistroVenda) => {
      // As contas que o registro apurou. Uma conta fechada em outra tela
      // depois disso ficaria fora do histórico e ainda sumiria do caixa.
      const contadas = new Set(
        internoRef.current.atual.contasFechadas
          .filter((c) => dataLocal(c.fechadaEm) === registro.data)
          .map((c) => c.id)
      );

      aplicar("fecharODia", `fechar o dia ${dataLonga(registro.data)}`, (atual) => {
        // As contas do dia precisam ser exatamente as apuradas: nem uma a
        // mais (fechada depois), nem uma a menos (desfeita depois).
        const doDia = (c: ContaFechada) => dataLocal(c.fechadaEm) === registro.data;
        const doDiaAgora = atual.contasFechadas.filter(doDia);
        if (
          doDiaAgora.length !== contadas.size ||
          doDiaAgora.some((c) => !contadas.has(c.id))
        ) {
          return atual;
        }

        return {
          ...atual,
          // Refazer o fechamento substitui o registro daquela data.
          diasFechados: [
            ...atual.diasFechados.filter((d) => d.data !== registro.data),
            registro,
          ],
          // As contas do dia já viraram história: o caixa zera.
          contasFechadas: atual.contasFechadas.filter((c) => !doDia(c)),
        };
      });
    },
    [aplicar]
  );

  /* ---------------------------------------------------------------- */
  /* Cardápio                                                          */
  /* ---------------------------------------------------------------- */

  const mudarPreco = useCallback(
    (pratoId: string, preco: number) => {
      const valor = Math.round(preco * 100) / 100;
      if (!Number.isFinite(valor) || valor <= 0) return;

      aplicar(
        "editarCardapio",
        `mudar o preço de ${nomeDoPrato(pratoId)}`,
        (atual) =>
          precoDe(atual.cardapio, pratoId) === valor
            ? atual
            : {
                ...atual,
                cardapio: {
                  ...atual.cardapio,
                  [pratoId]: { ...atual.cardapio[pratoId], preco: valor },
                },
              }
      );
    },
    [aplicar]
  );

  const pausarPrato = useCallback(
    (pratoId: string, pausado: boolean) => {
      aplicar(
        "editarCardapio",
        pausado
          ? `pausar ${nomeDoPrato(pratoId)}`
          : `voltar ${nomeDoPrato(pratoId)} ao cardápio`,
        (atual) =>
          estaPausado(atual.cardapio, pratoId) === pausado
            ? atual
            : {
                ...atual,
                cardapio: {
                  ...atual.cardapio,
                  [pratoId]: { ...atual.cardapio[pratoId], pausado },
                },
              }
      );
    },
    [aplicar]
  );

  /* ---------------------------------------------------------------- */
  /* Cozinha                                                           */
  /* ---------------------------------------------------------------- */

  const mudarSituacao = useCallback(
    (pedidoId: string, situacao: SituacaoDoPedido) => {
      // A situação que a cozinha via ao tocar. Refeita por cima de outra tela,
      // a marcação só vale se o pedido ainda estiver nela: senão um "em
      // preparo" atrasado faria voltar para a fila um pedido já pronto.
      const vista = internoRef.current.atual.pedidos.find((p) => p.id === pedidoId)?.situacao;
      // Carimbado fora da mudança, como os ids: refeita por cima de outra
      // tela, ela marca o mesmo instante.
      const quando = new Date().toISOString();

      aplicar("tocarCozinha", `marcar pedido como ${situacao.replace("-", " ")}`, (atual) => {
        const alvo = atual.pedidos.find((p) => p.id === pedidoId);
        if (!alvo || alvo.situacao === situacao || alvo.situacao !== vista) return atual;
        return {
          ...atual,
          pedidos: atual.pedidos.map((p) =>
            p.id !== pedidoId
              ? p
              : situacao === "em-preparo"
                ? { ...p, situacao, iniciadoEm: quando }
                : { ...p, situacao }
          ),
        };
      });
    },
    [aplicar]
  );

  const cancelarPedido = useCallback(
    (pedidoId: string) => {
      aplicar("lancarPedido", "cancelar pedido", (atual) =>
        atual.pedidos.some((p) => p.id === pedidoId)
          ? { ...atual, pedidos: atual.pedidos.filter((p) => p.id !== pedidoId) }
          : atual
      );
    },
    [aplicar]
  );

  const reiniciarServico = useCallback(() => {
    // Montado fora da mudança, como os ids: refeita por cima de outra tela,
    // ela entrega o mesmo exemplo.
    const exemplo = servicoDeExemplo();
    aplicar("fecharODia", "reiniciar o serviço", () => exemplo);
  }, [aplicar]);

  /* ---------------------------------------------------------------- */

  // Só o dia entra na dependência: `agora` muda a cada 30 s. Antes de
  // carregar (agora = época zero), o deslocamento das validades dá 0.
  const hoje = dataLocal(agora);
  const lotes = useMemo(
    () => calcularLotes(interno.atual.movimentos, hoje),
    [interno.atual.movimentos, hoje]
  );
  const estoqueAtual = useMemo(() => comoItensDeEstoque(lotes, hoje), [lotes, hoje]);

  const valor = useMemo<Operacao>(
    () => ({
      ...interno.atual,
      agora,
      pronto,
      lotes,
      estoqueAtual,
      operador,
      trocarOperador,
      autorizado,
      // Quem não pode desfazer a última ação nem vê o botão.
      ultimoPasso: podeDesfazer ? ultimoPasso : null,
      desfazer,
      deFora: interno.deFora,
      dispensarAviso,
      sentar,
      sentarNaJuncao,
      liberar,
      lancarPedido,
      cancelarItem,
      entrarNaFila,
      sairDaFila,
      sentarDaFila,
      reservar,
      cancelarReserva,
      sentarReserva,
      fecharConta,
      registrarEntrada,
      registrarPerda,
      fecharODia,
      mudarSituacao,
      cancelarPedido,
      mudarPreco,
      pausarPrato,
      reiniciarServico,
    }),
    [
      interno,
      agora,
      pronto,
      lotes,
      estoqueAtual,
      operador,
      trocarOperador,
      autorizado,
      ultimoPasso,
      podeDesfazer,
      desfazer,
      dispensarAviso,
      sentar,
      sentarNaJuncao,
      liberar,
      lancarPedido,
      cancelarItem,
      entrarNaFila,
      sairDaFila,
      sentarDaFila,
      reservar,
      cancelarReserva,
      sentarReserva,
      fecharConta,
      registrarEntrada,
      registrarPerda,
      fecharODia,
      mudarSituacao,
      cancelarPedido,
      mudarPreco,
      pausarPrato,
      reiniciarServico,
    ]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useOperacao(): Operacao {
  const valor = useContext(Contexto);
  if (!valor) {
    throw new Error("useOperacao precisa estar dentro de ProvedorDeOperacao.");
  }
  return valor;
}

/** Só os pedidos que ainda interessam à cozinha e ao salão. */
export function pedidosAbertos(pedidos: Pedido[]): Pedido[] {
  return pedidos.filter((p) => p.situacao !== "entregue");
}
