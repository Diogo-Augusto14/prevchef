/** Tipos compartilhados do PrevChef. Todos os dados são simulados. */

export type RegistroVenda = {
  /** Data no formato AAAA-MM-DD. */
  data: string;
  /** 0 = domingo ... 6 = sábado. */
  diaSemana: number;
  diaSemanaNome: string;
  /** Temperatura média do dia, em °C. */
  temperatura: number;
  chuva: boolean;
  feriado: boolean;
  /** Verdadeiro nos cinco primeiros dias do mês. */
  inicioMes: boolean;
  /** Porções vendidas por prato, indexadas pelo id do prato. */
  vendas: Record<string, number>;
  /** Pessoas que chegaram em cada hora de serviço, na ordem de `horasDeServico`. */
  chegadasPorHora: number[];
};

export type ArquivoVendas = {
  aviso: string;
  geradoEm: string;
  dias: number;
  registros: RegistroVenda[];
};

export type IngredienteDaFicha = {
  id: string;
  nome: string;
  unidade: string;
  /** Quantidade consumida por porção do prato. */
  quantidadePorPorcao: number;
};

export type Prato = {
  id: string;
  nome: string;
  precoVenda: number;
  /** Minutos que a porção leva no posto, do pedido ao prato pronto. */
  tempoPreparoMinutos: number;
  /** Posto da cozinha que executa o prato. */
  estacao: string;
  ingredientes: IngredienteDaFicha[];
};

export type ItemEstoque = {
  id: string;
  nome: string;
  unidade: string;
  quantidade: number;
  /** Data de validade no formato AAAA-MM-DD. */
  validade: string;
  custoUnitario: number;
};

/** Condições do dia que se quer prever. */
export type Cenario = {
  diaSemana: number;
  temperatura: number;
  chuva: boolean;
  feriado: boolean;
  inicioMes: boolean;
};

/* ------------------------------------------------------------------ */
/* Operação do salão e da cozinha                                      */
/* ------------------------------------------------------------------ */

export type Mesa = {
  id: string;
  numero: number;
  lugares: number;
  area: string;
};

export type Estacao = {
  id: string;
  nome: string;
  /** Quantas porções o posto toca ao mesmo tempo. */
  capacidade: number;
};

export type ArquivoRestaurante = {
  tempoMedioDeRefeicaoMinutos: number;
  horasDeServico: number[];
  estacoes: Estacao[];
  mesas: Mesa[];
};

/** Uma mesa ocupada agora. */
export type Ocupacao = {
  mesaId: string;
  pessoas: number;
  /** Momento em que sentaram, em ISO. */
  desde: string;
  /**
   * Mesas juntadas para um grupo só levam o mesmo valor aqui e fecham numa
   * conta única. Mesa sozinha não tem.
   */
  grupo?: string;
};

export type ItemDePedido = {
  pratoId: string;
  quantidade: number;
  /** Preço combinado na hora do lançamento. Mudar o preço depois não mexe aqui. */
  precoUnitario?: number;
};

export type SituacaoDoPedido = "na-fila" | "em-preparo" | "pronto" | "entregue";

export type Pedido = {
  id: string;
  mesaId: string;
  itens: ItemDePedido[];
  /** Momento do lançamento, em ISO. */
  lancadoEm: string;
  situacao: SituacaoDoPedido;
  /**
   * Quando a cozinha tocou "Iniciar", em ISO. É o que faz o pedido em preparo
   * descontar o tempo que já passou no fogo. Pedido gravado antes deste campo
   * não tem: conta como se tivesse começado agora.
   */
  iniciadoEm?: string;
  /** Quem lançou. */
  operadorId?: string;
};

/** Um grupo esperando mesa. */
export type ItemDaFila = {
  id: string;
  nome: string;
  pessoas: number;
  /** Momento em que entrou na fila, em ISO. */
  desde: string;
};

/** Uma mesa marcada para um horário. */
export type Reserva = {
  id: string;
  nome: string;
  pessoas: number;
  /** Horário marcado, em ISO. */
  para: string;
  /** Mesas designadas na hora de marcar — uma só ou uma junção. Vazio = sem mesa. */
  mesaIds: string[];
  /** Só os 11 dígitos. A tela mostra mascarado. */
  cpf: string;
  telefone: string;
  observacao?: string;
  /** Marcada quando o horário passou da tolerância e ninguém apareceu. */
  naoCompareceu?: boolean;
};

export type ItemDaConta = {
  pratoId: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  total: number;
};

/** Conta de uma mesa, já fechada. */
export type ContaFechada = {
  id: string;
  mesaId: string;
  mesaNumero: number;
  /** Numa junção, todas as mesas que a conta cobriu, em ordem de número. */
  mesasNumeros?: number[];
  pessoas: number;
  itens: ItemDaConta[];
  subtotal: number;
  servico: number;
  total: number;
  /** Momento em que a mesa sentou e em que a conta fechou, em ISO. */
  abertaEm: string;
  fechadaEm: string;
  minutosNaMesa: number;
  /** Quem fechou. */
  operadorId?: string;
};

/* ------------------------------------------------------------------ */
/* Cardápio do dia                                                     */
/* ------------------------------------------------------------------ */

/** O que o gerente mudou na operação, por cima da ficha do arquivo. */
export type AjusteDePrato = {
  /** Preço de venda de hoje, quando difere do arquivo. */
  preco?: number;
  /** Tirado da venda pelo gerente — não é falta de estoque. */
  pausado?: boolean;
};

/** Por id do prato. Prato sem entrada segue a ficha do arquivo. */
export type AjustesDoCardapio = Record<string, AjusteDePrato>;

/* ------------------------------------------------------------------ */
/* Estoque como razão de movimentos                                    */
/* ------------------------------------------------------------------ */

/** Um lote na câmara: validade e custo são do lote, não do ingrediente. */
export type Lote = {
  id: string;
  ingredienteId: string;
  quantidade: number;
  validade: string;
  custoUnitario: number;
  /** Vazio no lote inicial. */
  entradaEm: string;
  origem: "inicial" | "compra";
};

export type TipoDeMovimento = "entrada" | "baixa" | "perda";

export type MovimentoDeEstoque = {
  id: string;
  tipo: TipoDeMovimento;
  ingredienteId: string;
  /** Sempre positivo: o tipo diz o sentido. */
  quantidade: number;
  em: string;
  /** Só em entrada. */
  validade?: string;
  custoUnitario?: number;
  fornecedor?: string;
  /** Só em perda. */
  motivo?: string;
  /** Conta que gerou a baixa. */
  contaId?: string;
  /** Quem lançou o movimento. */
  operadorId?: string;
};
