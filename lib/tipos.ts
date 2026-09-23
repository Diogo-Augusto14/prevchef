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
};

export type ItemDePedido = {
  pratoId: string;
  quantidade: number;
};

export type SituacaoDoPedido = "na-fila" | "em-preparo" | "pronto" | "entregue";

export type Pedido = {
  id: string;
  mesaId: string;
  itens: ItemDePedido[];
  /** Momento do lançamento, em ISO. */
  lancadoEm: string;
  situacao: SituacaoDoPedido;
};

/** Um grupo esperando mesa. */
export type ItemDaFila = {
  id: string;
  nome: string;
  pessoas: number;
  /** Momento em que entrou na fila, em ISO. */
  desde: string;
};
