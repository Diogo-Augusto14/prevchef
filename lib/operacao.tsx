"use client";

/**
 * Estado do serviço: quem está sentado e o que foi pedido.
 *
 * Sem backend, o estado vive no navegador e é gravado no localStorage, para
 * sobreviver à troca de tela e ao recarregar. O relógio avança sozinho, então
 * as esperas e os tempos de mesa envelhecem enquanto a tela está aberta.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { MESAS } from "./restaurante";
import { calcularConta } from "./conta";
import { baixasDaConta, calcularLotes, comoItensDeEstoque } from "./estoque";
import { mesaParaReserva } from "./salao";
import type {
  ContaFechada,
  ItemEstoque,
  Lote,
  MovimentoDeEstoque,
  ItemDaFila,
  ItemDePedido,
  Ocupacao,
  Pedido,
  Reserva,
  SituacaoDoPedido,
} from "./tipos";

const CHAVE = "prevchef:operacao:v1";
const INTERVALO_DO_RELOGIO = 30_000;

type Guardado = {
  ocupacoes: Ocupacao[];
  pedidos: Pedido[];
  fila: ItemDaFila[];
  reservas: Reserva[];
  contasFechadas: ContaFechada[];
  movimentos: MovimentoDeEstoque[];
};

type Operacao = Guardado & {
  /** Lotes vivos, já com entradas, baixas e perdas aplicadas. */
  lotes: Lote[];
  /** O mesmo estoque no formato que as telas de previsão esperam. */
  estoqueAtual: ItemEstoque[];
  /** Instante de referência; avança sozinho. */
  agora: Date;
  /** Falso até o estado do navegador ser lido — evita divergência de hidratação. */
  pronto: boolean;
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
  mudarSituacao: (pedidoId: string, situacao: SituacaoDoPedido) => void;
  cancelarPedido: (pedidoId: string) => void;
  reiniciarServico: () => void;
};

const Contexto = createContext<Operacao | null>(null);

const minutosAtras = (minutos: number) =>
  new Date(Date.now() - minutos * 60000).toISOString();

const daquiA = (minutos: number) =>
  new Date(Date.now() + minutos * 60000).toISOString();

/** Um serviço em andamento, para a tela não abrir vazia. */
function servicoDeExemplo(): Guardado {
  const mesa = (numero: number) =>
    MESAS.find((m) => m.numero === numero)?.id ?? `mesa-${numero}`;

  return {
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
        // Daqui a 40 min: perto o bastante para já segurar a mesa.
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
    contasFechadas: [],
    movimentos: [],
  };
}

export function ProvedorDeOperacao({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Guardado>({
    ocupacoes: [],
    pedidos: [],
    fila: [],
    reservas: [],
    contasFechadas: [],
    movimentos: [],
  });
  const [pronto, setPronto] = useState(false);
  const [agora, setAgora] = useState(() => new Date(0));

  /* Lê o que estava guardado; na primeira visita, abre com um serviço em curso. */
  useEffect(() => {
    let inicial = servicoDeExemplo();

    try {
      const salvo = window.localStorage.getItem(CHAVE);
      if (salvo) {
        const lido = JSON.parse(salvo) as Guardado;
        if (Array.isArray(lido.ocupacoes) && Array.isArray(lido.pedidos)) {
          inicial = {
            ...lido,
            fila: Array.isArray(lido.fila) ? lido.fila : [],
            reservas: Array.isArray(lido.reservas) ? lido.reservas : [],
            contasFechadas: Array.isArray(lido.contasFechadas)
              ? lido.contasFechadas
              : [],
            movimentos: Array.isArray(lido.movimentos) ? lido.movimentos : [],
          };
        }
      }
    } catch {
      // localStorage bloqueado ou conteúdo inválido: segue com o exemplo.
    }

    setEstado(inicial);
    setAgora(new Date());
    setPronto(true);
  }, []);

  /* Relógio: as esperas envelhecem sem precisar recarregar. */
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), INTERVALO_DO_RELOGIO);
    return () => clearInterval(id);
  }, []);

  /* Grava a cada mudança. */
  useEffect(() => {
    if (!pronto) return;
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(estado));
    } catch {
      // Sem espaço ou sem permissão: o serviço continua só em memória.
    }
  }, [estado, pronto]);

  const sentar = useCallback((mesaId: string, pessoas: number) => {
    setEstado((atual) => ({
      ...atual,
      ocupacoes: [
        ...atual.ocupacoes.filter((o) => o.mesaId !== mesaId),
        { mesaId, pessoas, desde: new Date().toISOString() },
      ],
    }));
    setAgora(new Date());
  }, []);

  /** Liberar a mesa fecha a conta: os pedidos dela saem da cozinha. */
  const liberar = useCallback((mesaId: string) => {
    setEstado((atual) => ({
      ...atual,
      ocupacoes: atual.ocupacoes.filter((o) => o.mesaId !== mesaId),
      pedidos: atual.pedidos.map((p) =>
        p.mesaId === mesaId && p.situacao !== "entregue"
          ? { ...p, situacao: "entregue" as const }
          : p
      ),
    }));
    setAgora(new Date());
  }, []);

  const lancarPedido = useCallback((mesaId: string, itens: ItemDePedido[]) => {
    const validos = itens.filter((i) => i.quantidade > 0);
    if (validos.length === 0) return;

    setEstado((atual) => ({
      ...atual,
      pedidos: [
        ...atual.pedidos,
        {
          id: `pedido-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          mesaId,
          itens: validos,
          lancadoEm: new Date().toISOString(),
          situacao: "na-fila",
        },
      ],
    }));
    setAgora(new Date());
  }, []);

  const entrarNaFila = useCallback((nome: string, pessoas: number) => {
    const limpo = nome.trim();
    if (!limpo || pessoas <= 0) return;

    setEstado((atual) => ({
      ...atual,
      fila: [
        ...atual.fila,
        {
          id: `fila-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          nome: limpo,
          pessoas,
          desde: new Date().toISOString(),
        },
      ],
    }));
    setAgora(new Date());
  }, []);

  const sairDaFila = useCallback((id: string) => {
    setEstado((atual) => ({
      ...atual,
      fila: atual.fila.filter((f) => f.id !== id),
    }));
    setAgora(new Date());
  }, []);

  /** Senta o grupo e tira ele da fila num passo só. */
  const sentarDaFila = useCallback((id: string, mesaId: string) => {
    setEstado((atual) => {
      const item = atual.fila.find((f) => f.id === id);
      if (!item) return atual;

      return {
        ...atual,
        fila: atual.fila.filter((f) => f.id !== id),
        ocupacoes: [
          ...atual.ocupacoes.filter((o) => o.mesaId !== mesaId),
          { mesaId, pessoas: item.pessoas, desde: new Date().toISOString() },
        ],
      };
    });
    setAgora(new Date());
  }, []);

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

      setEstado((atual) => ({
        ...atual,
        reservas: [
          ...atual.reservas,
          {
            id: `reserva-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            nome,
            pessoas: dados.pessoas,
            para: dados.para,
            cpf: dados.cpf,
            telefone: dados.telefone,
            // A mesa é escolhida na hora de marcar, evitando choque de horário.
            mesaId:
              mesaParaReserva(atual.reservas, dados.pessoas, dados.para)?.id ?? null,
            observacao: dados.observacao?.trim() || undefined,
          },
        ],
      }));
      setAgora(new Date());
    },
    []
  );

  const cancelarReserva = useCallback((id: string) => {
    setEstado((atual) => ({
      ...atual,
      reservas: atual.reservas.filter((r) => r.id !== id),
    }));
    setAgora(new Date());
  }, []);

  /** Chegou quem reservou: senta na mesa guardada e a reserva se encerra. */
  const sentarReserva = useCallback((id: string) => {
    setEstado((atual) => {
      const reserva = atual.reservas.find((r) => r.id === id);
      if (!reserva?.mesaId) return atual;

      return {
        ...atual,
        reservas: atual.reservas.filter((r) => r.id !== id),
        ocupacoes: [
          ...atual.ocupacoes.filter((o) => o.mesaId !== reserva.mesaId),
          {
            mesaId: reserva.mesaId,
            pessoas: reserva.pessoas,
            desde: new Date().toISOString(),
          },
        ],
      };
    });
    setAgora(new Date());
  }, []);

  /* ---------------------------------------------------------------- */
  /* Fechamento de conta                                               */
  /* ---------------------------------------------------------------- */

  const fecharConta = useCallback((mesaId: string, comServico = true) => {
    const momento = new Date();

    setEstado((atual) => {
      const ocupacao = atual.ocupacoes.find((o) => o.mesaId === mesaId) ?? null;
      const mesa = MESAS.find((m) => m.id === mesaId);
      const daMesa = atual.pedidos.filter((p) => p.mesaId === mesaId);
      const conta = calcularConta(daMesa, ocupacao, momento, comServico);

      // Mesa que não consumiu nada só volta para o salão: não vira conta de
      // zero real inflando a contagem do caixa.
      if (conta.itens.length === 0) {
        return {
          ...atual,
          ocupacoes: atual.ocupacoes.filter((o) => o.mesaId !== mesaId),
          pedidos: atual.pedidos.filter((p) => p.mesaId !== mesaId),
        };
      }

      const fechada: ContaFechada = {
        id: `conta-${momento.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
        mesaId,
        mesaNumero: mesa?.numero ?? 0,
        pessoas: conta.pessoas,
        itens: conta.itens,
        subtotal: conta.subtotal,
        servico: conta.servico,
        total: conta.total,
        abertaEm: ocupacao?.desde ?? momento.toISOString(),
        fechadaEm: momento.toISOString(),
        minutosNaMesa: conta.minutosNaMesa,
      };

      // A venda dá baixa de verdade no estoque: sem isso o ingrediente
      // consumido voltaria para a câmara quando a conta fechasse.
      const consumidos = daMesa.flatMap((p) => p.itens);
      const baixas = baixasDaConta(consumidos, fechada.id, momento.toISOString());

      return {
        ...atual,
        // A mesa some dos pedidos abertos e volta para o salão.
        ocupacoes: atual.ocupacoes.filter((o) => o.mesaId !== mesaId),
        pedidos: atual.pedidos.filter((p) => p.mesaId !== mesaId),
        contasFechadas: [...atual.contasFechadas, fechada],
        movimentos: [...atual.movimentos, ...baixas],
      };
    });
    setAgora(momento);
  }, []);

  /* ---------------------------------------------------------------- */
  /* Estoque: entrada e perda                                          */
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

      setEstado((atual) => ({
        ...atual,
        movimentos: [
          ...atual.movimentos,
          {
            id: `entrada-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            tipo: "entrada",
            ingredienteId: entrada.ingredienteId,
            quantidade: entrada.quantidade,
            em: new Date().toISOString(),
            validade: entrada.validade,
            custoUnitario: entrada.custoUnitario,
            fornecedor: entrada.fornecedor?.trim() || undefined,
          },
        ],
      }));
      setAgora(new Date());
    },
    []
  );

  const registrarPerda = useCallback(
    (ingredienteId: string, quantidade: number, motivo: string) => {
      if (!ingredienteId || quantidade <= 0) return;

      setEstado((atual) => ({
        ...atual,
        movimentos: [
          ...atual.movimentos,
          {
            id: `perda-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            tipo: "perda",
            ingredienteId,
            quantidade,
            em: new Date().toISOString(),
            motivo,
          },
        ],
      }));
      setAgora(new Date());
    },
    []
  );

  const mudarSituacao = useCallback(
    (pedidoId: string, situacao: SituacaoDoPedido) => {
      setEstado((atual) => ({
        ...atual,
        pedidos: atual.pedidos.map((p) =>
          p.id === pedidoId ? { ...p, situacao } : p
        ),
      }));
      setAgora(new Date());
    },
    []
  );

  const cancelarPedido = useCallback((pedidoId: string) => {
    setEstado((atual) => ({
      ...atual,
      pedidos: atual.pedidos.filter((p) => p.id !== pedidoId),
    }));
    setAgora(new Date());
  }, []);

  const reiniciarServico = useCallback(() => {
    setEstado(servicoDeExemplo());
    setAgora(new Date());
  }, []);

  const lotes = useMemo(() => calcularLotes(estado.movimentos), [estado.movimentos]);
  const estoqueAtual = useMemo(() => comoItensDeEstoque(lotes), [lotes]);

  const valor = useMemo<Operacao>(
    () => ({
      ...estado,
      lotes,
      estoqueAtual,
      agora,
      pronto,
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
      mudarSituacao,
      cancelarPedido,
      reiniciarServico,
    }),
    [
      estado,
      lotes,
      estoqueAtual,
      agora,
      pronto,
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
