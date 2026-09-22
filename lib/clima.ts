/**
 * Localização e clima real, buscados automaticamente.
 *
 * O painel tenta primeiro a localização do próprio dispositivo. Se o
 * navegador negar ou falhar, cai para uma cidade escolhida na lista.
 *
 * Duas APIs abertas, nenhuma pede chave:
 *   - Open-Meteo      → previsão do tempo
 *   - BigDataCloud    → nome do lugar a partir da coordenada
 *
 * Privacidade: a coordenada é arredondada para 2 casas (~1,1 km) ANTES de
 * sair do navegador. Nem a previsão nem o nome do lugar recebem a posição
 * exata, e a coordenada precisa nunca é guardada.
 *
 * Atenção: o clima é REAL; o histórico de vendas continua SIMULADO.
 */

export type Coordenadas = { latitude: number; longitude: number };

export type Local = Coordenadas & {
  nome: string;
  /** De onde veio: o aparelho do usuário ou a lista de cidades. */
  fonte: "dispositivo" | "cidade";
  fuso?: string;
};

export type Cidade = {
  id: string;
  nome: string;
  uf: string;
  latitude: number;
  longitude: number;
  fuso: string;
};

/** Lista de apoio, usada quando a localização do aparelho não está disponível. */
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

export const localDaCidade = (cidade: Cidade): Local => ({
  latitude: cidade.latitude,
  longitude: cidade.longitude,
  nome: `${cidade.nome}, ${cidade.uf}`,
  fonte: "cidade",
  fuso: cidade.fuso,
});

/* ------------------------------------------------------------------ */
/* Localização do dispositivo                                          */
/* ------------------------------------------------------------------ */

export type FalhaDeLocalizacao =
  | "sem-suporte"
  | "negada"
  | "indisponivel"
  | "demorou";

/** Corta a coordenada em 2 casas: ~1,1 km, o bastante para o clima. */
const arredondarCoordenada = (v: number) => Math.round(v * 100) / 100;

/**
 * Pede a posição ao navegador. O usuário vê o pedido de permissão do
 * próprio navegador — não há como obter isso sem o consentimento dele.
 */
export function localizacaoDoDispositivo(): Promise<Coordenadas> {
  return new Promise((resolver, rejeitar) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      rejeitar("sem-suporte" as FalhaDeLocalizacao);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (posicao) =>
        resolver({
          latitude: arredondarCoordenada(posicao.coords.latitude),
          longitude: arredondarCoordenada(posicao.coords.longitude),
        }),
      (erro) => {
        const falhas: Record<number, FalhaDeLocalizacao> = {
          1: "negada",
          2: "indisponivel",
          3: "demorou",
        };
        rejeitar(falhas[erro.code] ?? "indisponivel");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  });
}

export const MENSAGEM_DE_FALHA: Record<FalhaDeLocalizacao, string> = {
  "sem-suporte": "Este navegador não informa a localização.",
  negada: "Permissão de localização negada.",
  indisponivel: "O aparelho não conseguiu obter a posição.",
  demorou: "A localização demorou demais para responder.",
};

type RespostaGeocodificacao = {
  locality?: string;
  city?: string;
  principalSubdivisionCode?: string;
  principalSubdivision?: string;
  countryName?: string;
};

/** Nome legível do lugar. Se falhar, devolve a coordenada formatada. */
export async function nomeDoLugar(
  coords: Coordenadas,
  sinal?: AbortSignal
): Promise<string> {
  const formatada = `${coords.latitude.toFixed(2)}, ${coords.longitude.toFixed(2)}`;

  try {
    const resposta = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=pt`,
      { signal: sinal }
    );
    if (!resposta.ok) return formatada;

    const dados = (await resposta.json()) as RespostaGeocodificacao;
    const cidade = dados.locality || dados.city;
    const uf = (dados.principalSubdivisionCode || "").replace("BR-", "");

    if (!cidade) return dados.principalSubdivision || formatada;
    return uf ? `${cidade}, ${uf}` : cidade;
  } catch {
    return formatada;
  }
}

/** Junta posição e nome num Local pronto para a tela. */
export async function localDoDispositivo(sinal?: AbortSignal): Promise<Local> {
  const coords = await localizacaoDoDispositivo();
  return {
    ...coords,
    nome: await nomeDoLugar(coords, sinal),
    fonte: "dispositivo",
  };
}

/* ------------------------------------------------------------------ */
/* Previsão do tempo                                                   */
/* ------------------------------------------------------------------ */

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
 * Busca a previsão dos próximos dias para uma coordenada qualquer.
 * A Open-Meteo entrega até 16 dias; datas fora dessa janela não aparecem.
 */
export async function buscarPrevisao(
  local: Coordenadas & { fuso?: string },
  dias = 16,
  sinal?: AbortSignal
): Promise<PrevisaoDoTempo[]> {
  const parametros = new URLSearchParams({
    latitude: String(local.latitude),
    longitude: String(local.longitude),
    daily:
      "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
    // "auto" deixa a própria API resolver o fuso da coordenada.
    timezone: local.fuso ?? "auto",
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
