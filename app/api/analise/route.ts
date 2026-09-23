import { NextRequest, NextResponse } from "next/server";
import { Ollama } from "ollama";

/**
 * Análise automática do dia.
 *
 * Diferente de um chat: não existe pergunta do usuário. O painel manda o
 * cenário (clima real + calendário), a previsão do KNN, os padrões do
 * histórico e a situação do estoque, e a IA devolve um JSON com a leitura
 * do dia e sugestões práticas. O gerente não digita nada.
 *
 * A chave fica no servidor (route handler), nunca no navegador.
 */

export const runtime = "nodejs";

const MODELO = "gpt-oss:20b-cloud";

const PROMPT_SISTEMA = `Você é o analista de operação do PrevChef, um sistema que prevê a venda de pratos de um restaurante e sugere compras.

Contexto obrigatório:
- O histórico de vendas, as fichas técnicas e o estoque são DADOS SIMULADOS, gerados por script para um protótipo acadêmico. A previsão do tempo é real.
- A previsão numérica JÁ FOI CALCULADA por um modelo KNN. Você NÃO recalcula nem inventa números: você interpreta os números recebidos e transforma em decisão de operação.
- Nunca invente pratos, ingredientes, valores ou datas que não estejam nos dados recebidos.
- Se algo não estiver nos dados, não fale sobre isso.

Sua tarefa:
- Ler o clima real do dia e dizer o que ele significa para a venda, usando os padrões históricos recebidos.
- Apontar o que é comum vender nessas condições (dia da semana, faixa de temperatura, chuva, feriado, início do mês).
- Sugerir de 3 a 4 ações concretas de produção, compra ou cardápio, priorizando ingredientes perto do vencimento e furos de estoque.

Formato da resposta:
- Responda SOMENTE com um objeto JSON válido, sem crases, sem markdown e sem texto antes ou depois.
- Use exatamente este formato:
{"resumo":"","clima":"","padrao":"","sugestoes":[{"titulo":"","acao":"","porque":""}],"atencao":""}
- "resumo": uma ou duas frases sobre como será o dia.
- "clima": o que a previsão do tempo real muda na venda.
- "padrao": o que o histórico mostra como comum nessas condições.
- "sugestoes": de 3 a 4 itens. "titulo" curto (até 6 palavras), "acao" no imperativo e com número quando fizer sentido, "porque" com a justificativa em uma frase.
- "atencao": o principal risco do dia em uma frase.
- Escreva em português do Brasil, direto, sem enrolação. Valores em reais no formato R$ 1.234,56.`;

type Sugestao = { titulo: string; acao: string; porque: string };

export type AnaliseDoDia = {
  resumo: string;
  clima: string;
  padrao: string;
  sugestoes: Sugestao[];
  atencao: string;
};

/** O modelo às vezes embrulha o JSON em crases; tira isso antes de parsear. */
function extrairJson(texto: string): AnaliseDoDia | null {
  const limpo = texto
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const inicio = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  if (inicio === -1 || fim === -1 || fim <= inicio) return null;

  try {
    const bruto = JSON.parse(limpo.slice(inicio, fim + 1));
    // Sem resumo o cartão fica em branco e ainda seria guardado como a leitura do dia.
    if (typeof bruto.resumo !== "string" || !bruto.resumo.trim()) return null;
    const sugestoes = Array.isArray(bruto.sugestoes) ? bruto.sugestoes : [];

    return {
      resumo: String(bruto.resumo ?? ""),
      clima: String(bruto.clima ?? ""),
      padrao: String(bruto.padrao ?? ""),
      sugestoes: sugestoes
        .filter((s: unknown) => s && typeof s === "object")
        .slice(0, 5)
        .map((s: Record<string, unknown>) => ({
          titulo: String(s.titulo ?? ""),
          acao: String(s.acao ?? ""),
          porque: String(s.porque ?? ""),
        }))
        .filter((s: Sugestao) => s.titulo || s.acao),
      atencao: String(bruto.atencao ?? ""),
    };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const chave = (process.env.OLLAMA_API_KEY ?? "").trim();

  if (!chave) {
    return NextResponse.json(
      {
        error:
          "Chave da IA não configurada. Copie .env.example para .env.local e preencha OLLAMA_API_KEY.",
        configuracaoAusente: true,
      },
      { status: 503 }
    );
  }

  let dados: unknown;
  try {
    dados = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  try {
    const ollama = new Ollama({
      host: "https://ollama.com",
      headers: { Authorization: `Bearer ${chave}` },
    });

    const resposta = await ollama.chat({
      model: MODELO,
      stream: false,
      messages: [
        { role: "system", content: PROMPT_SISTEMA },
        {
          role: "user",
          content: `DADOS DO DIA (gerados pelo sistema, sem pergunta do usuário):\n${JSON.stringify(
            dados
          )}`,
        },
      ],
    });

    const texto = resposta.message?.content ?? "";
    const analise = extrairJson(texto);

    if (!analise) {
      return NextResponse.json(
        { error: "A IA respondeu num formato inesperado.", bruto: texto.slice(0, 2000) },
        { status: 502 }
      );
    }

    return NextResponse.json(analise);
  } catch (erro: unknown) {
    console.error(
      "[analise]",
      erro instanceof Error ? erro.message : "Erro ao consultar a IA."
    );

    // A ResponseError do ollama traz o status HTTP; falha de rede chega como TypeError.
    const status = (erro as { status_code?: number } | null)?.status_code;
    if (status === 401 || status === 403) {
      return NextResponse.json(
        {
          error: "A chave da IA foi recusada. Confira OLLAMA_API_KEY no .env.local.",
          configuracaoAusente: true,
        },
        { status: 502 }
      );
    }

    const mensagem =
      status === 429
        ? "Limite de uso da IA atingido. Tente mais tarde."
        : erro instanceof TypeError
          ? "O servidor não conseguiu falar com a IA (sem internet?)."
          : "A IA não respondeu agora.";
    return NextResponse.json({ error: mensagem }, { status: 502 });
  }
}
