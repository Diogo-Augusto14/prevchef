/**
 * CPF: formatação e validação pelos dígitos verificadores.
 *
 * Não é conferência na Receita — é a checagem matemática que o próprio
 * número carrega. Ela pega erro de digitação, que é o caso comum na
 * recepção, e recusa as sequências repetidas (111.111.111-11).
 *
 * Um CPF inventado no balcão pode passar aqui se por acaso fechar a conta.
 * O que isso resolve é o telefone trocado e o dígito errado, não fraude.
 */

/** Só os números, no máximo 11. */
export function apenasDigitos(valor: string, maximo = 11): string {
  return valor.replace(/\D/g, "").slice(0, maximo);
}

/** 12345678909 -> 123.456.789-09, formatando enquanto digita. */
export function formatarCpf(valor: string): string {
  const d = apenasDigitos(valor);

  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Calcula um dígito verificador sobre os primeiros `ate` números. */
function digitoVerificador(numeros: number[], ate: number): number {
  let soma = 0;
  let peso = ate + 1;

  for (let i = 0; i < ate; i++) {
    soma += numeros[i] * peso;
    peso--;
  }

  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

export function cpfValido(valor: string): boolean {
  const d = apenasDigitos(valor);
  if (d.length !== 11) return false;

  // 000.000.000-00, 111.111.111-11 e afins fecham a conta, mas não existem.
  if (/^(\d)\1{10}$/.test(d)) return false;

  const numeros = d.split("").map(Number);
  return (
    digitoVerificador(numeros, 9) === numeros[9] &&
    digitoVerificador(numeros, 10) === numeros[10]
  );
}

/**
 * Esconde o miolo do CPF na tela: 123.456.789-09 -> ***.***.789-09.
 *
 * O número inteiro fica guardado para identificar quem reservou, mas a
 * recepção não precisa dele à vista o tempo todo, e uma tela de salão é
 * vista por muita gente.
 */
export function cpfMascarado(valor: string): string {
  const d = apenasDigitos(valor);
  if (d.length !== 11) return formatarCpf(valor);
  return `***.***.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** (11) 98765-4321 */
export function formatarTelefone(valor: string): string {
  const d = apenasDigitos(valor, 11);

  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function telefoneValido(valor: string): boolean {
  const d = apenasDigitos(valor, 11);
  return d.length === 10 || d.length === 11;
}
