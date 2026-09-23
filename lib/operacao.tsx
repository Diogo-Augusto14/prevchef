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
 * 3. Sem backend, tudo mora no localStorage do navegador.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import { MESAS } from "./restaurante";
import { calcularConta } from "./conta";
import { baixasDaConta, calcularLotes, comoItensDeEstoque } from "./estoque";
import { mesaParaReserva } from "./salao";
import {
  OPERADOR_PADRAO,
  operadorPorId,
  pode,
  type Operador,
  type Permissao,
} from "./equipe";
import type {
  ContaFechada,
  ItemDaFila,
  ItemDePedido,
  ItemEstoque,
  Lote,
  MovimentoDeEstoque,
  Ocupacao,
  Pedido,
  RegistroVenda,
  Reserva,
  SituacaoDoPedido,
} from "./tipos";

const CHAVE = "prevchef:operacao:v2";
const INTERVALO_DO_RELOGIO = 30_000;
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
};

type Passo = { rotulo: string; estado: Guardado; em: string };
type Interno = { atual: Guardado; pilha: Passo[] };

type Acao =
  | { tipo: "carregar"; estado: Guardado }
  | { tipo: "aplicar"; rotulo: string; em: string; mudanca: (g: Guardado) => Guardado }
  | { tipo: "desfazer" };

/** Redutor puro: mesma entrada, mesma saída, quantas vezes rodar. */
function reduzir(interno: Interno, acao: Acao): Interno {
  switch (acao.tipo) {
    case "carregar":
      return { atual: acao.estado, pilha: [] };

    case "aplicar": {
      const proximo = acao.mudanca(interno.atual);
      if (proximo === interno.atual) return interno;

      return {
        atual: proximo,
        pilha: [
          ...interno.pilha.slice(-(PASSOS_GUARDADOS - 1)),
          { rotulo: acao.rotulo, estado: interno.atual, em: acao.em },
        ],
      };
    }

    case "desfazer": {
      const ultimo = interno.pilha[interno.pilha.length - 1];
      if (!ultimo) return interno;
      return { atual: ultimo.estado, pilha: interno.pilha.slice(0, -1) };
    }
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

  sentar: (mesaId: string, pessoas: number) => void;
  liberar: (mesaId: string) => void;
  lancarPedido: (mesaId: string, itens: ItemDePedido[]) => void;
  entrarNaFila: (nome: string, pessoas: number) => void;
  sairDaFila: (id: string) => void;
  sentarDaFila: (id: string, mesaId: string) => void;
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
  fecharConta: (mesaId: string, comServico?: boolean) => void;
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
};

const minutosAtras = (minutos: number) =>
  new Date(Date.now() - minutos * 60000).toISOString();

const daquiA = (minutos: number) =>
  new Date(Date.now() + minutos * 60000).toISOString();

const numeroDaMesa = (mesaId: string) =>
  MESAS.find((m) => m.id === mesaId)?.numero ?? "?";

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
        mesaId: mesa(12),
        cpf: "52998224725",
        telefone: "11987654321",
        observacao: "aniversário",
      },
      {
        id: "reserva-exemplo-2",
        nome: "Salgado",
        pessoas: 4,
        para: daquiA(150),
        mesaId: mesa(9),
        cpf: "11144477735",
        telefone: "11912345678",
      },
    ],
  };
}

export function ProvedorDeOperacao({ children }: { children: ReactNode }) {
  const [interno, despachar] = useReducer(reduzir, { atual: VAZIO, pilha: [] });
  const [operador, setOperador] = useState<Operador>(OPERADOR_PADRAO);
  const [pronto, setPronto] = useState(false);
  const [agora, setAgora] = useState(() => new Date(0));

  /* Lê o que estava guardado; na primeira visita, abre com um serviço em curso. */
  useEffect(() => {
    let inicial = servicoDeExemplo();

    try {
      const salvo = window.localStorage.getItem(CHAVE);
      if (salvo) {
        const lido = JSON.parse(salvo) as Guardado & { operadorId?: string };
        if (Array.isArray(lido.ocupacoes) && Array.isArray(lido.pedidos)) {
          inicial = {
            ocupacoes: lido.ocupacoes,
            pedidos: lido.pedidos,
            fila: lido.fila ?? [],
            reservas: lido.reservas ?? [],
            contasFechadas: lido.contasFechadas ?? [],
            movimentos: lido.movimentos ?? [],
            diasFechados: lido.diasFechados ?? [],
          };
        }
        const guardado = operadorPorId(lido.operadorId ?? "");
        if (guardado) setOperador(guardado);
      }
    } catch {
      // localStorage bloqueado ou conteúdo inválido: segue com o exemplo.
    }

    despachar({ tipo: "carregar", estado: inicial });
    setAgora(new Date());
    setPronto(true);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), INTERVALO_DO_RELOGIO);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!pronto) return;
    try {
      window.localStorage.setItem(
        CHAVE,
        JSON.stringify({ ...interno.atual, operadorId: operador.id })
      );
    } catch {
      // Sem espaço ou sem permissão: o serviço continua só em memória.
    }
  }, [interno.atual, operador, pronto]);

  /**
   * Todo caminho de escrita passa por aqui: confere a permissão, empilha o
   * estado anterior com um rótulo e aplica a mudança.
   */
  const aplicar = useCallback(
    (permissao: Permissao, rotulo: string, mudanca: (g: Guardado) => Guardado) => {
      if (!pode(operador, permissao)) return;
      despachar({ tipo: "aplicar", rotulo, em: new Date().toISOString(), mudanca });
      setAgora(new Date());
    },
    [operador]
  );

  const desfazer = useCallback(() => {
    despachar({ tipo: "desfazer" });
    setAgora(new Date());
  }, []);

  const trocarOperador = useCallback((id: string) => {
    const achado = operadorPorId(id);
    if (achado) setOperador(achado);
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
        (atual) => ({
          ...atual,
          ocupacoes: [
            ...atual.ocupacoes.filter((o) => o.mesaId !== mesaId),
            { mesaId, pessoas, desde },
          ],
        })
      );
    },
    [aplicar]
  );

  const liberar = useCallback(
    (mesaId: string) => {
      aplicar("gerenciarSalao", `liberar a mesa ${numeroDaMesa(mesaId)}`, (atual) => ({
        ...atual,
        ocupacoes: atual.ocupacoes.filter((o) => o.mesaId !== mesaId),
        pedidos: atual.pedidos.map((p) =>
          p.mesaId === mesaId && p.situacao !== "entregue"
            ? { ...p, situacao: "entregue" as const }
            : p
        ),
      }));
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

      aplicar(
        "lancarPedido",
        `lançar ${total} ${total > 1 ? "itens" : "item"} na mesa ${numeroDaMesa(mesaId)}`,
        (atual) => ({
          ...atual,
          pedidos: [
            ...atual.pedidos,
            { id, mesaId, itens: validos, lancadoEm, situacao: "na-fila", operadorId },
          ],
        })
      );
    },
    [aplicar, operador]
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
      aplicar("gerenciarSalao", "tirar da fila", (atual) => ({
        ...atual,
        fila: atual.fila.filter((f) => f.id !== id),
      }));
    },
    [aplicar]
  );

  const sentarDaFila = useCallback(
    (id: string, mesaId: string) => {
      const desde = new Date().toISOString();
      aplicar(
        "gerenciarSalao",
        `sentar a fila na mesa ${numeroDaMesa(mesaId)}`,
        (atual) => {
          const item = atual.fila.find((f) => f.id === id);
          if (!item) return atual;

          return {
            ...atual,
            fila: atual.fila.filter((f) => f.id !== id),
            ocupacoes: [
              ...atual.ocupacoes.filter((o) => o.mesaId !== mesaId),
              { mesaId, pessoas: item.pessoas, desde },
            ],
          };
        }
      );
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
            mesaId:
              mesaParaReserva(atual.reservas, dados.pessoas, dados.para)?.id ?? null,
            observacao: dados.observacao?.trim() || undefined,
          },
        ],
      }));
    },
    [aplicar]
  );

  const cancelarReserva = useCallback(
    (id: string) => {
      aplicar("gerenciarSalao", "cancelar reserva", (atual) => ({
        ...atual,
        reservas: atual.reservas.filter((r) => r.id !== id),
      }));
    },
    [aplicar]
  );

  const sentarReserva = useCallback(
    (id: string) => {
      const desde = new Date().toISOString();
      aplicar("gerenciarSalao", "sentar a reserva", (atual) => {
        const reserva = atual.reservas.find((r) => r.id === id);
        if (!reserva?.mesaId) return atual;

        return {
          ...atual,
          reservas: atual.reservas.filter((r) => r.id !== id),
          ocupacoes: [
            ...atual.ocupacoes.filter((o) => o.mesaId !== reserva.mesaId),
            { mesaId: reserva.mesaId, pessoas: reserva.pessoas, desde },
          ],
        };
      });
    },
    [aplicar]
  );

  /* ---------------------------------------------------------------- */
  /* Caixa                                                             */
  /* ---------------------------------------------------------------- */

  const fecharConta = useCallback(
    (mesaId: string, comServico = true) => {
      const momento = new Date();
      const em = momento.toISOString();
      const contaId = `conta-${momento.getTime()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`;
      const operadorId = operador.id;

      aplicar(
        "fecharConta",
        `fechar a conta da mesa ${numeroDaMesa(mesaId)}`,
        (atual) => {
          const ocupacao = atual.ocupacoes.find((o) => o.mesaId === mesaId) ?? null;
          const mesa = MESAS.find((m) => m.id === mesaId);
          const daMesa = atual.pedidos.filter((p) => p.mesaId === mesaId);
          const conta = calcularConta(daMesa, ocupacao, momento, comServico);

          // Mesa que não consumiu nada só volta ao salão.
          if (conta.itens.length === 0) {
            return {
              ...atual,
              ocupacoes: atual.ocupacoes.filter((o) => o.mesaId !== mesaId),
              pedidos: atual.pedidos.filter((p) => p.mesaId !== mesaId),
            };
          }

          const fechada: ContaFechada = {
            id: contaId,
            mesaId,
            mesaNumero: mesa?.numero ?? 0,
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

          // A venda dá baixa de verdade no estoque.
          const baixas = baixasDaConta(
            daMesa.flatMap((p) => p.itens),
            contaId,
            em
          ).map((b) => ({ ...b, operadorId }));

          return {
            ...atual,
            ocupacoes: atual.ocupacoes.filter((o) => o.mesaId !== mesaId),
            pedidos: atual.pedidos.filter((p) => p.mesaId !== mesaId),
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
      aplicar("fecharODia", `fechar o dia ${registro.data}`, (atual) => ({
        ...atual,
        // Refazer o fechamento substitui o registro daquela data.
        diasFechados: [
          ...atual.diasFechados.filter((d) => d.data !== registro.data),
          registro,
        ],
        // As contas do dia já viraram história: o caixa zera.
        contasFechadas: atual.contasFechadas.filter(
          (c) => c.fechadaEm.slice(0, 10) !== registro.data
        ),
      }));
    },
    [aplicar]
  );

  /* ---------------------------------------------------------------- */
  /* Cozinha                                                           */
  /* ---------------------------------------------------------------- */

  const mudarSituacao = useCallback(
    (pedidoId: string, situacao: SituacaoDoPedido) => {
      aplicar("tocarCozinha", `marcar pedido como ${situacao}`, (atual) => ({
        ...atual,
        pedidos: atual.pedidos.map((p) =>
          p.id === pedidoId ? { ...p, situacao } : p
        ),
      }));
    },
    [aplicar]
  );

  const cancelarPedido = useCallback(
    (pedidoId: string) => {
      aplicar("lancarPedido", "cancelar pedido", (atual) => ({
        ...atual,
        pedidos: atual.pedidos.filter((p) => p.id !== pedidoId),
      }));
    },
    [aplicar]
  );

  const reiniciarServico = useCallback(() => {
    aplicar("fecharODia", "reiniciar o serviço", () => servicoDeExemplo());
  }, [aplicar]);

  /* ---------------------------------------------------------------- */

  const lotes = useMemo(
    () => calcularLotes(interno.atual.movimentos),
    [interno.atual.movimentos]
  );
  const estoqueAtual = useMemo(() => comoItensDeEstoque(lotes), [lotes]);

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
      ultimoPasso: interno.pilha[interno.pilha.length - 1] ?? null,
      desfazer,
      sentar,
      liberar,
      lancarPedido,
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
      desfazer,
      sentar,
      liberar,
      lancarPedido,
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
