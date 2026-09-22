/**
 * Feriados nacionais, detectados automaticamente a partir da data.
 *
 * O gerente não marca "é feriado": o sistema descobre sozinho. Os feriados
 * móveis (Carnaval, Sexta-feira Santa, Corpus Christi) são calculados a
 * partir da Páscoa, então valem para qualquer ano.
 */

const FIXOS: Record<string, string> = {
  "01-01": "Confraternização Universal",
  "04-21": "Tiradentes",
  "05-01": "Dia do Trabalho",
  "09-07": "Independência do Brasil",
  "10-12": "Nossa Senhora Aparecida",
  "11-02": "Finados",
  "11-15": "Proclamação da República",
  "11-20": "Consciência Negra",
  "12-25": "Natal",
};

/** Domingo de Páscoa pelo algoritmo de Meeus/Jones/Butcher. */
function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

const somarDias = (data: Date, dias: number) =>
  new Date(data.getTime() + dias * 86400000).toISOString().slice(0, 10);

/** Feriados móveis do ano, indexados pela data AAAA-MM-DD. */
function moveis(ano: number): Record<string, string> {
  const base = pascoa(ano);
  return {
    [somarDias(base, -48)]: "Carnaval (segunda)",
    [somarDias(base, -47)]: "Carnaval",
    [somarDias(base, -2)]: "Sexta-feira Santa",
    [somarDias(base, 60)]: "Corpus Christi",
  };
}

/** Nome do feriado nessa data, ou null se for dia comum. */
export function feriadoDe(dataIso: string): string | null {
  const ano = Number(dataIso.slice(0, 4));
  if (!Number.isFinite(ano)) return null;

  const fixo = FIXOS[dataIso.slice(5)];
  if (fixo) return fixo;

  return moveis(ano)[dataIso] ?? null;
}
