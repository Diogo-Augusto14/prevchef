/**
 * PrevChef — gerador de dados SIMULADOS.
 *
 * Gera 1 ano de vendas diárias fictícias para 5 pratos e grava:
 *   data/vendas.json   -> histórico diário (clima, feriado, início do mês, vendas)
 *   data/pratos.json   -> ficha técnica (ingredientes por porção)
 *   data/estoque.json  -> quantidade em estoque e validade
 *
 * Nenhum dado real de restaurante é usado aqui.
 *
 * Uso: npm run dados
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PASTA_DADOS = join(RAIZ, "data");

const DIAS = 365;
const SEMENTE = 20260921;

/* ------------------------------------------------------------------ */
/* Aleatoriedade com semente (resultado reproduzível)                   */
/* ------------------------------------------------------------------ */

function criarRandom(semente) {
  let a = semente >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = criarRandom(SEMENTE);

/** Ruído gaussiano (Box-Muller). */
function ruido(desvio) {
  const u1 = Math.max(random(), 1e-9);
  const u2 = random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * desvio;
}

/* ------------------------------------------------------------------ */
/* Calendário                                                          */
/* ------------------------------------------------------------------ */

const NOMES_DIAS = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];

// Feriados nacionais aproximados (mês-dia). Suficiente para um protótipo.
const FERIADOS = new Set([
  "01-01",
  "02-16",
  "02-17",
  "04-03",
  "04-21",
  "05-01",
  "06-04",
  "09-07",
  "10-12",
  "11-02",
  "11-15",
  "11-20",
  "12-24",
  "12-25",
  "12-31",
]);

function iso(data) {
  return data.toISOString().slice(0, 10);
}

/** Data local (do relógio da máquina) em AAAA-MM-DD. */
function isoLocal(data = new Date()) {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

function diaDoAno(data) {
  const inicio = Date.UTC(data.getUTCFullYear(), 0, 1);
  return Math.floor((data.getTime() - inicio) / 86400000) + 1;
}

/* ------------------------------------------------------------------ */
/* Clima simulado (hemisfério sul: verão em janeiro)                    */
/* ------------------------------------------------------------------ */

function temperaturaDoDia(data) {
  const d = diaDoAno(data);
  const media = 23 + 6 * Math.cos((2 * Math.PI * (d - 15)) / 365);
  return Math.round((media + ruido(2.6)) * 10) / 10;
}

function choveuNoDia(temperatura) {
  // Mais chuva no calor (verão chuvoso), menos no frio seco.
  const p = Math.min(0.55, Math.max(0.08, 0.1 + (temperatura - 16) * 0.022));
  return random() < p;
}

/* ------------------------------------------------------------------ */
/* Ficha técnica dos pratos                                            */
/* ------------------------------------------------------------------ */

const INGREDIENTES = {
  "feijao-preto": { nome: "Feijão preto", unidade: "kg" },
  "carne-seca": { nome: "Carne seca", unidade: "kg" },
  linguica: { nome: "Linguiça calabresa", unidade: "kg" },
  bacon: { nome: "Bacon", unidade: "kg" },
  arroz: { nome: "Arroz", unidade: "kg" },
  couve: { nome: "Couve", unidade: "kg" },
  laranja: { nome: "Laranja", unidade: "kg" },
  batata: { nome: "Batata", unidade: "kg" },
  cebola: { nome: "Cebola", unidade: "kg" },
  alho: { nome: "Alho", unidade: "kg" },
  azeite: { nome: "Azeite", unidade: "L" },
  alface: { nome: "Alface", unidade: "kg" },
  tomate: { nome: "Tomate", unidade: "kg" },
  cenoura: { nome: "Cenoura", unidade: "kg" },
  pepino: { nome: "Pepino", unidade: "kg" },
  "queijo-branco": { nome: "Queijo branco", unidade: "kg" },
  "file-frango": { nome: "Filé de frango", unidade: "kg" },
  mussarela: { nome: "Queijo mussarela", unidade: "kg" },
  "molho-tomate": { nome: "Molho de tomate", unidade: "kg" },
  "farinha-rosca": { nome: "Farinha de rosca", unidade: "kg" },
  ovo: { nome: "Ovo", unidade: "un" },
  "feijao-carioca": { nome: "Feijão carioca", unidade: "kg" },
};

/**
 * Tempo de preparo e posto da cozinha, por prato.
 *
 * O tempo é o da porção saindo do posto: a feijoada cozinha em panelão desde
 * cedo, então a porção só monta; a parmegiana empana, frita e gratina na hora.
 * É essa diferença que faz a fila da cozinha ter o que ordenar.
 */
const PREPARO = {
  feijoada: { tempoPreparoMinutos: 10, estacao: "fogao" },
  "caldo-verde": { tempoPreparoMinutos: 6, estacao: "fogao" },
  salada: { tempoPreparoMinutos: 5, estacao: "frio" },
  parmegiana: { tempoPreparoMinutos: 22, estacao: "fritura" },
  "frango-grelhado": { tempoPreparoMinutos: 16, estacao: "grelha" },
};

/** Postos da cozinha e quantas porções cada um toca ao mesmo tempo. */
const ESTACOES = [
  { id: "fogao", nome: "Fogão", capacidade: 2 },
  { id: "grelha", nome: "Grelha", capacidade: 2 },
  { id: "fritura", nome: "Fritura e forno", capacidade: 1 },
  { id: "frio", nome: "Praça fria", capacidade: 2 },
];

/** Salão: número, lugares e área de cada mesa. */
const MESAS = [
  { numero: 1, lugares: 2, area: "Salão" },
  { numero: 2, lugares: 2, area: "Salão" },
  { numero: 3, lugares: 2, area: "Varanda" },
  { numero: 4, lugares: 2, area: "Varanda" },
  { numero: 5, lugares: 4, area: "Salão" },
  { numero: 6, lugares: 4, area: "Salão" },
  { numero: 7, lugares: 4, area: "Salão" },
  { numero: 8, lugares: 4, area: "Varanda" },
  { numero: 9, lugares: 4, area: "Mezanino" },
  { numero: 10, lugares: 6, area: "Salão" },
  { numero: 11, lugares: 6, area: "Mezanino" },
  { numero: 12, lugares: 6, area: "Mezanino" },
  { numero: 13, lugares: 8, area: "Salão" },
  { numero: 14, lugares: 8, area: "Mezanino" },
];

/** Quanto uma mesa fica ocupada, em média, do sentar ao levantar. */
const TEMPO_MEDIO_DE_REFEICAO = 55;

/** Horas em que a casa atende. */
const HORAS_DE_SERVICO = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

/**
 * Como o movimento se espalha pelas horas do dia.
 *
 * Dia útil tem pico de almoço forte e curto (executivo) e jantar mais tarde.
 * Fim de semana almoça mais tarde, estica a tarde e distribui melhor.
 * Os dois perfis somam 1 — são a fatia do movimento do dia em cada hora.
 */
const PERFIL_UTIL = [
  0.04, 0.16, 0.14, 0.06, 0.02, 0.01, 0.02, 0.05, 0.1, 0.15, 0.13, 0.08, 0.04,
];
const PERFIL_FIM_DE_SEMANA = [
  0.03, 0.12, 0.15, 0.1, 0.05, 0.03, 0.03, 0.05, 0.09, 0.13, 0.12, 0.07, 0.03,
];

/** Quantos pratos, em média, cada pessoa pede. */
const PRATOS_POR_PESSOA = 1.15;

/**
 * Distribui o movimento do dia pelas horas.
 *
 * O total sai das porções vendidas naquele dia, para o histórico ficar
 * coerente consigo mesmo: se o dia vendeu 147 porções, chegaram por volta de
 * 128 pessoas, e não um número solto.
 */
function chegadasDoDia(ctx, totalDePorcoes) {
  const fimDeSemana = ctx.diaSemana === 0 || ctx.diaSemana === 6;
  const base = fimDeSemana ? PERFIL_FIM_DE_SEMANA : PERFIL_UTIL;

  const pessoas = Math.round(totalDePorcoes / PRATOS_POR_PESSOA);

  const pesos = base.map((peso, i) => {
    const hora = HORAS_DE_SERVICO[i];
    let ajuste = 1;

    // Chuva segura o jantar e empurra um pouco para o almoço.
    if (ctx.chuva) ajuste *= hora >= 18 ? 0.88 : 1.1;
    // Feriado esvazia o almoço de executivo e enche a noite.
    if (ctx.feriado) ajuste *= hora <= 15 ? 0.85 : 1.2;

    return Math.max(0, peso * ajuste * (1 + ruido(0.12)));
  });

  const soma = pesos.reduce((a, b) => a + b, 0) || 1;
  return pesos.map((peso) => Math.max(0, Math.round((peso / soma) * pessoas)));
}

const PRATOS = [
  {
    id: "feijoada",
    nome: "Feijoada",
    precoVenda: 52.0,
    ingredientes: [
      ["feijao-preto", 0.12],
      ["carne-seca", 0.08],
      ["linguica", 0.07],
      ["bacon", 0.04],
      ["arroz", 0.15],
      ["couve", 0.05],
      ["laranja", 0.08],
    ],
  },
  {
    id: "caldo-verde",
    nome: "Caldo verde",
    precoVenda: 28.0,
    ingredientes: [
      ["batata", 0.18],
      ["couve", 0.06],
      ["linguica", 0.05],
      ["cebola", 0.03],
      ["alho", 0.005],
      ["azeite", 0.01],
    ],
  },
  {
    id: "salada",
    nome: "Salada da casa",
    precoVenda: 32.0,
    ingredientes: [
      ["alface", 0.08],
      ["tomate", 0.07],
      ["cenoura", 0.04],
      ["pepino", 0.05],
      ["queijo-branco", 0.03],
      ["azeite", 0.01],
    ],
  },
  {
    id: "parmegiana",
    nome: "Parmegiana",
    precoVenda: 48.0,
    ingredientes: [
      ["file-frango", 0.18],
      ["mussarela", 0.06],
      ["molho-tomate", 0.1],
      ["farinha-rosca", 0.04],
      ["ovo", 1],
      ["arroz", 0.15],
      ["batata", 0.12],
    ],
  },
  {
    id: "frango-grelhado",
    nome: "Frango grelhado",
    precoVenda: 38.0,
    ingredientes: [
      ["file-frango", 0.2],
      ["arroz", 0.15],
      ["feijao-carioca", 0.1],
      ["alface", 0.04],
      ["tomate", 0.04],
      ["azeite", 0.01],
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Padrões de venda por prato                                          */
/* ------------------------------------------------------------------ */

const LIMITE = (v, min, max) => Math.min(max, Math.max(min, v));

const MODELOS = {
  feijoada: (ctx) => {
    let v = 30;
    // Sábado é o dia clássico de feijoada; quarta tem um pico menor.
    v *= [1.15, 0.7, 0.75, 1.35, 0.8, 0.95, 2.3][ctx.diaSemana];
    v *= 1 + LIMITE((22 - ctx.temperatura) * 0.02, -0.18, 0.22); // frio ajuda um pouco
    v *= ctx.chuva ? 1.08 : 1;
    return v;
  },
  "caldo-verde": (ctx) => {
    let v = 20;
    v *= [0.95, 1.05, 1.05, 1.0, 1.05, 1.15, 1.0][ctx.diaSemana];
    // Fator principal: frio.
    v *= LIMITE(1 + (21 - ctx.temperatura) * 0.11, 0.25, 2.6);
    v *= ctx.chuva ? 1.3 : 1;
    return v;
  },
  salada: (ctx) => {
    let v = 24;
    v *= [0.8, 1.2, 1.1, 1.05, 1.05, 1.0, 0.85][ctx.diaSemana];
    // Fator principal: calor.
    v *= LIMITE(1 + (ctx.temperatura - 22) * 0.085, 0.35, 2.2);
    v *= ctx.chuva ? 0.82 : 1;
    return v;
  },
  parmegiana: (ctx) => {
    let v = 34;
    v *= [1.2, 0.85, 0.9, 0.95, 1.0, 1.35, 1.2][ctx.diaSemana];
    v *= 1 + LIMITE((21 - ctx.temperatura) * 0.012, -0.12, 0.12);
    v *= ctx.chuva ? 1.12 : 1;
    return v;
  },
  "frango-grelhado": (ctx) => {
    let v = 38;
    // Prato de executivo: forte de segunda a sexta.
    v *= [0.7, 1.2, 1.2, 1.15, 1.15, 1.05, 0.75][ctx.diaSemana];
    v *= 1 + LIMITE((ctx.temperatura - 22) * 0.015, -0.12, 0.15);
    v *= ctx.chuva ? 0.95 : 1;
    return v;
  },
};

/** Fatores que mexem no movimento da casa inteira. */
function fatorMovimento(ctx) {
  let f = 1;
  if (ctx.feriado) f *= 1.28; // feriado enche o salão
  if (ctx.inicioMes) f *= 1.16; // logo após o pagamento
  if (ctx.diaDoMes >= 25) f *= 0.9; // fim do mês o público segura
  f *= 1 + 0.08 * (ctx.indice / DIAS); // leve crescimento ao longo do ano
  return f;
}

/* ------------------------------------------------------------------ */
/* Geração do histórico                                                */
/* ------------------------------------------------------------------ */

function gerarVendas() {
  const hoje = new Date();
  const fim =
    Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) - 86400000; // último dia fechado = ontem
  const registros = [];

  for (let i = DIAS - 1; i >= 0; i--) {
    const data = new Date(fim - i * 86400000);
    const indice = DIAS - 1 - i;
    const temperatura = temperaturaDoDia(data);
    const chuva = choveuNoDia(temperatura);
    const mesDia = iso(data).slice(5);
    const diaDoMes = data.getUTCDate();

    const ctx = {
      indice,
      diaSemana: data.getUTCDay(),
      temperatura,
      chuva,
      feriado: FERIADOS.has(mesDia),
      inicioMes: diaDoMes <= 5,
      diaDoMes,
    };

    const movimento = fatorMovimento(ctx);
    const vendas = {};
    for (const prato of PRATOS) {
      const base = MODELOS[prato.id](ctx) * movimento;
      const comRuido = base * (1 + ruido(0.11)) + ruido(1.6);
      vendas[prato.id] = Math.max(0, Math.round(comRuido));
    }

    const totalDePorcoes = Object.values(vendas).reduce((a, b) => a + b, 0);

    registros.push({
      data: iso(data),
      diaSemana: ctx.diaSemana,
      diaSemanaNome: NOMES_DIAS[ctx.diaSemana],
      temperatura,
      chuva: ctx.chuva,
      feriado: ctx.feriado,
      inicioMes: ctx.inicioMes,
      vendas,
      chegadasPorHora: chegadasDoDia(ctx, totalDePorcoes),
    });
  }

  return registros;
}

/* ------------------------------------------------------------------ */
/* Estoque                                                             */
/* ------------------------------------------------------------------ */

// [id, quantidade em estoque, dias até o vencimento, custo por unidade]
const ESTOQUE_BASE = [
  ["feijao-preto", 14, 120, 9.4],
  ["carne-seca", 6.5, 9, 42.9],
  ["linguica", 7.0, 7, 27.5],
  ["bacon", 3.2, 11, 34.0],
  ["arroz", 30, 180, 6.2],
  ["couve", 4.0, 2, 12.0],
  ["laranja", 9.0, 6, 5.5],
  ["batata", 22, 15, 4.8],
  ["cebola", 6.0, 20, 5.2],
  ["alho", 1.2, 45, 38.0],
  ["azeite", 4.0, 300, 46.0],
  ["alface", 2.6, 3, 14.5],
  ["tomate", 7.5, 5, 8.9],
  ["cenoura", 4.5, 12, 6.4],
  ["pepino", 2.8, 4, 7.2],
  ["queijo-branco", 2.2, 8, 48.0],
  ["file-frango", 16, 3, 26.9],
  ["mussarela", 4.5, 14, 52.0],
  ["molho-tomate", 8.0, 90, 11.5],
  ["farinha-rosca", 5.0, 60, 9.0],
  ["ovo", 180, 18, 0.85],
  ["feijao-carioca", 12, 120, 8.1],
];

function gerarEstoque() {
  const hoje = new Date();
  const base = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return ESTOQUE_BASE.map(([id, quantidade, dias, custo]) => ({
    id,
    nome: INGREDIENTES[id].nome,
    unidade: INGREDIENTES[id].unidade,
    quantidade,
    validade: iso(new Date(base + dias * 86400000)),
    custoUnitario: custo,
  }));
}

/* ------------------------------------------------------------------ */
/* Escrita dos arquivos                                                */
/* ------------------------------------------------------------------ */

function gravar(nome, conteudo) {
  const caminho = join(PASTA_DADOS, nome);
  writeFileSync(caminho, JSON.stringify(conteudo, null, 2) + "\n", "utf8");
  console.log("gravado:", caminho);
}

mkdirSync(PASTA_DADOS, { recursive: true });

const vendas = gerarVendas();

const pratos = PRATOS.map((p) => ({
  id: p.id,
  nome: p.nome,
  precoVenda: p.precoVenda,
  ...PREPARO[p.id],
  ingredientes: p.ingredientes.map(([id, quantidade]) => ({
    id,
    nome: INGREDIENTES[id].nome,
    unidade: INGREDIENTES[id].unidade,
    quantidadePorPorcao: quantidade,
  })),
}));

gravar("vendas.json", {
  aviso:
    "DADOS SIMULADOS — gerados por scripts/gerar-dados.mjs, não representam vendas reais.",
  geradoEm: isoLocal(),
  dias: vendas.length,
  registros: vendas,
});

gravar("pratos.json", pratos);
gravar("estoque.json", gerarEstoque());
gravar("restaurante.json", {
  tempoMedioDeRefeicaoMinutos: TEMPO_MEDIO_DE_REFEICAO,
  horasDeServico: HORAS_DE_SERVICO,
  estacoes: ESTACOES,
  mesas: MESAS.map((m) => ({ id: `mesa-${m.numero}`, ...m })),
});

const total = vendas.reduce(
  (s, d) => s + Object.values(d.vendas).reduce((a, b) => a + b, 0),
  0
);
console.log(
  `${vendas.length} dias | ${vendas[0].data} a ${vendas[vendas.length - 1].data} | ${total} pratos vendidos (simulado)`
);
