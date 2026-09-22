/**
 * Clima real, buscado automaticamente na Open-Meteo.
 *
 * A Open-Meteo é aberta e não pede chave de API, então a busca acontece
 * direto do navegador, sem passar por servidor. O painel usa isso para
 * preencher temperatura e chuva sozinho, sem o gerente digitar nada.
 *
 * Atenção: o clima é REAL; o histórico de vendas continua SIMULADO.
 */

export type Cidade = {
  id: string;
  nome: string;
  uf: string;
  latitude: number;
  longitude: number;
  fuso: string;
};

export const CIDADES: Cidade[] = [
  { id: "sao-paulo", nome: "São Paulo", uf: "SP", latitude: -23.5505, longitude: -46.6333, fuso: "America/Sao_Paulo" },
  { id: "rio-de-janeiro", nome: "Rio de Janeiro", uf: "RJ", latitude: -22.9068, longitude: -43.1729, fuso: "America/Sao_Paulo" },
  { id: "belo-horizonte", nome: "Belo Horizonte", uf: "MG", latitude: -19.9167, longitude: -43.9345, fuso: "America/Sao_Paulo" },
  { id: "curitiba", nome: "Curitiba", uf: "PR", latitude: -25.4284, longitude: -49.2733, fuso: "America/Sao_Paulo" },
  { id: "porto-alegre", nome: "Porto Alegre", uf: "RS", latitude: -30.0346, longitude: -51.2177, fuso: "America/Sao_Paulo" },
  { id: "brasilia", nome: "Brasília", uf: "DF", latitude: -15.7939, longitude: -47.8828, fuso: "America/Sao_Paulo" },
  { id: "salvador", nome: "Salvador", uf: "BA", latitude: -12.9777, longitude: -38.5016, fuso: "America/Bahia" },
  { id: "recife", nome: "Recife", uf: "PE", latitude: -8.0476, longitude: -34.877, fuso: "America/Recife" },
];

export const CIDADE_PADRAO = CIDADES[0];

export type PrevisaoDoTempo = {
  data: string;
  temperaturaMaxima: number;
  temperaturaMinima: number;
  /** Média entre máxima e mínima — é o valor que entra no modelo. */
  temperatura: number;
  chuvaMm: number;
  chanceDeChuva: number;
  /** Consideramos "dia de chuva" acima dos limites definidos abaixo. */
  chuva: boolean;
};

/** A partir de quando o dia conta como chuvoso para o modelo. */
const CHANCE_MINIMA_DE_CHUVA = 55;
const MILIMETROS_MINIMOS = 1;

const URL_BASE = "https://api.open-meteo.com/v1/forecast";

type RespostaOpenMeteo = {
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    precipitation_probability_max?: number[];
  };
};

const arredondar = (v: number) => Math.round(v * 10) / 10;

/**
 * Busca a previsão dos próximos dias. A Open-Meteo entrega até 16 dias;
 * datas fora dessa janela simplesmente não aparecem no resultado.
 */
export async function buscarPrevisao(
  cidade: Cidade,
  dias = 16,
  sinal?: AbortSignal
): Promise<PrevisaoDoTempo[]> {
  const parametros = new URLSearchParams({
    latitude: String(cidade.latitude),
    longitude: String(cidade.longitude),
    daily:
      "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
    timezone: cidade.fuso,
    forecast_days: String(Math.min(16, Math.max(1, dias))),
  });

  const resposta = await fetch(`${URL_BASE}?${parametros}`, { signal: sinal });
  if (!resposta.ok) {
    throw new Error(`Open-Meteo respondeu ${resposta.status}`);
  }

  const dados = (await resposta.json()) as RespostaOpenMeteo;
  const diario = dados.daily;
  if (!diario?.time) return [];

  return diario.time.map((data, i) => {
    const maxima = diario.temperature_2m_max?.[i] ?? 0;
    const minima = diario.temperature_2m_min?.[i] ?? 0;
    const chuvaMm = diario.precipitation_sum?.[i] ?? 0;
    const chance = diario.precipitation_probability_max?.[i] ?? 0;

    return {
      data,
      temperaturaMaxima: arredondar(maxima),
      temperaturaMinima: arredondar(minima),
      temperatura: arredondar((maxima + minima) / 2),
      chuvaMm: arredondar(chuvaMm),
      chanceDeChuva: Math.round(chance),
      chuva: chance >= CHANCE_MINIMA_DE_CHUVA || chuvaMm >= MILIMETROS_MINIMOS,
    };
  });
}

/** Classifica a temperatura nas faixas que o painel mostra. */
export function faixaDeClima(temperatura: number): "frio" | "ameno" | "quente" {
  if (temperatura < 19) return "frio";
  if (temperatura > 26) return "quente";
  return "ameno";
}

export function rotuloDoClima(temperatura: number): string {
  return { frio: "Frio", ameno: "Ameno", quente: "Quente" }[
    faixaDeClima(temperatura)
  ];
}
