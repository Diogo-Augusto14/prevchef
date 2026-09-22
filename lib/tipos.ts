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
