/**
 * Quem está operando o sistema.
 *
 * Sem isso não dá para responder "quem lançou essa perda de 8 kg?" nem
 * "quem fechou essa conta?". Num sistema que mexe com dinheiro e estoque,
 * ação sem dono é problema.
 *
 * O papel também limita o que a pessoa faz. Não é segurança de verdade —
 * qualquer um troca de operador na tela, não há senha. É separação de
 * função: evita o garçom fechar o caixa por engano, não evita má-fé.
 */

export type Papel = "gerente" | "caixa" | "garcom" | "cozinha";

export type Operador = {
  id: string;
  nome: string;
  papel: Papel;
};

export const EQUIPE: Operador[] = [
  { id: "op-1", nome: "Marta Nogueira", papel: "gerente" },
  { id: "op-2", nome: "Cláudio Reis", papel: "caixa" },
  { id: "op-3", nome: "Ivone Prado", papel: "garcom" },
  { id: "op-4", nome: "Sérgio Lemos", papel: "garcom" },
  { id: "op-5", nome: "Bruno Kato", papel: "cozinha" },
];

export const OPERADOR_PADRAO = EQUIPE[0];

export const NOME_DO_PAPEL: Record<Papel, string> = {
  gerente: "Gerente",
  caixa: "Caixa",
  garcom: "Salão",
  cozinha: "Cozinha",
};

/** O que cada ação exige. */
export type Permissao =
  | "lancarPedido"
  | "fecharConta"
  | "movimentarEstoque"
  | "gerenciarSalao"
  | "tocarCozinha"
  | "fecharODia";

const PERMISSOES: Record<Permissao, Papel[]> = {
  lancarPedido: ["gerente", "caixa", "garcom"],
  fecharConta: ["gerente", "caixa"],
  // Entrada e perda mexem no patrimônio: só o gerente lança.
  movimentarEstoque: ["gerente"],
  gerenciarSalao: ["gerente", "caixa", "garcom"],
  tocarCozinha: ["gerente", "cozinha"],
  fecharODia: ["gerente"],
};

export function pode(operador: Operador | null, permissao: Permissao): boolean {
  if (!operador) return false;
  return PERMISSOES[permissao].includes(operador.papel);
}

/** Frase pronta para a tela quando a ação é negada. */
export function motivoDaNegativa(
  operador: Operador | null,
  permissao: Permissao
): string {
  const quem = PERMISSOES[permissao].map((p) => NOME_DO_PAPEL[p]).join(" ou ");
  if (!operador) return `Escolha quem está operando. Só ${quem} pode fazer isso.`;
  return `${operador.nome} está como ${NOME_DO_PAPEL[operador.papel]}. Só ${quem} pode fazer isso.`;
}

export function operadorPorId(id: string): Operador | null {
  return EQUIPE.find((o) => o.id === id) ?? null;
}
